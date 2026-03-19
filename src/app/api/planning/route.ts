import { NextResponse } from 'next/server'
import { snowflakeQuery } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'

// GET /api/planning?brand=CO&year=26&season=봄,여름
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand   = searchParams.get('brand') || 'all'

  // 브랜드 유효성 검증 (SQL 인젝션 방지)
  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  const year    = searchParams.get('year') || '26'
  const seasons = searchParams.get('season')?.split(',') || ['봄', '여름']

  const siBrandClause = brand === 'all'
    ? `si.BRANDCD IN ('CO','WA','LE','CK','LK')`
    : `si.BRANDCD = '${brand}'`
  const vBrandClause = brand === 'all'
    ? `v.BRANDCD IN ('CO','WA','LE','CK','LK')`
    : `v.BRANDCD = '${brand}'`

  const toDt = searchParams.get('toDt') || ''  // YYYYMMDD, 비어있으면 제한 없음

  const seasonList = seasons.map(s => `'${s}'`).join(',')
  const saleDateFrom = `20${year}0101`
  const saleDateTo = toDt ? `AND v.SALEDT <= '${toDt}'` : ''
  const saleDateToSub = toDt ? `AND SALEDT <= '${toDt}'` : ''

  // 주간 날짜 계산 (전주 마감 기준)
  const today = new Date()
  const dow = today.getDay()
  const lastSun = new Date(today); lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
  const cwEnd = lastSun
  const cwStart = new Date(lastSun); cwStart.setDate(cwStart.getDate() - 6)
  const pwEnd = new Date(cwStart); pwEnd.setDate(pwEnd.getDate() - 1)
  const pwStart = new Date(pwEnd); pwStart.setDate(pwStart.getDate() - 6)
  const fD = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const cwS = fD(cwStart); const cwE = fD(cwEnd); const pwS = fD(pwStart); const pwE = fD(pwEnd)

  try {
    const [itemSummary, orderByItem, inboundByItem, salesByItem, shopInvByItem, whInvByItem, channelSales] = await Promise.all([
      // 1. 품목별 스타일 마스터
      snowflakeQuery<{
        ITEMNM: string; STYLE_CNT: number; AVG_TAG: number; AVG_COST: number
      }>(`
        SELECT si.ITEMNM,
          COUNT(DISTINCT si.STYLECD) as STYLE_CNT,
          AVG(si.TAGPRICE) as AVG_TAG,
          AVG(si.PRODCOST) as AVG_COST
        FROM BCAVE.SEWON.SW_STYLEINFO si
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
        ORDER BY STYLE_CNT DESC
      `),

      // 1-1. 발주 데이터 (SW_STYLEINFO_DETAIL): 발주수량, 발주금액(택가), 발주원가
      snowflakeQuery<{
        ITEMNM: string; ORD_QTY: number; ORD_TAG_AMT: number; ORD_COST_AMT: number
      }>(`
        SELECT d.ITEMNM,
          SUM(d.ORDQTY) as ORD_QTY,
          SUM(d.ORDQTY * d.TAGPRICE) as ORD_TAG_AMT,
          SUM(d.ORDQTY * d.PRECOST) as ORD_COST_AMT
        FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL d
        WHERE d.BRANDCD IN (${brand === 'all' ? "'CO','WA','LE','CK','LK'" : `'${brand}'`})
          AND d.YEARCD = '${year}'
          AND d.SEASONNM IN (${seasonList})
        GROUP BY d.ITEMNM
      `),

      // 1-2. 입고 데이터 (SW_WHININFO): 입고수량, 입고금액
      snowflakeQuery<{
        ITEMNM: string; IN_QTY: number; IN_AMT: number
      }>(`
        SELECT si.ITEMNM,
          SUM(w.INQTY) as IN_QTY,
          SUM(w.INQTY * w.INPRICE) as IN_AMT
        FROM BCAVE.SEWON.SW_WHININFO w
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON w.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 2. 품목별 판매 실적 + 주간 실적
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(v.SALEQTY) as SALE_QTY,
          SUM(v.SALEAMT_VAT_EX) as SALE_AMT,
          SUM(v.TAGPRICE * v.SALEQTY) as TAG_AMT,
          SUM(v.SALEPRICE * v.SALEQTY) as SALE_PRICE_AMT,
          SUM(COALESCE(si.PRODCOST, 0) * v.SALEQTY) as COST_AMT,
          SUM(CASE WHEN v.SALEDT BETWEEN '${cwS}' AND '${cwE}' THEN v.SALEAMT_VAT_EX ELSE 0 END) as CW_AMT,
          SUM(CASE WHEN v.SALEDT BETWEEN '${pwS}' AND '${pwE}' THEN v.SALEAMT_VAT_EX ELSE 0 END) as PW_AMT,
          SUM(CASE WHEN v.SALEDT BETWEEN '${cwS}' AND '${cwE}' THEN v.SALEQTY ELSE 0 END) as CW_QTY,
          SUM(CASE WHEN v.SALEDT BETWEEN '${cwS}' AND '${cwE}' THEN COALESCE(si.PRODCOST, 0) * v.SALEQTY ELSE 0 END) as CW_COST
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${vBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
          AND v.SALEDT >= '${saleDateFrom}'
          ${saleDateTo}
        GROUP BY si.ITEMNM
      `),

      // 3. 품목별 매장 재고
      snowflakeQuery<{
        ITEMNM: string; SHOP_INV: number; SHOP_AVAIL: number
      }>(`
        SELECT si.ITEMNM,
          SUM(inv.INVQTY) as SHOP_INV,
          SUM(inv.AVAILQTY) as SHOP_AVAIL
        FROM BCAVE.SEWON.SW_SHOPINV inv
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON inv.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 4. 품목별 창고 재고
      snowflakeQuery<{
        ITEMNM: string; WH_AVAIL: number; WH_ONLINE: number; WH_OFFLINE: number
      }>(`
        SELECT si.ITEMNM,
          SUM(wh.AVAILQTY) as WH_AVAIL,
          SUM(wh.ONLINEQTY) as WH_ONLINE,
          SUM(wh.OFFLINEQTY) as WH_OFFLINE
        FROM BCAVE.SEWON.SW_WHINV wh
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON wh.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 5. 채널별 판매 비중
      snowflakeQuery<{
        SHOPTYPENM: string; SALE_QTY: number; SALE_AMT: number
      }>(`
        SELECT v.SHOPTYPENM,
          SUM(v.SALEQTY) as SALE_QTY,
          SUM(v.SALEAMT_VAT_EX) as SALE_AMT
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD
        WHERE ${vBrandClause}
          AND si.YEARCD = '${year}'
          AND si.SEASONNM IN (${seasonList})
          AND v.SALEDT >= '${saleDateFrom}'
          ${saleDateTo}
        GROUP BY v.SHOPTYPENM
        ORDER BY SALE_AMT DESC
      `),
    ])

    // 품목별 데이터 조합
    const orderMap = new Map(orderByItem.map(r => [r.ITEMNM, r]))
    const inboundMap = new Map(inboundByItem.map(r => [r.ITEMNM, r]))
    const salesMap = new Map(salesByItem.map(r => [r.ITEMNM as string, r]))
    const shopInvMap = new Map(shopInvByItem.map(r => [r.ITEMNM, r]))
    const whInvMap = new Map(whInvByItem.map(r => [r.ITEMNM, r]))

    const items = itemSummary.map(item => {
      const order = orderMap.get(item.ITEMNM)
      const inbound = inboundMap.get(item.ITEMNM)
      const sales = salesMap.get(item.ITEMNM)
      const shopInv = shopInvMap.get(item.ITEMNM)
      const whInv = whInvMap.get(item.ITEMNM)

      // 발주 (기획)
      const ordQty = Number(order?.ORD_QTY || 0)
      const ordTagAmt = Number(order?.ORD_TAG_AMT || 0)
      const ordCostAmt = Number(order?.ORD_COST_AMT || 0)
      // 입고
      const inQty = Number(inbound?.IN_QTY || 0)
      const inAmt = Number(inbound?.IN_AMT || 0)
      // 판매
      const saleQty = Number(sales?.SALE_QTY || 0)
      const saleAmt = Number(sales?.SALE_AMT || 0)
      const tagAmt = Number(sales?.TAG_AMT || 0)
      const salePriceAmt = Number(sales?.SALE_PRICE_AMT || 0)
      const costAmt = Number(sales?.COST_AMT || 0)
      const cwAmt = Number(sales?.CW_AMT || 0)
      const pwAmt = Number(sales?.PW_AMT || 0)
      const cwQty = Number(sales?.CW_QTY || 0)
      const cwCost = Number(sales?.CW_COST || 0)
      // 재고
      const shopInvQty = Number(shopInv?.SHOP_INV || 0)
      const shopAvailQty = Number(shopInv?.SHOP_AVAIL || 0)
      const whAvailQty = Number(whInv?.WH_AVAIL || 0)
      const totalInv = shopInvQty + whAvailQty
      // 소진율: 판매수량 / 발주수량
      const sellThrough = ordQty > 0 ? (saleQty / ordQty) * 100 : 0
      const avgTag = Math.round(Number(item.AVG_TAG))
      const dcRate = tagAmt > 0 ? (1 - salePriceAmt / tagAmt) * 100 : 0
      const cogsRate = saleAmt > 0 ? (costAmt / saleAmt) * 100 : 0
      // 입고율: 입고수량 / 발주수량
      const inboundRate = ordQty > 0 ? (inQty / ordQty) * 100 : 0

      return {
        item: item.ITEMNM,
        styleCnt: Number(item.STYLE_CNT),
        avgTag,
        avgCost: Math.round(Number(item.AVG_COST)),
        ordQty,        // 발주수량
        ordTagAmt,     // 발주금액 (택가)
        ordCostAmt,    // 발주원가
        inQty,         // 입고수량
        inAmt,         // 입고금액
        inboundRate: Math.round(inboundRate * 10) / 10,  // 입고율
        saleQty,
        saleAmt,
        tagAmt,
        salePriceAmt,
        costAmt,
        dcRate: Math.round(dcRate * 10) / 10,
        cogsRate: Math.round(cogsRate * 10) / 10,
        cwAmt, pwAmt, cwQty, cwCost,
        cwCogsRate: cwAmt > 0 ? Math.round(cwCost / cwAmt * 1000) / 10 : 0,
        wow: pwAmt > 0 ? Math.round((cwAmt - pwAmt) / pwAmt * 1000) / 10 : 0,
        shopInv: shopInvQty,
        shopAvail: shopAvailQty,
        whAvail: whAvailQty,
        totalInv,
        sellThrough: Math.round(sellThrough * 10) / 10,
      }
    })

    // KPI 집계
    const totalStyles = items.reduce((s, i) => s + i.styleCnt, 0)
    const totalOrdQty = items.reduce((s, i) => s + i.ordQty, 0)
    const totalOrdTagAmt = items.reduce((s, i) => s + i.ordTagAmt, 0)
    const totalInQty = items.reduce((s, i) => s + i.inQty, 0)
    const totalInAmt = items.reduce((s, i) => s + i.inAmt, 0)
    const totalSaleAmt = items.reduce((s, i) => s + i.saleAmt, 0)
    const totalSaleQty = items.reduce((s, i) => s + i.saleQty, 0)
    const totalInvQty = items.reduce((s, i) => s + i.totalInv, 0)
    const totalCostAmt = items.reduce((s, i) => s + i.costAmt, 0)
    const totalSaleTagAmt = items.reduce((s, i) => s + i.tagAmt, 0)
    const totalSalePriceAmt = items.reduce((s, i) => s + i.salePriceAmt, 0)
    const overallSellThrough = totalOrdQty > 0
      ? Math.round((totalSaleQty / totalOrdQty) * 1000) / 10 : 0
    const overallInboundRate = totalOrdQty > 0
      ? Math.round((totalInQty / totalOrdQty) * 1000) / 10 : 0
    const overallDcRate = totalSaleTagAmt > 0
      ? Math.round((1 - totalSalePriceAmt / totalSaleTagAmt) * 1000) / 10 : 0
    const overallCogsRate = totalSaleAmt > 0
      ? Math.round((totalCostAmt / totalSaleAmt) * 1000) / 10 : 0

    const channels = channelSales.map(c => ({
      channel: c.SHOPTYPENM,
      qty: Number(c.SALE_QTY),
      amt: Number(c.SALE_AMT),
    }))

    return NextResponse.json({
      kpi: {
        totalStyles,
        totalOrdQty, totalOrdTagAmt,
        totalInQty, totalInAmt,
        totalSaleAmt, totalSaleQty,
        totalInvQty, totalCostAmt,
        sellThrough: overallSellThrough,
        inboundRate: overallInboundRate,
        dcRate: overallDcRate,
        cogsRate: overallCogsRate,
      },
      items,
      channels,
    })
  } catch (err) {
    console.error('Planning API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
