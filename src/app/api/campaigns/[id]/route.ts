import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// PUT /api/campaigns/[id] — 캠페인 수정
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { title, start_date, end_date, status, color, ooh_cost, notes, products, brand } = body

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .update({ title, start_date, end_date, status, color, ooh_cost, notes, brand: brand ?? null, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 상품 전체 교체
  if (products !== undefined) {
    await supabaseAdmin.from('campaign_products').delete().eq('campaign_id', params.id)
    if (products.length > 0) {
      await supabaseAdmin.from('campaign_products').insert(
        products.map((p: { product_code: string; product_name: string }) => ({
          campaign_id: params.id,
          product_code: p.product_code,
          product_name: p.product_name,
        }))
      )
    }
  }

  return NextResponse.json(campaign)
}

// DELETE /api/campaigns/[id]
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
