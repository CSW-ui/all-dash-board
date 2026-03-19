import { NextResponse } from 'next/server'
import { snowflakeQuery, SALES_VIEW, BRAND_FILTER } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'

// GET /api/sales/items?brand=all — 전주 마감 기준 품목별 실적
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get('brand') || 'all'

  // 브랜드 유효성 검증 (SQL 인젝션 방지)
  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  const weekNum = searchParams.get('weekNum') || ''

  const brandWhere = brand === 'all'
    ? BRAND_FILTER.replace(/BRANDCD/g, 'v.BRANDCD')
    : `v.BRANDCD = '${brand}'`

  const today = new Date()
  const fD = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const dow = today.getDay()
  const lastSun = new Date(today); lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
  const cwEnd = fD(lastSun)
  const cwStart = fD(new Date(lastSun.getTime() - 6 * 86400000))
  const pwEnd = fD(new Date(lastSun.getTime() - 7 * 86400000))
  const pwStart = fD(new Date(lastSun.getTime() - 13 * 86400000))
  const lyCwStart = String(parseInt(cwStart) - 10000)
  const lyCwEnd = String(parseInt(cwEnd) - 10000)

  const yr = String(today.getFullYear())
  const lyYr = String(today.getFullYear() - 1)

  try {
    let sql: string
    if (weekNum) {
      // 특정 주차: 금년 해당주 vs 전주 vs 전년 동주
      const wn = parseInt(weekNum)
      const pwn = wn - 1 > 0 ? wn - 1 : 52
      sql = `
        SELECT si.ITEMNM,
          SUM(CASE WHEN YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${yr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${wn} THEN v.SALEAMT_VAT_EX ELSE 0 END) as CW_REV,
          SUM(CASE WHEN YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${yr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${pwn} THEN v.SALEAMT_VAT_EX ELSE 0 END) as PW_REV,
          SUM(CASE WHEN YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${lyYr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${wn} THEN v.SALEAMT_VAT_EX ELSE 0 END) as LY_CW_REV,
          SUM(CASE WHEN YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${yr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${wn} THEN v.SALEQTY ELSE 0 END) as CW_QTY
        FROM ${SALES_VIEW} v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${brandWhere}
          AND ((YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${yr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD')) IN (${wn},${pwn}))
            OR (YEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${lyYr} AND WEEKOFYEAR(TO_DATE(v.SALEDT,'YYYYMMDD'))=${wn}))
        GROUP BY si.ITEMNM
        ORDER BY CW_REV DESC`
    } else {
      // 기본: 전주 vs 전전주 vs 전년동주
      sql = `
        SELECT si.ITEMNM,
          SUM(CASE WHEN v.SALEDT BETWEEN '${cwStart}' AND '${cwEnd}' THEN v.SALEAMT_VAT_EX ELSE 0 END) as CW_REV,
          SUM(CASE WHEN v.SALEDT BETWEEN '${pwStart}' AND '${pwEnd}' THEN v.SALEAMT_VAT_EX ELSE 0 END) as PW_REV,
          SUM(CASE WHEN v.SALEDT BETWEEN '${lyCwStart}' AND '${lyCwEnd}' THEN v.SALEAMT_VAT_EX ELSE 0 END) as LY_CW_REV,
          SUM(CASE WHEN v.SALEDT BETWEEN '${cwStart}' AND '${cwEnd}' THEN v.SALEQTY ELSE 0 END) as CW_QTY
        FROM ${SALES_VIEW} v
        JOIN BCAVE.SEWON.SW_STYLEINFO si ON v.STYLECD = si.STYLECD AND v.BRANDCD = si.BRANDCD
        WHERE ${brandWhere}
          AND (v.SALEDT BETWEEN '${pwStart}' AND '${cwEnd}' OR v.SALEDT BETWEEN '${lyCwStart}' AND '${lyCwEnd}')
        GROUP BY si.ITEMNM
        ORDER BY CW_REV DESC`
    }
    const rows = await snowflakeQuery<Record<string, string>>(sql)

    const items = rows.map(r => {
      const cwRev = Number(r.CW_REV) || 0
      const pwRev = Number(r.PW_REV) || 0
      const lyCwRev = Number(r.LY_CW_REV) || 0
      return {
        item: r.ITEMNM ?? '기타',
        cwRev, pwRev, lyCwRev,
        cwQty: Number(r.CW_QTY) || 0,
        wow: pwRev > 0 ? Math.round((cwRev - pwRev) / pwRev * 1000) / 10 : 0,
        yoy: lyCwRev > 0 ? Math.round((cwRev - lyCwRev) / lyCwRev * 1000) / 10 : 0,
      }
    })

    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
