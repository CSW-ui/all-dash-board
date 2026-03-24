import { NextResponse } from 'next/server'
import { snowflakeQuery } from '@/lib/snowflake'
import { VALID_BRANDS, ITEM_CATEGORY_MAP } from '@/lib/constants'

// 입판재현황 API: 입고·판매·재고를 품목별·차수별로 상세 집계
// 이월 매출 포함: 해당 시즌 외 상품(이전 시즌)이 기간 내 판매된 실적
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get('brand') || 'all'
  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  const year = searchParams.get('year') || '26'
  const seasons = searchParams.get('season')?.split(',') || ['봄', '여름']
  // 기간 필터 (YYYYMMDD)
  const fromDt = searchParams.get('fromDt') || `20${year}0101`
  const toDt = searchParams.get('toDt') || '' // 비어있으면 제한 없음

  const siBrandClause = brand === 'all'
    ? `si.BRANDCD IN ('CO','WA','LE','CK','LK')` : `si.BRANDCD = '${brand}'`
  const vBrandClause = brand === 'all'
    ? `v.BRANDCD IN ('CO','WA','LE','CK','LK')` : `v.BRANDCD = '${brand}'`

  const seasonList = seasons.map(s => `'${s}'`).join(',')
  const saleDateClause = toDt
    ? `AND v.SALEDT BETWEEN '${fromDt}' AND '${toDt}'`
    : `AND v.SALEDT >= '${fromDt}'`

  // 이월 시즌: 현재 시즌이 아닌 이전 시즌
  const prevYear = String(Number(year) - 1)

  const onlineChannels = `'온라인(무신사)','온라인(위탁몰)','온라인(자사몰)','온라인B2B'`

  try {
    const [orderData, inboundData, salesData, salesOnlineData, invData, whInvData, carryoverSalesData, carryoverOnlineData] = await Promise.all([
      // 1. 발주 데이터: 품목별·차수별
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(d.ORDQTY) as ORD_QTY,
          SUM(d.ORDQTY * d.TAGPRICE) as ORD_TAG_AMT,
          SUM(d.ORDQTY * d.PRECOST) as ORD_COST_AMT,
          COUNT(DISTINCT d.STYLECD) as ST_CNT,
          COUNT(DISTINCT d.STYLECD || '-' || d.COLORCD) as STCL_CNT,
          SUM(CASE WHEN d.CHASU = '01' THEN d.ORDQTY ELSE 0 END) as ORD_QTY_1ST,
          SUM(CASE WHEN d.CHASU = '01' THEN d.ORDQTY * d.TAGPRICE ELSE 0 END) as ORD_TAG_1ST,
          SUM(CASE WHEN d.CHASU = '01' THEN d.ORDQTY * d.PRECOST ELSE 0 END) as ORD_COST_1ST,
          COUNT(DISTINCT CASE WHEN d.CHASU = '01' THEN d.STYLECD END) as ST_CNT_1ST,
          COUNT(DISTINCT CASE WHEN d.CHASU = '01' THEN d.STYLECD || '-' || d.COLORCD END) as STCL_CNT_1ST,
          SUM(CASE WHEN d.CHASU != '01' THEN d.ORDQTY ELSE 0 END) as ORD_QTY_QR,
          SUM(CASE WHEN d.CHASU != '01' THEN d.ORDQTY * d.TAGPRICE ELSE 0 END) as ORD_TAG_QR,
          SUM(CASE WHEN d.CHASU != '01' THEN d.ORDQTY * d.PRECOST ELSE 0 END) as ORD_COST_QR,
          COUNT(DISTINCT CASE WHEN d.CHASU != '01' THEN d.STYLECD END) as ST_CNT_QR,
          COUNT(DISTINCT CASE WHEN d.CHASU != '01' THEN d.STYLECD || '-' || d.COLORCD END) as STCL_CNT_QR
        FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL d
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON d.STYLECD = si.STYLECD AND d.BRANDCD = si.BRANDCD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 2. 입고 데이터
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(w.INQTY) as IN_QTY,
          SUM(w.INQTY * w.INPRICE) as IN_AMT
        FROM BCAVE.SEWON.SW_WHININFO w
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON w.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 3. 당시즌 판매 (기간 필터 적용)
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(v.SALEQTY) as SALE_QTY,
          SUM(v.SALEAMT_VAT_EX) as SALE_AMT,
          SUM(v.TAGPRICE * v.SALEQTY) as TAG_AMT,
          SUM(v.SALEPRICE * v.SALEQTY) as SALE_PRICE_AMT,
          SUM(COALESCE(si.PRODCOST, 0) * v.SALEQTY) as COST_AMT
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${vBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
          ${saleDateClause}
        GROUP BY si.ITEMNM
      `),

      // 4. 당시즌 온라인 판매
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(v.SALEQTY) as SALE_QTY_OL,
          SUM(v.SALEAMT_VAT_EX) as SALE_AMT_OL,
          SUM(v.TAGPRICE * v.SALEQTY) as TAG_AMT_OL,
          SUM(v.SALEPRICE * v.SALEQTY) as SALE_PRICE_AMT_OL,
          SUM(COALESCE(si.PRODCOST, 0) * v.SALEQTY) as COST_AMT_OL
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${vBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
          ${saleDateClause}
          AND v.SHOPTYPENM IN (${onlineChannels})
        GROUP BY si.ITEMNM
      `),

      // 5. 매장 재고
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          COUNT(DISTINCT inv.STYLECD) as INV_ST_CNT,
          COUNT(DISTINCT inv.STYLECD || '-' || COALESCE(inv.COLORCD, '')) as INV_STCL_CNT,
          SUM(inv.INVQTY) as SHOP_INV_QTY
        FROM BCAVE.SEWON.SW_SHOPINV inv
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON inv.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 6. 창고 재고
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(wh.AVAILQTY) as WH_AVAIL
        FROM BCAVE.SEWON.SW_WHINV wh
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON wh.STYLECD = si.STYLECD
        WHERE ${siBrandClause}
          AND si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList})
        GROUP BY si.ITEMNM
      `),

      // 7. 이월 매출: 이전 시즌 상품이 현재 기간에 판매된 실적 (품목별)
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(v.SALEQTY) as CO_SALE_QTY,
          SUM(v.SALEAMT_VAT_EX) as CO_SALE_AMT,
          SUM(v.TAGPRICE * v.SALEQTY) as CO_TAG_AMT,
          SUM(v.SALEPRICE * v.SALEQTY) as CO_SALE_PRICE_AMT,
          SUM(COALESCE(si.PRODCOST, 0) * v.SALEQTY) as CO_COST_AMT,
          COUNT(DISTINCT si.STYLECD) as CO_ST_CNT,
          COUNT(DISTINCT si.STYLECD) as CO_STCL_CNT
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${vBrandClause}
          AND NOT (si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList}))
          ${saleDateClause}
        GROUP BY si.ITEMNM
      `),

      // 8. 이월 온라인 매출
      snowflakeQuery<Record<string, string>>(`
        SELECT si.ITEMNM,
          SUM(v.SALEAMT_VAT_EX) as CO_SALE_AMT_OL
        FROM BCAVE.SEWON.VW_SALES_VAT v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${vBrandClause}
          AND NOT (si.YEARCD = '${year}' AND si.SEASONNM IN (${seasonList}))
          ${saleDateClause}
          AND v.SHOPTYPENM IN (${onlineChannels})
        GROUP BY si.ITEMNM
      `),
    ])

    const orderMap = new Map(orderData.map(r => [r.ITEMNM, r]))
    const inboundMap = new Map(inboundData.map(r => [r.ITEMNM, r]))
    const salesMap = new Map(salesData.map(r => [r.ITEMNM, r]))
    const salesOlMap = new Map(salesOnlineData.map(r => [r.ITEMNM, r]))
    const invMap = new Map(invData.map(r => [r.ITEMNM, r]))
    const whMap = new Map(whInvData.map(r => [r.ITEMNM, r]))
    const coMap = new Map(carryoverSalesData.map(r => [r.ITEMNM, r]))
    const coOlMap = new Map(carryoverOnlineData.map(r => [r.ITEMNM, r]))

    // 모든 품목 수집
    const allItems = new Set<string>()
    orderData.forEach(r => allItems.add(r.ITEMNM as string))
    salesData.forEach(r => allItems.add(r.ITEMNM as string))
    invData.forEach(r => allItems.add(r.ITEMNM as string))
    carryoverSalesData.forEach(r => allItems.add(r.ITEMNM as string))

    const N = (v: string | undefined | null) => Number(v || 0)

    const items = Array.from(allItems).map(itemNm => {
      const o = orderMap.get(itemNm)
      const ib = inboundMap.get(itemNm)
      const s = salesMap.get(itemNm)
      const sol = salesOlMap.get(itemNm)
      const iv = invMap.get(itemNm)
      const wh = whMap.get(itemNm)
      const co = coMap.get(itemNm)
      const coOl = coOlMap.get(itemNm)
      const category = ITEM_CATEGORY_MAP[itemNm] || '기타'

      // 발주
      const ordQty = N(o?.ORD_QTY); const ordTagAmt = N(o?.ORD_TAG_AMT); const ordCostAmt = N(o?.ORD_COST_AMT)
      const stCnt = N(o?.ST_CNT); const stclCnt = N(o?.STCL_CNT)
      const ordQty1st = N(o?.ORD_QTY_1ST); const ordTag1st = N(o?.ORD_TAG_1ST); const ordCost1st = N(o?.ORD_COST_1ST)
      const stCnt1st = N(o?.ST_CNT_1ST); const stclCnt1st = N(o?.STCL_CNT_1ST)
      const ordQtyQR = N(o?.ORD_QTY_QR); const ordTagQR = N(o?.ORD_TAG_QR); const ordCostQR = N(o?.ORD_COST_QR)
      const stCntQR = N(o?.ST_CNT_QR); const stclCntQR = N(o?.STCL_CNT_QR)
      // 입고
      const inQty = N(ib?.IN_QTY); const inAmt = N(ib?.IN_AMT)
      // 당시즌 판매
      const saleQty = N(s?.SALE_QTY); const saleAmt = N(s?.SALE_AMT)
      const tagAmt = N(s?.TAG_AMT); const salePriceAmt = N(s?.SALE_PRICE_AMT); const costAmt = N(s?.COST_AMT)
      // 온라인
      const saleAmtOl = N(sol?.SALE_AMT_OL); const tagAmtOl = N(sol?.TAG_AMT_OL)
      // 이월 판매
      const coSaleQty = N(co?.CO_SALE_QTY); const coSaleAmt = N(co?.CO_SALE_AMT)
      const coTagAmt = N(co?.CO_TAG_AMT); const coSalePriceAmt = N(co?.CO_SALE_PRICE_AMT)
      const coCostAmt = N(co?.CO_COST_AMT)
      const coStCnt = N(co?.CO_ST_CNT); const coStclCnt = N(co?.CO_STCL_CNT)
      const coSaleAmtOl = N(coOl?.CO_SALE_AMT_OL)
      // 이월 비율
      const coDcRate = coTagAmt > 0 ? Math.round((1 - coSalePriceAmt / coTagAmt) * 1000) / 10 : 0
      const coCogsRate = coSaleAmt > 0 ? Math.round(coCostAmt / coSaleAmt * 1000) / 10 : 0
      // 전체 매출 = 당시즌 + 이월
      const totalSaleAmt = saleAmt + coSaleAmt
      const totalTagAmt = tagAmt + coTagAmt
      // 재고
      const shopInvQty = N(iv?.SHOP_INV_QTY); const whAvail = N(wh?.WH_AVAIL)
      const totalInvQty = shopInvQty + whAvail
      const invStCnt = N(iv?.INV_ST_CNT); const invStclCnt = N(iv?.INV_STCL_CNT)
      const avgTag = ordQty > 0 ? ordTagAmt / ordQty : 0
      const avgCost = ordQty > 0 ? ordCostAmt / ordQty : 0
      const invTagAmt = totalInvQty * avgTag; const invCostAmt = totalInvQty * avgCost
      // 비율
      const salesRate = inQty > 0 ? Math.round(saleQty / inQty * 1000) / 10 : 0
      const dcRate = tagAmt > 0 ? Math.round((1 - salePriceAmt / tagAmt) * 1000) / 10 : 0
      const cogsRate = saleAmt > 0 ? Math.round(costAmt / saleAmt * 1000) / 10 : 0
      const onlineRatio = saleAmt > 0 ? Math.round(saleAmtOl / saleAmt * 1000) / 10 : 0
      const firstCostRate = ordTag1st > 0 ? Math.round(ordCost1st / ordTag1st * 1000) / 10 : 0
      const qrCostRate = ordTagQR > 0 ? Math.round(ordCostQR / ordTagQR * 1000) / 10 : 0

      return {
        item: itemNm, category,
        stCnt, stclCnt, ordQty, ordTagAmt, ordCostAmt, inQty, inAmt,
        stCnt1st, stclCnt1st, ordQty1st, ordTag1st, ordCost1st,
        stCntQR, stclCntQR, ordQtyQR, ordTagQR, ordCostQR,
        saleQty, saleAmt, tagAmt, salePriceAmt, costAmt,
        saleAmtOl, tagAmtOl, onlineRatio,
        // 이월
        coSaleQty, coSaleAmt, coTagAmt, coCostAmt, coStCnt, coStclCnt,
        coSaleAmtOl, coDcRate, coCogsRate,
        // 합산
        totalSaleAmt, totalTagAmt,
        // 재고
        invStCnt, invStclCnt, totalInvQty, invTagAmt, invCostAmt, shopInvQty, whAvail,
        // 비율
        salesRate, dcRate, cogsRate, firstCostRate, qrCostRate,
      }
    }).sort((a, b) => b.ordTagAmt - a.ordTagAmt)

    return NextResponse.json({ items })
  } catch (err) {
    console.error('IPJ API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
