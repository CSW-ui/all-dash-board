import { NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

async function runActor(actorId: string, input: unknown): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Apify 실행 실패: ${res.status}`)
  return res.json()
}

// POST /api/influencers/ai-search
// body: { query: "커버낫에 어울리는 남성 스트릿 패션 인플루언서 찾아줘" }
export async function POST(req: Request) {
  const { query } = await req.json()
  if (!query?.trim()) {
    return NextResponse.json({ error: '검색어를 입력하세요' }, { status: 400 })
  }

  try {
    // 1단계: AI가 자연어 → 구조화 조건 + 해시태그 변환
    const parseResult = await chatCompletion(
      `당신은 인스타그램/틱톡 인플루언서 검색 전문가입니다.
사용자의 자연어 요청을 분석하여 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력.

{
  "platform": "instagram" | "tiktok",
  "category": "패션" | "뷰티" | "라이프스타일" | "스포츠" | "여행" | "푸드" | "테크",
  "minFollowers": 숫자(기본 10000),
  "maxFollowers": 숫자(기본 500000),
  "hashtags": ["관련 한국어 해시태그 5~8개"],
  "sortBy": "engagement" | "followers",
  "topN": 숫자(기본 15),
  "searchIntent": "사용자 의도 한줄 요약"
}

해시태그 생성 규칙:
- 인스타그램에서 실제로 많이 사용되는 한국어 해시태그
- **절대 브랜드명(커버낫, covernat, 와키윌리, Lee 등)을 해시태그에 포함하지 마세요** — 브랜드 공식 계정만 나옵니다
- 대신 해당 브랜드의 **스타일/무드/타겟층**에 맞는 해시태그를 생성하세요
  예: 커버낫 → #스트릿패션 #캐주얼코디 #남자데일리룩 (브랜드명X, 스타일O)
- 패션이면: #ootd #데일리룩 #코디 #오오티디 등 실제 인기 태그
- 카테고리 + 스타일 + 타겟층 조합으로 다양하게
- 너무 광범위한 태그(#패션)보다 구체적인 태그(#남자스트릿패션) 선호
- 인플루언서 개인이 자주 쓰는 태그 위주 (브랜드/기업 계정이 쓰는 태그 제외)`,
      query,
      { temperature: 0.2 }
    )

    let parsed
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      const jsonMatch = parseResult.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] ?? parseResult)
    } catch {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: parseResult }, { status: 500 })
    }

    const {
      platform = 'instagram',
      category = '패션',
      minFollowers = 10000,
      maxFollowers = 500000,
      hashtags = [],
      sortBy = 'engagement',
      topN = 15,
      searchIntent = '',
    } = parsed

    // 2단계: Apify로 해시태그 기반 인플루언서 발굴
    let influencers: any[] = []
    let scanned = 0

    if (platform === 'instagram' && hashtags.length > 0) {
      // Step A: 해시태그 게시물에서 username 추출
      const hashtagItems = await runActor('apify~instagram-hashtag-scraper', {
        hashtags: hashtags.map((h: string) => h.replace(/^#/, '')),
        resultsLimit: 50,
      }) as Record<string, unknown>[]

      scanned = hashtagItems.length

      const usernameSet = new Set<string>()
      for (const item of hashtagItems) {
        const owner = item.owner as Record<string, unknown> | undefined
        const username = (item.ownerUsername ?? item.username ?? owner?.username ?? '') as string
        if (username) usernameSet.add(username)
      }

      const usernames = Array.from(usernameSet).slice(0, Math.min(topN * 3, 30))

      if (usernames.length > 0) {
        // Step B: 프로필 상세 크롤링
        const profileItems = await runActor('apify~instagram-profile-scraper', {
          usernames,
          resultsLimit: usernames.length,
        }) as Record<string, unknown>[]

        influencers = profileItems
          .map(item => {
            const followers = Number(item.followersCount ?? 0)
            let engagementRate = 0
            const posts = item.latestPosts as Record<string, unknown>[] | undefined
            if (followers > 0 && posts?.length) {
              const total = posts.reduce((sum: number, p: Record<string, unknown>) =>
                sum + Number(p.likesCount ?? 0) + Number(p.commentsCount ?? 0), 0)
              engagementRate = Math.round((total / posts.length / followers) * 1000) / 10
            }

            // 최근 30일 게시물 수
            const now = Date.now()
            const thirtyDays = 30 * 24 * 60 * 60 * 1000
            const recentPosts = posts?.filter(p => {
              const ts = Number(p.timestamp ?? 0) * 1000
              return ts > 0 && (now - ts) < thirtyDays
            }).length ?? 0

            return {
              handle: `@${item.username ?? ''}`,
              platform: 'instagram',
              followers,
              category,
              engagement_rate: engagementRate,
              profile_url: item.url ?? `https://www.instagram.com/${item.username}`,
              full_name: (item.fullName ?? '') as string,
              biography: (item.biography ?? '') as string,
              is_verified: Boolean(item.verified),
              profile_pic_url: (item.profilePicUrl ?? '') as string,
              posts_last_30d: recentPosts,
              apify_run_id: null,
            }
          })
          .filter(r => r.handle !== '@')
          .filter(r => r.followers >= minFollowers)
          .filter(r => maxFollowers === 0 || r.followers <= maxFollowers)
          // 공식/비즈니스 계정 필터링
          .filter(r => !r.is_verified) // 인증 계정 제외 (대부분 브랜드/셀럽)
          .filter(r => {
            // 브랜드/기업 계정 패턴 제외
            const h = r.handle.toLowerCase()
            const bio = (r.biography ?? '').toLowerCase()
            const brandKeywords = ['official', 'brand', '공식', '브랜드', '쇼핑몰', 'shop', 'store', '매장', '고객센터', 'cs']
            return !brandKeywords.some(kw => h.includes(kw) || bio.includes(kw))
          })
          .sort((a, b) => sortBy === 'followers'
            ? b.followers - a.followers
            : b.engagement_rate - a.engagement_rate
          )
          .slice(0, topN)
      }
    } else if (platform === 'tiktok' && hashtags.length > 0) {
      // TikTok: 핸들 기반 수집만 가능 (해시태그 발굴은 인스타만)
      // 향후 확장 가능
    }

    // 3단계: Supabase에 저장
    if (influencers.length > 0) {
      await supabaseAdmin
        .from('influencers')
        .upsert(influencers, { onConflict: 'handle,platform', ignoreDuplicates: false })
    }

    // 4단계: AI 추천 코멘트 생성
    const summary = influencers.length > 0
      ? await chatCompletion(
          `패션 기업의 인플루언서 마케팅 전문가로서, 검색 결과를 간결하게 요약해주세요.
- 3~4문장으로 핵심만
- 추천 인플루언서 2~3명 구체적으로 언급 (핸들, 팔로워, 참여율)
- 브랜드 적합성 코멘트
- 한국어로 답변`,
          `검색 의도: ${searchIntent}
결과 ${influencers.length}명:
${influencers.slice(0, 10).map(i =>
  `${i.handle} | 팔로워 ${i.followers.toLocaleString()} | 참여율 ${i.engagement_rate}% | ${i.full_name} | ${i.biography?.slice(0, 50)}`
).join('\n')}`,
          { temperature: 0.4 }
        )
      : '조건에 맞는 인플루언서를 찾지 못했습니다. 검색어를 조정해보세요.'

    return NextResponse.json({
      summary,
      searchParams: parsed,
      scanned,
      collected: influencers.length,
      influencers: influencers.map(i => ({
        handle: i.handle,
        platform: i.platform,
        followers: i.followers,
        engagement_rate: i.engagement_rate,
        full_name: i.full_name,
        biography: i.biography?.slice(0, 100),
        profile_pic_url: i.profile_pic_url,
        profile_url: i.profile_url,
        posts_last_30d: i.posts_last_30d,
      })),
    })
  } catch (err) {
    console.error('[AI Search]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
