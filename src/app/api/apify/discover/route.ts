import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

async function runActor(actorId: string, input: unknown): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify 실행 실패: ${res.status} ${text}`)
  }
  return res.json()
}

// POST /api/apify/discover
// body: { hashtags, category, minFollowers?, maxFollowers?, minEngagement?, sortBy?, topN?, postsPerHashtag? }
export async function POST(req: Request) {
  const {
    hashtags,
    category,
    minFollowers = 0,
    maxFollowers = 0,
    minEngagement = 0,
    sortBy = 'engagement',
    topN = 10,
    postsPerHashtag = 50,
  } = await req.json() as {
    hashtags: string[]
    category: string
    minFollowers?: number
    maxFollowers?: number
    minEngagement?: number
    sortBy?: 'followers' | 'engagement'
    topN?: number
    postsPerHashtag?: number
  }

  if (!hashtags?.length) {
    return NextResponse.json({ error: '해시태그를 입력하세요' }, { status: 400 })
  }

  const cleanHashtags = hashtags.map(h => h.replace(/^#/, '').trim()).filter(Boolean)

  try {
    // Step 1: Scrape hashtag posts to get usernames
    const hashtagItems = await runActor('apify~instagram-hashtag-scraper', {
      hashtags: cleanHashtags,
      resultsLimit: postsPerHashtag,
    }) as Record<string, unknown>[]

    // Extract unique usernames from posts (handle multiple field variations)
    const usernameSet = new Set<string>()
    for (const item of hashtagItems) {
      const owner = item.owner as Record<string, unknown> | undefined
      const username = (
        item.ownerUsername ??
        item.username ??
        owner?.username ??
        ''
      ) as string
      if (username) usernameSet.add(username)
    }

    const usernames = Array.from(usernameSet).slice(0, Math.min(topN * 3, 30)) // fetch 3x topN to have room for filtering
    if (!usernames.length) {
      return NextResponse.json({ error: '해시태그에서 계정을 찾을 수 없습니다' }, { status: 404 })
    }

    // Step 2: Scrape profiles for found usernames (include latest posts for engagement calc)
    const profileItems = await runActor('apify~instagram-profile-scraper', {
      usernames,
      resultsLimit: usernames.length,
    }) as Record<string, unknown>[]

    // Build, filter, sort, slice
    const allRows = profileItems
      .map(item => {
        const followers = Number(item.followersCount ?? 0)

        // Calculate engagement rate from latestPosts array
        let engagementRate = 0
        const posts = item.latestPosts as Record<string, unknown>[] | undefined
        if (followers > 0 && posts?.length) {
          const total = posts.reduce((sum: number, p: Record<string, unknown>) =>
            sum + Number(p.likesCount ?? 0) + Number(p.commentsCount ?? 0), 0)
          engagementRate = Math.round((total / posts.length / followers) * 1000) / 10
        } else if (followers > 0) {
          const avgLikes = Number(item.avgLikesCount ?? 0)
          const avgComments = Number(item.avgCommentsCount ?? 0)
          if (avgLikes || avgComments) {
            engagementRate = Math.round(((avgLikes + avgComments) / followers) * 1000) / 10
          }
        }
        return {
          handle: `@${item.username ?? ''}`,
          platform: 'instagram',
          followers,
          category,
          engagement_rate: engagementRate,
          profile_url: item.url ?? `https://www.instagram.com/${item.username}`,
          apify_run_id: null,
        }
      })
      .filter(r => r.handle !== '@')
      .filter(r => minFollowers === 0 || r.followers >= minFollowers)
      .filter(r => maxFollowers === 0 || r.followers <= maxFollowers)
      // engagement filter: only apply when we have real data (>0).
      // Instagram often hides likes → rate stays 0, don't penalize for that
      .filter(r => minEngagement === 0 || r.engagement_rate === 0 || r.engagement_rate >= minEngagement)

    if (!allRows.length) {
      return NextResponse.json({
        error: '조건에 맞는 계정이 없습니다. 필터를 조정해보세요.',
      }, { status: 404 })
    }

    // Sort and take top N
    const rows = allRows
      .sort((a, b) => sortBy === 'followers'
        ? b.followers - a.followers
        : b.engagement_rate - a.engagement_rate
      )
      .slice(0, topN)

    // Upsert to Supabase
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .upsert(rows, { onConflict: 'handle,platform', ignoreDuplicates: false })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      collected: data?.length ?? rows.length,
      scanned: hashtagItems.length,
      rows: data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
