import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH /api/seeding/[id] — 상태 업데이트
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { status } = body

  const { data, error } = await supabaseAdmin
    .from('seeding_records')
    .update({ status })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/seeding/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('seeding_records')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
