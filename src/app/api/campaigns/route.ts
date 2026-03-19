import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/campaigns — 전체 캠페인 목록 (상품 포함)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select(`
      *,
      campaign_products (
        id,
        product_code,
        product_name
      )
    `)
    .order('start_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/campaigns — 새 캠페인 등록
export async function POST(req: Request) {
  const body = await req.json()
  const { title, start_date, end_date, status, color, ooh_cost, notes, products, brand } = body

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .insert({ title, start_date, end_date, status, color, ooh_cost: ooh_cost ?? 0, notes, brand: brand ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (products && products.length > 0) {
    await supabaseAdmin
      .from('campaign_products')
      .insert(products.map((p: { product_code: string; product_name: string }) => ({
        campaign_id: campaign.id,
        product_code: p.product_code,
        product_name: p.product_name,
      })))
  }

  return NextResponse.json(campaign, { status: 201 })
}
