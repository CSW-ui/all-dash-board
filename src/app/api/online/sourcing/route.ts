import { NextRequest, NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { VALID_BRANDS } from '@/lib/constants'

// 소싱 현황 조회: Snowflake(발주/입고) + Supabase(수동입력) 병합
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const brand = searchParams.get('brand') || 'all'
    const rawYear = searchParams.get('year') || '2026'
    const year = rawYear.length === 4 ? rawYear.slice(2) : rawYear

    // 브랜드 유효성 검증 (SQL 인젝션 방지)
    if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
      return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
    }

    const brandWhere = brand !== 'all' ? `BRANDCD = '${brand}'` : `BRANDCD IN ('CO','WA','LE','CK','LK')`
    const season = searchParams.get('season') || ''
    const seasonWhere = season ? `AND SEASONNM = '${season}'` : ''

    // 1. Snowflake: 발주 데이터 (스타일+컬러 단위)
    const [orderData, inboundData] = await Promise.all([
      snowflakeQuery<{
        STYLECD: string; STYLENM: string; BRANDCD: string; COLORCD: string;
        COLORNM: string; ITEMNM: string; SEASONNM: string; ORIGNNM: string; PRODNM: string;
        CHASU_CNT: string; TOTAL_ORDQTY: string; TAGPRICE: string; PRECOST: string;
        FIRST_DELIDT: string; LAST_DELIDT: string;
      }>(`
        SELECT STYLECD, STYLENM, BRANDCD, COLORCD, COLORNM, ITEMNM, MAX(SEASONNM) AS SEASONNM,
               MAX(ORIGNNM) AS ORIGNNM, MAX(PRODNM) AS PRODNM,
               COUNT(DISTINCT CHASU) AS CHASU_CNT,
               SUM(ORDQTY) AS TOTAL_ORDQTY,
               MAX(TAGPRICE) AS TAGPRICE, MAX(PRECOST) AS PRECOST,
               MIN(COALESCE(DELIDT, DUEDATE)) AS FIRST_DELIDT, MAX(COALESCE(DELIDT, DUEDATE)) AS LAST_DELIDT
        FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
        WHERE ${brandWhere} AND YEARCD = '${year}' ${seasonWhere}
        GROUP BY STYLECD, STYLENM, BRANDCD, COLORCD, COLORNM, ITEMNM
        ORDER BY STYLECD, COLORCD
      `),

      // 2. Snowflake: 입고 데이터 (스타일+컬러 단위)
      snowflakeQuery<{
        STYLECD: string; COLORCD: string; TOTAL_INQTY: string;
        FIRST_WHINDT: string; LAST_WHINDT: string;
      }>(`
        SELECT STYLECD, COLORCD,
               SUM(INQTY) AS TOTAL_INQTY,
               MIN(WHINDT) AS FIRST_WHINDT,
               MAX(WHINDT) AS LAST_WHINDT
        FROM BCAVE.SEWON.SW_WHININFO
        WHERE STYLECD IN (
          SELECT DISTINCT STYLECD FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
          WHERE ${brandWhere} AND YEARCD = '${year}' ${seasonWhere}
        )
        AND WHINGBNM = '입고'
        GROUP BY STYLECD, COLORCD
      `),
    ])

    // 입고 맵
    const inboundMap = new Map<string, { qty: number; firstDate: string; lastDate: string }>()
    inboundData.forEach(r => {
      // YYYYMMDD → YYYY-MM-DD 변환
      const fmt = (d: string) => d && d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d
      inboundMap.set(`${r.STYLECD}_${r.COLORCD}`, {
        qty: Number(r.TOTAL_INQTY) || 0,
        firstDate: fmt(r.FIRST_WHINDT || ''),
        lastDate: fmt(r.LAST_WHINDT || ''),
      })
    })

    // 3. Supabase: 소싱팀 수동입력 데이터
    let manualData: Record<string, unknown>[] | null = null
    try {
      const supabase = createSupabaseServerClient()
      const { data, error } = await supabase.from('sourcing_status').select('*')
      if (!error) manualData = data
    } catch { /* 테이블 없으면 무시 */ }

    const manualMap = new Map<string, Record<string, unknown>>()
    manualData?.forEach(m => {
      manualMap.set(`${m.stylecd}_${m.colorcd}_${m.brandcd}`, m)
    })

    // 4. 병합
    const items = orderData.map(sf => {
      const key = `${sf.STYLECD}_${sf.COLORCD}`
      const inbound = inboundMap.get(key)
      const manual = manualMap.get(`${sf.STYLECD}_${sf.COLORCD}_${sf.BRANDCD}`)

      const orderQty = Number(sf.TOTAL_ORDQTY) || 0
      const receivedQty = inbound?.qty || 0
      const receiveRate = orderQty > 0 ? Math.round((receivedQty / orderQty) * 100) : 0

      // 진행 단계 (수동입력 기반)
      const steps = [
        manual?.fabric_in, manual?.cutting_done, manual?.sewing_done,
        manual?.production_done, manual?.shipped, manual?.received
      ].map(Boolean)
      const completedSteps = steps.filter(Boolean).length
      const progress = Math.round((completedSteps / 6) * 100)

      let stage = '대기'
      if (manual?.received || receiveRate >= 100) stage = '입고완료'
      else if (manual?.shipped) stage = '선적'
      else if (manual?.production_done) stage = '완성'
      else if (manual?.sewing_done) stage = '봉제완료'
      else if (manual?.cutting_done) stage = '재단완료'
      else if (manual?.fabric_in) stage = '원단입고'

      // DELIDT 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
      const fmt = (d: string) => d && d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : ''

      return {
        // Snowflake 자동
        stylecd: sf.STYLECD,
        stylenm: sf.STYLENM,
        brandcd: sf.BRANDCD,
        colorcd: sf.COLORCD,
        colornm: sf.COLORNM,
        itemnm: sf.ITEMNM,
        seasonnm: sf.SEASONNM,
        orignnm: sf.ORIGNNM,
        prodnm: sf.PRODNM,
        chasuCnt: Number(sf.CHASU_CNT) || 1,
        firstDelidt: fmt(sf.FIRST_DELIDT || ''),
        lastDelidt: fmt(sf.LAST_DELIDT || ''),
        tagprice: Number(sf.TAGPRICE) || 0,
        precost: Number(sf.PRECOST) || 0,
        orderQty,
        receivedQty,
        receiveRate,
        firstInboundDate: inbound?.firstDate || '',
        lastInboundDate: inbound?.lastDate || '',
        // Supabase 수동 (기본값: ERP 최종 납기일)
        confirmedDueDate: (manual?.confirmed_due_date as string) || fmt(sf.LAST_DELIDT || ''),
        photoSampleDate: (manual?.photo_sample_date as string) || '',
        sampleDeliveryDate: (manual?.sample_arrival_date as string) || '',
        delayDays: (manual?.delay_days as number) || 0,
        delivery: (manual?.delivery as string) || '',
        sourcingMd: (manual?.sourcing_md as string) || '',
        vendor: (manual?.vendor as string) || sf.PRODNM || '',
        country: (manual?.country as string) || sf.ORIGNNM || '',
        materialMix: (manual?.material_mix as string) || '',
        washCode: (manual?.wash_code as string) || '',
        remark: (manual?.remark as string) || '',
        isClosed: manual?.is_closed || false,
        // 계산
        progress,
        stage,
        hasManual: !!manual,
      }
    })

    // 요약
    const summary = {
      total: items.length,
      waiting: items.filter(i => i.stage === '대기').length,
      inProgress: items.filter(i => !['대기', '입고완료'].includes(i.stage)).length,
      received: items.filter(i => i.stage === '입고완료').length,
      sampleReady: items.filter(i => i.photoSampleDate).length,
      delayed: items.filter(i => i.delayDays > 0).length,
    }

    return NextResponse.json({ items, summary })
  } catch (err: unknown) {
    console.error('소싱 현황 조회 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// 소싱 수동입력 대량 등록/업데이트
export async function PUT(req: NextRequest) {
  try {
    const { items } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '데이터 없음' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    let success = 0, fail = 0

    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50)
      const { error } = await supabase
        .from('sourcing_status')
        .upsert(batch, { onConflict: 'stylecd,colorcd,brandcd' })

      if (error) {
        console.error('소싱 upsert error:', error.message)
        fail += batch.length
      } else {
        success += batch.length
      }
    }

    return NextResponse.json({ success, fail, total: items.length })
  } catch (err: unknown) {
    console.error('소싱 등록 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
