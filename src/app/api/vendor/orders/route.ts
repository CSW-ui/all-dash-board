import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/vendor/orders — 협력사 발주 현황 (Snowflake 기반)
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  // 프로필에서 vendor_name 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'vendor' || !profile.vendor_name) {
    return NextResponse.json({ error: '협력사 권한이 없습니다' }, { status: 403 })
  }

  const vendorName = profile.vendor_name
  const { searchParams } = req.nextUrl
  const season = searchParams.get('season')
  const search = searchParams.get('search')
  const year = searchParams.get('year') || '2026'
  const yearCode = year.length === 4 ? year.slice(2) : year

  try {
    // 1. Snowflake: 해당 협력사 발주 + 입고 데이터 병렬 조회
    const escapedVendor = vendorName.replace(/'/g, "''")

    const [orderData, inboundData] = await Promise.all([
      snowflakeQuery<{
        STYLECD: string; CHASU: string; COLORCD: string; COLORNM: string
        STYLENM: string; BRANDCD: string; ITEMNM: string; SEASONNM: string
        ORIGNNM: string; PRODNM: string; PONO: string; STATUSNM: string
        INPUTCLOSE: string
        ORDQTY: string; TAGPRICE: string; PRECOST: string
        DELIDT: string; DUEDATE: string; ORDDT: string
      }>(`
        SELECT STYLECD, CHASU, COLORCD, MAX(COLORNM) AS COLORNM,
               MAX(STYLENM) AS STYLENM, BRANDCD, MAX(ITEMNM) AS ITEMNM,
               MAX(SEASONNM) AS SEASONNM, MAX(ORIGNNM) AS ORIGNNM,
               MAX(PRODNM) AS PRODNM, MAX(PONO) AS PONO,
               MAX(STATUSNM) AS STATUSNM,
               MAX(INPUTCLOSE) AS INPUTCLOSE,
               SUM(ORDQTY) AS ORDQTY,
               MAX(TAGPRICE) AS TAGPRICE, MAX(PRECOST) AS PRECOST,
               MAX(COALESCE(DELIDT, DUEDATE)) AS DELIDT,
               MAX(DUEDATE) AS DUEDATE,
               MIN(ORDDT) AS ORDDT
        FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
        WHERE ${BRAND_FILTER} AND YEARCD = '${yearCode}'
          AND PRODNM = '${escapedVendor}'
        GROUP BY STYLECD, CHASU, COLORCD, BRANDCD
        ORDER BY STYLECD, CHASU, COLORCD
      `),

      snowflakeQuery<{
        STYLECD: string; COLORCD: string
        TOTAL_INQTY: string
        FIRST_WHINDT: string; LAST_WHINDT: string
        WHNM: string
      }>(`
        SELECT si.STYLECD, si.COLORCD,
               SUM(wh.INQTY) AS TOTAL_INQTY,
               MIN(wh.WHINDT) AS FIRST_WHINDT,
               MAX(wh.WHINDT) AS LAST_WHINDT,
               MAX(wh.WHNM) AS WHNM
        FROM BCAVE.SEWON.SW_WHININFO wh
        INNER JOIN (
          SELECT DISTINCT STYLECD, COLORCD FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
          WHERE ${BRAND_FILTER} AND YEARCD = '${yearCode}' AND PRODNM = '${escapedVendor}'
        ) si ON wh.STYLECD = si.STYLECD AND wh.COLORCD = si.COLORCD
        WHERE wh.WHINGBNM = '입고'
        GROUP BY si.STYLECD, si.COLORCD
      `),
    ])

    // 2. Supabase: 기존 워크플로우 데이터
    const { data: srmRows } = await supabaseAdmin
      .from('srm_production')
      .select('*')
      .eq('vendor', vendorName)

    const srmMap = new Map<string, Record<string, unknown>>()
    srmRows?.forEach(r => {
      srmMap.set(`${r.stylecd}_${r.chasu}_${r.colorcd}`, r)
    })

    // 3. 입고 맵
    const fmt = (d: string) =>
      d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d || null

    const inboundMap = new Map<string, { qty: number; firstDate: string | null; lastDate: string | null; whnm: string }>()
    inboundData.forEach(r => {
      inboundMap.set(`${r.STYLECD}_${r.COLORCD}`, {
        qty: Number(r.TOTAL_INQTY) || 0,
        firstDate: fmt(r.FIRST_WHINDT || ''),
        lastDate: fmt(r.LAST_WHINDT || ''),
        whnm: r.WHNM || '',
      })
    })

    // 4. 스타일+컬러별 총 발주수량
    const styleColorOrderQty = new Map<string, number>()
    orderData.forEach(sf => {
      const key = `${sf.STYLECD}_${sf.COLORCD}`
      styleColorOrderQty.set(key, (styleColorOrderQty.get(key) || 0) + (Number(sf.ORDQTY) || 0))
    })

    // 5. 데이터 병합
    const allItems = orderData.map((sf, idx) => {
      const key = `${sf.STYLECD}_${sf.CHASU || '01'}_${sf.COLORCD}`
      const existing = srmMap.get(key)
      const inbound = inboundMap.get(`${sf.STYLECD}_${sf.COLORCD}`)

      const poQty = Number(sf.ORDQTY) || 0
      const totalOrderQty = styleColorOrderQty.get(`${sf.STYLECD}_${sf.COLORCD}`) || poQty
      const totalInQty = inbound?.qty || 0
      const receiveRate = totalOrderQty > 0 ? Math.round((totalInQty / totalOrderQty) * 100) : 0

      // 상태 결정
      let itemStatus: string
      const isInputClosed = sf.INPUTCLOSE === 'Y'
      const isUnordered = sf.STATUSNM === '발주미정'

      if (existing && !['draft'].includes(existing.status as string)) {
        itemStatus = existing.status as string
      } else if (isInputClosed || receiveRate >= 100) {
        itemStatus = 'completed'
      } else if (isUnordered) {
        itemStatus = 'draft'
      } else if (totalInQty > 0) {
        itemStatus = 'in_production'
      } else if (sf.PRODNM && sf.PRODNM.trim()) {
        itemStatus = 'confirmed'
      } else {
        itemStatus = 'draft'
      }

      return {
        id: (existing?.id as string) || `sf-${idx}`,
        stylecd: sf.STYLECD,
        chasu: sf.CHASU || '01',
        colorcd: sf.COLORCD,
        colornm: sf.COLORNM || '',
        stylenm: sf.STYLENM || '',
        brandcd: sf.BRANDCD,
        item_name: sf.ITEMNM || '',
        season: sf.SEASONNM || '',
        country: sf.ORIGNNM || '',
        pono: sf.PONO || '',
        erp_status: sf.STATUSNM || '',
        vendor: sf.PRODNM || '',
        po_qty: poQty,
        expected_cost: Number(sf.PRECOST) || null,
        confirmed_due: fmt(sf.DELIDT || sf.DUEDATE || ''),
        order_date: fmt(sf.ORDDT || ''),
        status: itemStatus,
        color_qty: (existing?.color_qty as number) || 0,
        order_type: (existing?.order_type as string) || '',
        item_category: (existing?.item_category as string) || '',
        remark: (existing?.remark as string) || '',
        md_comment: (existing?.md_comment as string) || '',
        // 원단
        fabric_vendor: (existing?.fabric_vendor as string) || '',
        fabric_spec: (existing?.fabric_spec as string) || '',
        bt_confirm: (existing?.bt_confirm as string) || '',
        bulk_confirm: (existing?.bulk_confirm as string) || '',
        ksk_result: (existing?.ksk_result as string) || '',
        gb_result: (existing?.gb_result as string) || '',
        // 사양
        artwork_confirm: (existing?.artwork_confirm as string) || '',
        qc1_receive: (existing?.qc1_receive as string) || '',
        qc1_confirm: (existing?.qc1_confirm as string) || '',
        qc2_receive: (existing?.qc2_receive as string) || '',
        qc2_confirm: (existing?.qc2_confirm as string) || '',
        qc3_receive: (existing?.qc3_receive as string) || '',
        qc3_confirm: (existing?.qc3_confirm as string) || '',
        app_confirm: (existing?.app_confirm as string) || '',
        pp1_receive: (existing?.pp1_receive as string) || '',
        pp1_confirm: (existing?.pp1_confirm as string) || '',
        pp2_receive: (existing?.pp2_receive as string) || '',
        pp2_confirm: (existing?.pp2_confirm as string) || '',
        pp_confirm: (existing?.pp_confirm as string) || '',
        matching_chart: (existing?.matching_chart as string) || '',
        yardage_confirm: (existing?.yardage_confirm as string) || '',
        // 생산
        fabric_order: (existing?.fabric_order as string) || '',
        fabric_ship: (existing?.fabric_ship as string) || '',
        fabric_inbound: (existing?.fabric_inbound as string) || '',
        cutting_start: (existing?.cutting_start as string) || '',
        sewing_start: (existing?.sewing_start as string) || '',
        sewing_complete: (existing?.sewing_complete as string) || '',
        finish_date: (existing?.finish_date as string) || '',
        shipping_date: (existing?.shipping_date as string) || '',
        // 입고
        inbound_1_date: (existing?.inbound_1_date as string) || inbound?.firstDate || null,
        inbound_1_qty: (existing?.inbound_1_qty as number) || totalInQty,
        inbound_2_date: (existing?.inbound_2_date as string) || null,
        inbound_2_qty: (existing?.inbound_2_qty as number) || 0,
        inbound_3_date: (existing?.inbound_3_date as string) || null,
        inbound_3_qty: (existing?.inbound_3_qty as number) || 0,
        inbound_4_date: (existing?.inbound_4_date as string) || null,
        inbound_4_qty: (existing?.inbound_4_qty as number) || 0,
        inbound_5_date: (existing?.inbound_5_date as string) || null,
        inbound_5_qty: (existing?.inbound_5_qty as number) || 0,
        expected_qty: totalInQty,
        expected_rate: receiveRate,
        remaining_qty: Math.max(0, poQty - totalInQty),
        // 원가
        expected_cost_val: Number(sf.PRECOST) || null,
        confirmed_cost: (existing?.confirmed_cost as number) || 0,
        confirmed_price: (existing?.confirmed_price as number) || 0,
        material_mix: (existing?.material_mix as string) || '',
        wash_code: (existing?.wash_code as string) || '',
      }
    })

    // 6. 필터 적용 — 발주미정(draft) 제외, 협력사에게는 발주확정 이상만 노출
    let filtered = allItems.filter(i => i.status !== 'draft')
    if (season) filtered = filtered.filter(i => i.season === season)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(i =>
        i.stylecd.toLowerCase().includes(q) ||
        i.stylenm.toLowerCase().includes(q)
      )
    }

    // 7. 상태별 요약 통계 + 필터 옵션 (전체 기준, 필터 전)
    const nonDraft = allItems.filter(i => i.status !== 'draft')
    const summary = { sent: 0, responded: 0, confirmed: 0, in_production: 0, completed: 0 }
    nonDraft.forEach(i => {
      const s = i.status as keyof typeof summary
      if (s in summary) summary[s]++
    })

    const uniqueSets = {
      seasons: Array.from(new Set(nonDraft.map(i => i.season).filter(Boolean))).sort(),
      brands: Array.from(new Set(nonDraft.map(i => i.brandcd).filter(Boolean))).sort(),
    }

    return NextResponse.json({
      orders: filtered,
      summary,
      uniqueSets,
    })
  } catch (err) {
    console.error('Vendor orders 조회 오류:', err)
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
