import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/influencers
export async function GET(req: Request) {
  let query = supabaseAdmin.from('influencers').select('*').order('collected_at', { ascending: false })

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/influencers
export async function POST(req: Request) {
  const body = await req.json()
  const { handle, platform, followers, category, engagement_rate, profile_url } = body

  const { data, error } = await supabaseAdmin
    .from('influencers')
    .insert({ handle, platform, followers, category, engagement_rate, profile_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
