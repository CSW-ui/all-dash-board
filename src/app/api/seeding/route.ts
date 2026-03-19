import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/seeding?project_id=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  let query = supabaseAdmin
    .from('seeding_records')
    .select(`
      *,
      influencers ( handle, platform ),
      campaigns ( title )
    `)
    .order('seeding_date', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const inf = r.influencers as { handle: string; platform: string } | null
    const cam = r.campaigns as { title: string } | null
    return {
      id: r.id,
      campaignId: r.campaign_id,
      campaignTitle: cam?.title ?? '',
      productCode: r.product_code,
      productName: r.product_name,
      influencerId: r.influencer_id,
      influencerHandle: inf?.handle ?? '',
      platform: inf?.platform ?? '',
      seedingDate: r.seeding_date,
      seedingType: r.seeding_type,
      status: r.status,
      projectId: r.project_id,
    }
  })

  return NextResponse.json(rows)
}

// POST /api/seeding
export async function POST(req: Request) {
  const body = await req.json()
  const { campaign_id, influencer_id, product_code, product_name, seeding_date, seeding_type, status, project_id } = body

  const { data, error } = await supabaseAdmin
    .from('seeding_records')
    .insert({ campaign_id, influencer_id, product_code, product_name, seeding_date, seeding_type, status: status ?? '발송완료', project_id: project_id ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
