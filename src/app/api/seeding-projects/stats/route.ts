import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/seeding-projects/stats — aggregate engagement totals
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('seeding_results')
    .select('views, likes, comments, estimated_reach, is_posted')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const posted = rows.filter(r => r.is_posted)

  return NextResponse.json({
    totalPosted:   posted.length,
    totalViews:    posted.reduce((s, r) => s + (r.views ?? 0), 0),
    totalLikes:    posted.reduce((s, r) => s + (r.likes ?? 0), 0),
    totalComments: posted.reduce((s, r) => s + (r.comments ?? 0), 0),
    totalReach:    posted.reduce((s, r) => s + (r.estimated_reach ?? 0), 0),
  })
}
