import { NextRequest, NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { supabaseAdmin } from '@/lib/supabase'
import { VALID_BRANDS } from '@/lib/constants'

// GET /api/srm — Snowflake 직접 조회 + Supabase 워크플로우 데이터 병합
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand = searchParams.get('brand')
  const sourcingMd = searchParams.get('sourcing_md')
  const vendor = searchParams.get('vendor')
  const season = searchParams.get('season')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const pono = searchParams.get('pono')
  const erpStatus = searchParams.get('erp_status')
  const year = searchParams.get('year') || '2026'

  const yearCode = year.length === 4 ? year.slice(2) : year

  // 브랜드 유효성 검증
  if (brand && brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const brandWhere = brand && brand !== 'all'
    ? `BRANDCD = '${brand}'`
    : BRAND_FILTER

  try {
    // 1. Snowflake: 발주 + 입고 데이터 병렬 조회
    const [orderData, inboundData] = await Promise.all([
      snowflakeQuery<{
        STYLECD: string; CHASU: string; COLORCD: string; COLORNM: string
        STYLENM: string; BRANDCD: string; ITEMNM: string; SEASONNM: string
        ORIGNNM: string; PRODNM: string; PONO: string; STATUSNM: string
        INPUTCLOSE: string; SALECLOSE: string
        ORDQTY: string; TAGPRICE: string; PRECOST: string
        DELIDT: string; DUEDATE: string; ORDDT: string
      }>(`
        SELECT STYLECD, CHASU, COLORCD, MAX(COLORNM) AS COLORNM,
               MAX(STYLENM) AS STYLENM, BRANDCD, MAX(ITEMNM) AS ITEMNM,
               MAX(SEASONNM) AS SEASONNM, MAX(ORIGNNM) AS ORIGNNM,
               MAX(PRODNM) AS PRODNM, MAX(PONO) AS PONO,
               MAX(STATUSNM) AS STATUSNM,
               MAX(INPUTCLOSE) AS INPUTCLOSE,
               MAX(SALECLOSE) AS SALECLOSE,
               SUM(ORDQTY) AS ORDQTY,
               MAX(TAGPRICE) AS TAGPRICE, MAX(PRECOST) AS PRECOST,
               MAX(COALESCE(DELIDT, DUEDATE)) AS DELIDT,
               MAX(DUEDATE) AS DUEDATE,
               MIN(ORDDT) AS ORDDT
        FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
        WHERE ${brandWhere} AND YEARCD = '${yearCode}'
        GROUP BY STYLECD, CHASU, COLORCD, BRANDCD
        ORDER BY STYLECD, CHASU, COLORCD
      `),

      snowflakeQuery<{
        STYLECD: string; COLORCD: string
        TOTAL_INQTY: string
        FIRST_WHINDT: string; LAST_WHINDT: string
        WHNM: string
      }>(`
        SELECT STYLECD, COLORCD,
               SUM(INQTY) AS TOTAL_INQTY,
               MIN(WHINDT) AS FIRST_WHINDT,
               MAX(WHINDT) AS LAST_WHINDT,
               MAX(WHNM) AS WHNM
        FROM BCAVE.SEWON.SW_WHININFO
        WHERE STYLECD IN (
          SELECT DISTINCT STYLECD FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
          WHERE ${brandWhere} AND YEARCD = '${yearCode}'
        )
        AND WHINGBNM = '입고'
        GROUP BY STYLECD, COLORCD
      `),
    ])

    // 2. Supabase: 기존 워크플로우 데이터 (수동 입력 필드 병합용)
    const { data: srmRows } = await supabaseAdmin
      .from('srm_production')
      .select('*')

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

    // 4. 스타일+컬러별 총 발주수량 (입고율 계산용)
    const styleColorOrderQty = new Map<string, number>()
    orderData.forEach(sf => {
      const key = `${sf.STYLECD}_${sf.COLORCD}`
      styleColorOrderQty.set(key, (styleColorOrderQty.get(key) || 0) + (Number(sf.ORDQTY) || 0))
    })

    // 5. 데이터 병합: Snowflake 기준 + Supabase 워크플로우 오버레이
    const allItems = orderData.map((sf, idx) => {
      const key = `${sf.STYLECD}_${sf.CHASU || '01'}_${sf.COLORCD}`
      const existing = srmMap.get(key)
      const inbound = inboundMap.get(`${sf.STYLECD}_${sf.COLORCD}`)

      const poQty = Number(sf.ORDQTY) || 0
      const totalOrderQty = styleColorOrderQty.get(`${sf.STYLECD}_${sf.COLORCD}`) || poQty
      const totalInQty = inbound?.qty || 0
      const receiveRate = totalOrderQty > 0 ? Math.round((totalInQty / totalOrderQty) * 100) : 0

      // 상태 결정: ERP INPUTCLOSE/STATUSNM 우선 → Supabase 워크플로우 → 데이터 추정
      let itemStatus: string
      let isClosed = false
      const isInputClosed = sf.INPUTCLOSE === 'Y'
      const isUnordered = sf.STATUSNM === '발주미정'

      if (existing && !['draft'].includes(existing.status as string)) {
        itemStatus = existing.status as string
        isClosed = (existing.is_closed as boolean) || isInputClosed
      } else if (isInputClosed || receiveRate >= 100) {
        itemStatus = 'completed'
        isClosed = true
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
        input_close: sf.INPUTCLOSE || 'N',
        sale_close: sf.SALECLOSE || 'N',
        whnm: inbound?.whnm || '',
        po_qty: poQty,
        expected_cost: Number(sf.PRECOST) || null,
        confirmed_due: fmt(sf.DELIDT || sf.DUEDATE || ''),
        order_date: fmt(sf.ORDDT || ''),
        vendor: (existing?.vendor as string) || sf.PRODNM || '',
        status: itemStatus,
        is_closed: isClosed,
        // 입고 데이터 (Snowflake)
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
        // Supabase 워크플로우 필드 (수동 입력)
        sourcing_md: (existing?.sourcing_md as string) || '',
        delivery: (existing?.delivery as string) || '',
        order_type: (existing?.order_type as string) || '',
        item_category: (existing?.item_category as string) || '',
        color_qty: (existing?.color_qty as number) || 0,
        remark: (existing?.remark as string) || '',
        sent_at: (existing?.sent_at as string) || '',
        vendor_response: existing?.vendor_response || null,
        vendor_responded_at: (existing?.vendor_responded_at as string) || '',
        confirmed_at: (existing?.confirmed_at as string) || '',
        confirmed_by: (existing?.confirmed_by as string) || '',
        md_comment: (existing?.md_comment as string) || '',
        last_vendor_update_at: (existing?.last_vendor_update_at as string) || '',
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
        // 원가
        confirmed_cost: (existing?.confirmed_cost as number) || 0,
        confirmed_price: (existing?.confirmed_price as number) || 0,
        material_mix: (existing?.material_mix as string) || '',
        wash_code: (existing?.wash_code as string) || '',
        created_at: (existing?.created_at as string) || '',
        updated_at: (existing?.updated_at as string) || '',
      }
    })

    // 6. 추가 필터 적용 (Supabase 필드 기반)
    let filtered = allItems
    if (season) filtered = filtered.filter(i => i.season === season)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(i =>
        i.stylecd.toLowerCase().includes(q) ||
        i.stylenm.toLowerCase().includes(q) ||
        i.vendor.toLowerCase().includes(q)
      )
    }
    if (status) filtered = filtered.filter(i => i.status === status)
    if (vendor) filtered = filtered.filter(i => i.vendor === vendor)
    if (sourcingMd) filtered = filtered.filter(i => i.sourcing_md === sourcingMd)
    if (pono) filtered = filtered.filter(i => i.pono === pono)
    if (erpStatus) filtered = filtered.filter(i => i.erp_status === erpStatus)

    // 7. 상태별 통계 (필터 전 전체 기준)
    const stats: Record<string, number> = {
      total: 0, draft: 0, sent: 0, responded: 0,
      confirmed: 0, in_production: 0, completed: 0,
    }
    allItems.forEach(i => {
      stats.total++
      if (i.status in stats) stats[i.status]++
    })

    // 8. 유니크 필터 옵션 (전체 기준 — 필터된 결과가 아님)
    const uniqueSets = {
      seasons: [...new Set(allItems.map(i => i.season).filter(Boolean))].sort(),
      vendors: [...new Set(allItems.map(i => i.vendor).filter(Boolean))].sort(),
      mds: [...new Set(allItems.map(i => i.sourcing_md).filter(Boolean))].sort(),
      ponos: [...new Set(allItems.map(i => i.pono).filter(Boolean))].sort(),
      erpStatuses: [...new Set(allItems.map(i => i.erp_status).filter(Boolean))].sort(),
    }

    return NextResponse.json({
      data: filtered,
      total: filtered.length,
      page: 1,
      limit: filtered.length,
      stats,
      statusStats: stats,
      uniqueSets,
    })
  } catch (err: unknown) {
    console.error('SRM 조회 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/srm — 생산 레코드 생성/업서트 (엑셀 업로드용, 기본 status='draft')
export async function POST(req: Request) {
  const body = await req.json()
  const items: Record<string, unknown>[] = Array.isArray(body) ? body : [body]

  if (items.length === 0) {
    return NextResponse.json({ error: '데이터가 비어있습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('srm_production')
    .upsert(
      items.map((item) => ({
        status: 'draft',
        ...item,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'stylecd,chasu,colorcd' }
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: items.length }, { status: 201 })
}
