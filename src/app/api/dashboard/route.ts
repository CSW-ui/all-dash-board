import { NextRequest, NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { fmtDateSf } from '@/lib/formatters'

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get('region') || 'domestic'
  // SHOPTYPENM은 '백화점','아울렛','무신사','해외 사입' 등 구체적 채널명
  // 해외: SHOPTYPENM에 '해외' 포함
  // 오프라인: 백화점,아울렛,가두,직영,대리,면세,팝업,편집,오프,로드샵,부티크,쇼핑몰,사입(해외제외)
  // 온라인: 해외/오프라인 아닌 나머지
  // 국내: 해외 아닌 전체
  const regionFilterMap: Record<string, string> = {
    domestic: "AND SHOPTYPENM NOT LIKE '%해외%'",
    online: "AND SHOPTYPENM NOT LIKE '%해외%' AND SHOPTYPENM NOT IN ('백화점','아울렛','가두점','직영점','대리점','면세점','팝업','편집숍','로드샵','부티크','쇼핑몰')",
    offline: "AND SHOPTYPENM NOT LIKE '%해외%' AND SHOPTYPENM IN ('백화점','아울렛','가두점','직영점','대리점','면세점','팝업','편집숍','로드샵','부티크','쇼핑몰')",
    overseas: "AND SHOPTYPENM LIKE '%해외%'",
  }
  const regionFilter = regionFilterMap[region] || ''
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
    const [kpiRaw, monthlyRaw, brandRaw, brandMonthRaw, yearlyProductRaw] = await Promise.all([
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
        WHERE ${brandFilter} ${regionFilter}
      `),

      // 2. 월별 매출 추이: 올해 + 전년 (1월~12월 기준으로 비교)
      snowflakeQuery<{ M: string; REV: number }>(`
        SELECT SUBSTRING(SALEDT, 1, 6) AS M, SUM(SALEAMT_VAT_EX) AS REV
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter} ${regionFilter}
          AND SALEDT >= '${curYear - 1}0101'
        GROUP BY SUBSTRING(SALEDT, 1, 6)
        ORDER BY M
      `),

      // 3. 브랜드별 YTD 실적
      snowflakeQuery<{ BRANDNM: string; REV: number; QTY: number }>(`
        SELECT BRANDNM,
          SUM(SALEAMT_VAT_EX) AS REV,
          SUM(SALEQTY) AS QTY
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter} ${regionFilter}
          AND SALEDT >= '${curYear}0101'
        GROUP BY BRANDNM
        ORDER BY REV DESC
      `),

      // 4. 브랜드별 금월 매출
      snowflakeQuery<{ BRANDNM: string; REV: number }>(`
        SELECT BRANDNM,
          SUM(SALEAMT_VAT_EX) AS REV
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter} ${regionFilter}
          AND SALEDT BETWEEN '${cmStart}' AND '${cmEnd}'
        GROUP BY BRANDNM
        ORDER BY REV DESC
      `),

      // 5. 연도별 상품수·판매 지표
      snowflakeQuery<{ YR: string; STYLES: number; QTY: number; REV: number; SHOPS: number }>(`
        SELECT
          SUBSTRING(SALEDT, 1, 4) AS YR,
          COUNT(DISTINCT STYLECD) AS STYLES,
          SUM(SALEQTY) AS QTY,
          SUM(SALEAMT_VAT_EX) AS REV,
          COUNT(DISTINCT SHOPCD) AS SHOPS
        FROM BCAVE.SEWON.VW_SALES_VAT
        WHERE ${brandFilter} ${regionFilter}
          AND SALEDT >= '20200101'
          AND SALEDT <= '${curYear}1231'
        GROUP BY SUBSTRING(SALEDT, 1, 4)
        ORDER BY YR
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

    // 올해/전년 월별 데이터 분리
    const curYearStr = String(curYear)
    const lastYearStr = String(curYear - 1)

    const monthlyMap = new Map<string, { actual: number; lastYear: number }>()
    // 1~12월 기본 구조 생성
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0')
      monthlyMap.set(mm, { actual: 0, lastYear: 0 })
    }
    // 데이터 매핑
    for (const r of monthlyRaw) {
      const ym = String(r.M)
      const yyyy = ym.slice(0, 4)
      const mm = ym.slice(4, 6)
      const entry = monthlyMap.get(mm)
      if (!entry) continue
      if (yyyy === curYearStr) entry.actual = Number(r.REV) || 0
      else if (yyyy === lastYearStr) entry.lastYear = Number(r.REV) || 0
    }

    const monthly = Array.from(monthlyMap.entries()).map(([mm, v]) => ({
      month: `${mm}월`,
      yyyymm: `${curYearStr}${mm}`,
      actual: v.actual,
      lastYear: v.lastYear,
    }))

    const brands = brandRaw.map(r => ({
      brand: r.BRANDNM,
      revenue: Number(r.REV) || 0,
      qty: Number(r.QTY) || 0,
    }))

    // 브랜드별 금월 매출
    const brandMonth = brandMonthRaw.map(r => ({
      brand: r.BRANDNM,
      cmRev: Number(r.REV) || 0,
    }))

    // 연도별 상품/판매 지표
    const yearlyProduct = yearlyProductRaw.map(r => ({
      year: String(r.YR),
      styles: Number(r.STYLES) || 0,
      qty: Number(r.QTY) || 0,
      revenue: Number(r.REV) || 0,
      shops: Number(r.SHOPS) || 0,
    }))

    return NextResponse.json({ kpi, monthly, brands, brandMonth, yearlyProduct })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
