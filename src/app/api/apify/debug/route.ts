import { NextResponse } from 'next/server'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

// GET /api/apify/debug?handle=arisa_tachi
// Returns raw profile scraper response to inspect field structure
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const handle = (searchParams.get('handle') ?? 'arisa_tachi').replace(/^@/, '')

  const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [handle] }),
  })

  const status = res.status
  const text = await res.text()

  let parsed: unknown = null
  try { parsed = JSON.parse(text) } catch { parsed = text }

  const items = Array.isArray(parsed) ? parsed : []
  const firstItem = items[0] as Record<string, unknown> ?? null
  const keys = firstItem ? Object.keys(firstItem) : []

  return NextResponse.json({
    actorStatus: status,
    itemCount: items.length,
    firstItemKeys: keys,
    hasLatestPosts: Array.isArray(firstItem?.latestPosts),
    latestPostsCount: Array.isArray(firstItem?.latestPosts) ? (firstItem.latestPosts as unknown[]).length : 0,
    latestPostsSample: Array.isArray(firstItem?.latestPosts) ? (firstItem.latestPosts as Record<string, unknown>[])[0] : null,
    followersCount: firstItem?.followersCount,
  })
}
