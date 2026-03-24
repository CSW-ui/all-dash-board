import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

// Instagram: apify/instagram-profile-scraper
// TikTok:    apify/tiktok-profile-scraper
const ACTORS: Record<string, string> = {
  instagram: 'apify~instagram-profile-scraper',
  tiktok: 'clockworks~free-tiktok-scraper',
}

async function runActor(actorId: string, input: unknown): Promise<unknown[]> {
  // Run synchronously and wait for dataset items (timeout 120s)
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

function parseInstagram(items: unknown[], handles: string[], category: string) {
  return (items as Record<string, unknown>[]).map((item) => {
    const posts = item.latestPosts as Record<string, unknown>[] | undefined
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const postsLast30d = posts
      ? posts.filter(p => {
          const ts = p.timestamp as string | undefined
          return ts ? new Date(ts).getTime() > thirtyDaysAgo : false
        }).length
      : 0

    return {
      handle: `@${item.username ?? ''}`,
      platform: 'instagram',
      followers: Number(item.followersCount ?? 0),
      category,
      engagement_rate: calcEngagementRate(item),
      profile_url: item.url ?? `https://www.instagram.com/${item.username}`,
      full_name: (item.fullName as string) ?? null,
      biography: (item.biography as string) ?? null,
      is_verified: Boolean(item.verified ?? item.isVerified ?? false),
      profile_pic_url: (item.profilePicUrl as string) ?? null,
      posts_last_30d: postsLast30d,
      apify_run_id: null,
    }
  }).filter(r => handles.some(h => r.handle.toLowerCase() === `@${h}`.toLowerCase() || r.handle.toLowerCase() === h.toLowerCase()))
}

function parseTikTok(items: unknown[], category: string) {
  return (items as Record<string, unknown>[]).map((item) => {
    const author = (item.authorMeta ?? item) as Record<string, unknown>
    return {
      handle: `@${author.name ?? author.nickName ?? ''}`,
      platform: 'tiktok',
      followers: Number(author.fans ?? author.followerCount ?? 0),
      category,
      engagement_rate: 0,
      profile_url: `https://www.tiktok.com/@${author.name ?? ''}`,
      apify_run_id: null,
    }
  })
}

function calcEngagementRate(item: Record<string, unknown>): number {
  const followers = Number(item.followersCount ?? 0)
  if (!followers) return 0

  // Instagram profile scraper returns latestPosts[] with per-post likesCount/commentsCount
  const posts = item.latestPosts as Record<string, unknown>[] | undefined
  if (posts?.length) {
    const total = posts.reduce((sum, p) => {
      return sum + Number(p.likesCount ?? 0) + Number(p.commentsCount ?? 0)
    }, 0)
    const avg = total / posts.length
    return Math.round((avg / followers) * 1000) / 10
  }

  // Fallback: some actors expose these directly
  const avgLikes = Number(item.avgLikesCount ?? 0)
  const avgComments = Number(item.avgCommentsCount ?? 0)
  if (avgLikes || avgComments) {
    return Math.round(((avgLikes + avgComments) / followers) * 1000) / 10
  }

  return 0
}

// POST /api/apify/collect
// body: { platform: 'instagram'|'tiktok', handles: string[], category: string, project_id?: string }
export async function POST(req: Request) {
  const { platform, handles, category, project_id } = await req.json() as {
    platform: string
    handles: string[]
    category: string
    project_id?: string
  }

  if (!handles?.length) {
    return NextResponse.json({ error: '핸들을 입력하세요' }, { status: 400 })
  }

  const actorId = ACTORS[platform]
  if (!actorId) {
    return NextResponse.json({ error: '지원하지 않는 플랫폼' }, { status: 400 })
  }

  // Clean handles (remove @ prefix for API input)
  const cleanHandles = handles.map(h => h.replace(/^@/, '').trim()).filter(Boolean)

  try {
    let rows: ReturnType<typeof parseInstagram> | ReturnType<typeof parseTikTok>

    if (platform === 'instagram') {
      const items = await runActor(actorId, { usernames: cleanHandles })
      rows = parseInstagram(items, cleanHandles, category)
    } else {
      // TikTok: profiles array with @ prefix
      const items = await runActor(actorId, {
        profiles: cleanHandles.map(h => `https://www.tiktok.com/@${h}`),
        resultsPerPage: 1,
      })
      rows = parseTikTok(items, category)
    }

    if (!rows.length) {
      return NextResponse.json({ error: '수집된 프로필이 없습니다. 핸들을 확인하세요.' }, { status: 404 })
    }

    // Upsert to Supabase (handle + platform unique)
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .upsert(rows, { onConflict: 'handle,platform', ignoreDuplicates: false })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ collected: data?.length ?? rows.length, rows: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
