import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/seeding/results?project_id=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  let query = supabaseAdmin
    .from('seeding_results')
    .select(`
      *,
      seeding_records (
        project_id,
        influencer_id,
        influencers ( handle, platform )
      )
    `)
    .order('updated_at', { ascending: false })

  // If project_id filter needed, first get record IDs for that project
  if (projectId) {
    const { data: records } = await supabaseAdmin
      .from('seeding_records')
      .select('id')
      .eq('project_id', projectId)
    const recordIds = (records ?? []).map((r: { id: string }) => r.id)
    if (recordIds.length === 0) return NextResponse.json([])
    query = query.in('seeding_record_id', recordIds)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const sr = r.seeding_records as { project_id: string; influencer_id: string; influencers: { handle: string; platform: string } | null } | null
    return {
      seedingRecordId: r.seeding_record_id,
      influencerHandle: sr?.influencers?.handle ?? '',
      platform: sr?.influencers?.platform ?? '',
      postUrl: r.post_url,
      views: r.views ?? 0,
      likes: r.likes ?? 0,
      comments: r.comments ?? 0,
      estimatedReach: r.estimated_reach ?? 0,
      isPosted: r.is_posted ?? false,
      postedAt: r.posted_at,
    }
  })

  return NextResponse.json(rows)
}

// POST /api/seeding/results
export async function POST(req: Request) {
  const body = await req.json()
  const { seeding_record_id, post_url, views, likes, comments, estimated_reach, is_posted, posted_at } = body

  const { data, error } = await supabaseAdmin
    .from('seeding_results')
    .upsert({
      seeding_record_id,
      post_url,
      views: views ?? 0,
      likes: likes ?? 0,
      comments: comments ?? 0,
      estimated_reach: estimated_reach ?? 0,
      is_posted: is_posted ?? false,
      posted_at: posted_at ?? null,
    }, { onConflict: 'seeding_record_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
