import { NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER, SALES_VIEW } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'
import { fmtDateSf } from '@/lib/formatters'

function getDateRanges(monthParam?: string) {
  let today: Date
  let isPastMonth = false
  let forcedMonthStart: Date | null = null
  let forcedMonthEnd: Date | null = null

  if (monthParam && monthParam.length === 6) {
    const yr = parseInt(monthParam.slice(0, 4))
    const mo = parseInt(monthParam.slice(4, 6))
    const lastDay = new Date(yr, mo, 0) // 해당 월의 마지막 날
    const now = new Date()

    forcedMonthStart = new Date(yr, mo - 1, 1)
    forcedMonthEnd = lastDay

    if (now > lastDay) {
      // 과거 월: 마지막 날 기준
      today = lastDay
      isPastMonth = true
    } else {
      today = now
    }
  } else {
    today = new Date()
  }

  const dow = today.getDay() // 0=Sun

  // Most recently completed week's Sunday
  const lastSun = new Date(today)
  lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))

  // Current week (last completed Mon–Sun)
  const cwEnd = new Date(lastSun)
  const cwStart = new Date(lastSun)
  cwStart.setDate(cwStart.getDate() - 6)

  // Previous week
  const pwEnd = new Date(cwStart)
  pwEnd.setDate(pwEnd.getDate() - 1)
  const pwStart = new Date(pwEnd)
  pwStart.setDate(pwStart.getDate() - 6)

  // 월 시작/끝: 과거 월이면 전체 월, 아니면 cwEnd 기준
  const monthStart = forcedMonthStart ?? new Date(cwEnd.getFullYear(), cwEnd.getMonth(), 1)
  const monthEnd = forcedMonthEnd ?? cwEnd // 과거 월이면 월말까지, 현재 월이면 cwEnd까지

  return {
    cwStart: fmtDateSf(cwStart),
    cwEnd: fmtDateSf(cwEnd),
    pwStart: fmtDateSf(pwStart),
    pwEnd: fmtDateSf(pwEnd),
    monthStart: fmtDateSf(monthStart),
    monthEnd: fmtDateSf(monthEnd),
    monthLabel: `${monthStart.getFullYear()}년 ${monthStart.getMonth() + 1}월`,
    isPastMonth,
  }
}

// GET /api/sales/performance?brand=all
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get('brand') || 'all'

  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const stylecd = searchParams.get('stylecd') || ''
  const month = searchParams.get('month') || ''

  const dates = getDateRanges(month || undefined)
  const brandWhere = brand === 'all'
    ? BRAND_FILTER.replace(/BRANDCD/g, 's.BRANDCD')
    : `s.BRANDCD = '${brand}'`
  const styleFilter = stylecd ? `AND s.STYLECD = '${stylecd.replace(/'/g, "''")}'` : ''

  const rangeEnd = dates.monthEnd > dates.cwEnd ? dates.monthEnd : dates.cwEnd
  const rangeStart = dates.monthStart < dates.pwStart ? dates.monthStart : dates.pwStart

  function buildSql(yearOffset: number) {
    const off = yearOffset * 10000
    const ms = String(parseInt(dates.monthStart) - off)
    const me = String(parseInt(dates.monthEnd) - off)
    const cs = String(parseInt(dates.cwStart) - off)
    const ce = String(parseInt(dates.cwEnd) - off)
    const ps = String(parseInt(dates.pwStart) - off)
    const pe = String(parseInt(dates.pwEnd) - off)
    const rs = String(parseInt(rangeStart) - off)
    const re = String(parseInt(rangeEnd) - off)

    return `
      SELECT s.BRANDCD, s.BRANDNM, s.SHOPTYPENM,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ms}' AND '${me}' THEN s.SALEAMT_VAT_EX ELSE 0 END) AS MTD_REV,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ms}' AND '${me}' THEN s.TAGPRICE * s.SALEQTY ELSE 0 END) AS MTD_TAG,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ms}' AND '${me}' THEN s.SALEPRICE * s.SALEQTY ELSE 0 END) AS MTD_SALE,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ms}' AND '${me}' THEN COALESCE(si.PRODCOST, 0) * s.SALEQTY ELSE 0 END) AS MTD_COST,
        SUM(CASE WHEN s.SALEDT BETWEEN '${cs}' AND '${ce}' THEN s.SALEAMT_VAT_EX ELSE 0 END) AS CW_REV,
        SUM(CASE WHEN s.SALEDT BETWEEN '${cs}' AND '${ce}' THEN s.TAGPRICE * s.SALEQTY ELSE 0 END) AS CW_TAG,
        SUM(CASE WHEN s.SALEDT BETWEEN '${cs}' AND '${ce}' THEN s.SALEPRICE * s.SALEQTY ELSE 0 END) AS CW_SALE,
        SUM(CASE WHEN s.SALEDT BETWEEN '${cs}' AND '${ce}' THEN COALESCE(si.PRODCOST, 0) * s.SALEQTY ELSE 0 END) AS CW_COST,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ps}' AND '${pe}' THEN s.SALEAMT_VAT_EX ELSE 0 END) AS PW_REV,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ps}' AND '${pe}' THEN s.TAGPRICE * s.SALEQTY ELSE 0 END) AS PW_TAG,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ps}' AND '${pe}' THEN s.SALEPRICE * s.SALEQTY ELSE 0 END) AS PW_SALE,
        SUM(CASE WHEN s.SALEDT BETWEEN '${ps}' AND '${pe}' THEN COALESCE(si.PRODCOST, 0) * s.SALEQTY ELSE 0 END) AS PW_COST
      FROM ${SALES_VIEW} s
      LEFT JOIN BCAVE.SEWON.SW_STYLEINFO si
        ON s.STYLECD = si.STYLECD AND s.BRANDCD = si.BRANDCD
      WHERE ${brandWhere}
        AND s.SALEDT BETWEEN '${rs}' AND '${re}'
        ${styleFilter}
      GROUP BY s.BRANDCD, s.BRANDNM, s.SHOPTYPENM
    `
  }

  try {
    const [cyRaw, lyRaw] = await Promise.all([
      snowflakeQuery<Record<string, string>>(buildSql(0)),
      snowflakeQuery<Record<string, string>>(buildSql(1)),
    ])

    const mapRow = (r: Record<string, string>) => ({
      brandcd: r.BRANDCD,
      brandnm: r.BRANDNM,
      shoptypenm: r.SHOPTYPENM,
      mtdRev: Number(r.MTD_REV) || 0,
      mtdTag: Number(r.MTD_TAG) || 0,
      mtdSale: Number(r.MTD_SALE) || 0,
      mtdCost: Number(r.MTD_COST) || 0,
      cwRev: Number(r.CW_REV) || 0,
      cwTag: Number(r.CW_TAG) || 0,
      cwSale: Number(r.CW_SALE) || 0,
      cwCost: Number(r.CW_COST) || 0,
      pwRev: Number(r.PW_REV) || 0,
      pwTag: Number(r.PW_TAG) || 0,
      pwSale: Number(r.PW_SALE) || 0,
      pwCost: Number(r.PW_COST) || 0,
    })

    return NextResponse.json({
      cy: cyRaw.map(mapRow),
      ly: lyRaw.map(mapRow),
      meta: dates,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
