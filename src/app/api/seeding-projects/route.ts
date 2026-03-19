import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/seeding-projects
export async function GET() {
  const { data: projects, error } = await supabaseAdmin
    .from('seeding_projects')
    .select(`
      *,
      seeding_records(
        id,
        seeding_results(is_posted)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (projects ?? []).map(p => {
    const records = (p.seeding_records as { id: string; seeding_results: { is_posted: boolean }[] | null }[] | null) ?? []
    const posted = records.flatMap(r => r.seeding_results ?? []).filter(r => r.is_posted).length
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      created_at: p.created_at,
      seeding_count: records.length,
      posted_count: posted,
    }
  })

  return NextResponse.json(enriched)
}

// POST /api/seeding-projects
export async function POST(req: Request) {
  const { title, description, status, start_date, end_date, brand } = await req.json()
  const { data, error } = await supabaseAdmin
    .from('seeding_projects')
    .insert({
      title,
      description: description || null,
      status: status ?? '진행중',
      start_date: start_date || null,
      end_date: end_date || null,
      brand: brand || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
