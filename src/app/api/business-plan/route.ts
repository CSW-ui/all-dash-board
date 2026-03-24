import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 사업계획 목록 조회
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(req.url)
    const planId = searchParams.get('id')

    if (planId) {
      // 특정 계획 + 하위 데이터 전체 조회
      const [planRes, storesRes, ordersRes, sgaRes] = await Promise.all([
        supabase.from('business_plans').select('*').eq('id', planId).single(),
        supabase.from('bp_store_targets').select('*').eq('plan_id', planId).order('brand').order('store_name'),
        supabase.from('bp_order_plans').select('*').eq('plan_id', planId).order('brand').order('season'),
        supabase.from('bp_sga_items').select('*').eq('plan_id', planId).order('category'),
      ])

      if (planRes.error) return NextResponse.json({ error: planRes.error.message }, { status: 404 })

      return NextResponse.json({
        plan: planRes.data,
        stores: storesRes.data || [],
        orders: ordersRes.data || [],
        sga: sgaRes.data || [],
      })
    }

    // 목록 조회
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const { data, error } = await supabase
      .from('business_plans')
      .select('*')
      .eq('year', Number(year))
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plans: data || [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// 사업계획 생성
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await req.json()
    const { year, version_name, description } = body

    const { data, error } = await supabase
      .from('business_plans')
      .insert({ year: Number(year), version_name: version_name || '기본', description })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plan: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// 하위 데이터 저장 (매장목표, 발주계획, 판관비)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await req.json()
    const { type, items } = body // type: 'stores' | 'orders' | 'sga'

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '데이터 없음' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      stores: 'bp_store_targets',
      orders: 'bp_order_plans',
      sga: 'bp_sga_items',
    }
    const conflictMap: Record<string, string> = {
      stores: 'plan_id,brand,store_name',
      orders: 'plan_id,brand,season,item_category',
      sga: 'plan_id,category,item_name',
    }

    const table = tableMap[type]
    const conflict = conflictMap[type]
    if (!table) return NextResponse.json({ error: '잘못된 type' }, { status: 400 })

    let success = 0, fail = 0
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50)
      const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict })
      if (error) { console.error(`BP upsert error (${type}):`, error.message); fail += batch.length }
      else success += batch.length
    }

    return NextResponse.json({ success, fail })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// 사업계획 삭제
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

    const { error } = await supabase.from('business_plans').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
