import { NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { fmtDateSf } from '@/lib/formatters'

export async function GET() {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1 // 1-based

  // 이번 달 1일 ~ 어제
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const cmStart = `${curYear}${String(curMonth).padStart(2, '0')}01`
  const cmEnd = fmtDateSf(yesterday)

  // 지난달
  const pmYear = curMonth === 1 ? curYear - 1 : curYear
  const pmMonth = curMonth === 1 ? 12 : curMonth - 1
  const pmStart = `${pmYear}${String(pmMonth).padStart(2, '0')}01`
  const pmEnd = `${pmYear}${String(pmMonth).padStart(2, '0')}${new Date(pmYear, pmMonth, 0).getDate()}`

  // 전년 동월
  const lyStart = `${curYear - 1}${String(curMonth).padStart(2, '0')}01`
  const lyEnd = `${curYear - 1}${String(curMonth).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`

  // 전년 지난달
  const lyPmStart = `${pmYear - 1}${String(pmMonth).padStart(2, '0')}01`
  const lyPmEnd = `${pmYear - 1}${String(pmMonth).padStart(2, '0')}${new Date(pmYear - 1, pmMonth, 0).getDate()}`

  const brandFilter = BRAND_FILTER

  try {
    const [kpiRaw, monthlyRaw, brandRaw] = await Promise.all([
      // 1. KPI: 이번달/지난달/전년동월 매출·수량
      snowflakeQuery<Record<string, string>>(`
        SELECT
          SUM(CASE WHEN SALEDT BETWEEN '${cmStart}' AND '${cmEnd}' THEN SALEAMT_VAT_EX ELSE 0 END) AS CM_REV,
          SUM(CASE WHEN SALEDT BETWEEN '${cmStart}' AND '${cmEnd}' THEN SALEQTY ELSE 0 END) AS CM_QTY,
          COUNT(DISTINCT CASE WHEN SALEDT BETWEEN '${cmStart}' AND '${cmEnd}' THEN SHOPCD END) AS CM_SHOPS,
          SUM(CASE WHEN SALEDT BETWEEN '${pmStart}' AND '${pmEnd}' THEN SALEAMT_VAT_EX ELSE 0 END) AS PM_REV,
          SUM(CASE WHEN SALEDT BETWEEN '${pmStart}' AND '${pmEnd}' THEN SALEQTY ELSE 0 END) AS PM_QTY,
          COUNT(DISTINCT CASE WHEN SALEDT BETWEEN '${pmStart}' AND '${pmEnd}' THEN SHOPCD END) AS PM_SHOPS,
          SUM(CASE WHEN SALEDT BETWEEN '${lyStart}' AND '${lyEnd}' THEN SALEAMT_VAT_EX ELSE 0 END) AS LY_REV,
          SUM(CASE WHEN SALEDT BETWEEN '${lyStart}' AND '${lyEnd}' THEN SALEQTY ELSE 0 END) AS LY_QTY,
          SUM(CASE WHEN SALEDT BETWEEN '${lyPmStart}' AND '${lyPmEnd}' THEN SALEAMT_VAT_EX ELSE 0 END) AS LY_PM_REV
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter}
      `),

      // 2. 월별 매출 추이 (최근 12개월)
      snowflakeQuery<{ M: string; REV: number }>(`
        SELECT SUBSTRING(SALEDT, 1, 6) AS M, SUM(SALEAMT_VAT_EX) AS REV
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter}
          AND SALEDT >= '${curYear - 1}${String(curMonth).padStart(2, '0')}01'
        GROUP BY SUBSTRING(SALEDT, 1, 6)
        ORDER BY M
      `),

      // 3. 브랜드별 현재 분기 실적
      snowflakeQuery<{ BRANDNM: string; REV: number; QTY: number }>(`
        SELECT BRANDNM,
          SUM(SALEAMT_VAT_EX) AS REV,
          SUM(SALEQTY) AS QTY
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter}
          AND SALEDT >= '${curYear}0101'
        GROUP BY BRANDNM
        ORDER BY REV DESC
      `),
    ])

    const k = kpiRaw[0] || {}
    const cmRev = Number(k.CM_REV) || 0
    const cmQty = Number(k.CM_QTY) || 0
    const cmShops = Number(k.CM_SHOPS) || 0
    const pmRev = Number(k.PM_REV) || 0
    const pmShops = Number(k.PM_SHOPS) || 0
    const lyRev = Number(k.LY_REV) || 0
    const lyQty = Number(k.LY_QTY) || 0

    const kpi = {
      cmRev, cmQty, cmShops,
      pmRev, pmShops,
      lyRev, lyQty,
      yoyRevPct: lyRev > 0 ? Math.round((cmRev - lyRev) / lyRev * 1000) / 10 : 0,
      yoyQtyPct: lyQty > 0 ? Math.round((cmQty - lyQty) / lyQty * 1000) / 10 : 0,
      momRevPct: pmRev > 0 ? Math.round((cmRev - pmRev) / pmRev * 1000) / 10 : 0,
      shopChgPct: pmShops > 0 ? Math.round((cmShops - pmShops) / pmShops * 1000) / 10 : 0,
      curMonth,
      curYear,
    }

    const monthly = monthlyRaw.map(r => ({
      month: `${String(r.M).slice(2, 4)}.${String(r.M).slice(4, 6)}`,
      yyyymm: String(r.M),
      actual: Number(r.REV) || 0,
    }))

    const brands = brandRaw.map(r => ({
      brand: r.BRANDNM,
      revenue: Number(r.REV) || 0,
      qty: Number(r.QTY) || 0,
    }))

    return NextResponse.json({ kpi, monthly, brands })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
