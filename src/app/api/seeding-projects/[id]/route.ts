import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/seeding-projects/[id]  — project + stats + top performers
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [projectRes, recordsRes] = await Promise.all([
    supabaseAdmin.from('seeding_projects').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('seeding_records')
      .select(`
        id,
        influencers(handle, platform),
        seeding_results(views, likes, comments, estimated_reach, is_posted)
      `)
      .eq('project_id', id),
  ])

  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 404 })

  const records = recordsRes.data ?? []

  let totalViews = 0
  let totalReach = 0
  let postedCount = 0
  const performerMap = new Map<string, { handle: string; platform: string; views: number; reach: number; likes: number }>()

  for (const r of records) {
    const inf = r.influencers as { handle: string; platform: string } | null
    const results = Array.isArray(r.seeding_results) ? r.seeding_results : r.seeding_results ? [r.seeding_results] : []
    for (const res of results as { views: number; likes: number; estimated_reach: number; is_posted: boolean }[]) {
      if (res.is_posted) {
        postedCount++
        totalViews += res.views ?? 0
        totalReach += res.estimated_reach ?? 0
        if (inf?.handle) {
          const prev = performerMap.get(inf.handle) ?? { handle: inf.handle, platform: inf.platform ?? '', views: 0, reach: 0, likes: 0 }
          performerMap.set(inf.handle, {
            ...prev,
            views: prev.views + (res.views ?? 0),
            reach: prev.reach + (res.estimated_reach ?? 0),
            likes: prev.likes + (res.likes ?? 0),
          })
        }
      }
    }
  }

  const topPerformers = Array.from(performerMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  return NextResponse.json({
    project: projectRes.data,
    stats: { seedingCount: records.length, postedCount, totalViews, totalReach },
    topPerformers,
  })
}

// PATCH /api/seeding-projects/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('seeding_projects')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/seeding-projects/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('seeding_projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
