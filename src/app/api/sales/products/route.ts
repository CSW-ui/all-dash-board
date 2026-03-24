import { NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER, SALES_VIEW } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'
import { fmtDateSf } from '@/lib/formatters'

function getWeekBounds() {
  const today = new Date()
  const dow = today.getDay()
  const lastSun = new Date(today)
  lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
  const cwEnd = new Date(lastSun)
  const cwStart = new Date(lastSun); cwStart.setDate(cwStart.getDate() - 6)
  const pwEnd = new Date(cwStart); pwEnd.setDate(pwEnd.getDate() - 1)
  const pwStart = new Date(pwEnd); pwStart.setDate(pwStart.getDate() - 6)
  return { cwStart: fmtDateSf(cwStart), cwEnd: fmtDateSf(cwEnd), pwStart: fmtDateSf(pwStart), pwEnd: fmtDateSf(pwEnd) }
}

// GET /api/sales/products?brand=all&year=2026&toDt=20260308&weekNum=10&channelGroup=오프라인&channel=백화점
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand        = searchParams.get('brand') || 'all'
  const year         = searchParams.get('year')  || '2026'
  const toDt         = searchParams.get('toDt')  || `${year}1231`
  const weekNum      = searchParams.get('weekNum')
  const channelGroup = searchParams.get('channelGroup') || ''
  const channel      = searchParams.get('channel')      || ''
  const channels     = searchParams.get('channels')     || ''  // 다중 채널 (콤마 구분)
  const itemNm       = searchParams.get('item')          || ''

  const fromDt = searchParams.get('fromDt') || `${year}0101`

  // 브랜드 유효성 검증 (SQL 인젝션 방지)
  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const brandClause = brand === 'all' ? BRAND_FILTER : `BRANDCD = '${brand}'`

  let chFilter = ''
  const col = 's.SHOPTYPENM'
  if (channels) {
    const chList = channels.split(',').map(c => `'${c.trim().replace(/'/g, "''")}'`).join(',')
    chFilter = `AND ${col} IN (${chList})`
  } else if (channel) {
    chFilter = `AND ${col} = '${channel.replace(/'/g, "''")}'`
  } else if (channelGroup === '해외') {
    chFilter = `AND (${col} LIKE '%해외%' OR ${col} LIKE '%수출%')`
  } else if (channelGroup === '오프라인') {
    chFilter = `AND (${col} LIKE '%백화점%' OR ${col} LIKE '%아울렛%' OR ${col} LIKE '%가두%' OR ${col} LIKE '%직영%' OR ${col} LIKE '%대리%' OR ${col} LIKE '%면세%' OR ${col} LIKE '%팝업%' OR ${col} LIKE '%편집%' OR ${col} LIKE '%오프%' OR ${col} LIKE '%쇼핑몰%' OR ${col} LIKE '%사입%')`
  } else if (channelGroup === '온라인') {
    chFilter = `AND NOT (${col} LIKE '%해외%' OR ${col} LIKE '%수출%' OR ${col} LIKE '%백화점%' OR ${col} LIKE '%아울렛%' OR ${col} LIKE '%가두%' OR ${col} LIKE '%직영%' OR ${col} LIKE '%대리%' OR ${col} LIKE '%면세%' OR ${col} LIKE '%팝업%' OR ${col} LIKE '%편집%' OR ${col} LIKE '%오프%' OR ${col} LIKE '%쇼핑몰%' OR ${col} LIKE '%사입%')`
  }

  const weekFilter = weekNum
    ? `AND WEEKOFYEAR(TO_DATE(s.SALEDT, 'YYYYMMDD')) = ${parseInt(weekNum)}`
    : ''

  // 전주 대비 계산용 날짜
  const wb = getWeekBounds()

  try {
    const rows = await snowflakeQuery<Record<string, string>>(
      `SELECT s.STYLECD, si.STYLENM, s.BRANDCD,
         SUM(s.SALEAMT_VAT_EX) AS REVENUE,
         SUM(s.SALEQTY) AS QTY,
         SUM(s.TAGPRICE * s.SALEQTY) AS TAG_TOTAL,
         SUM(s.SALEPRICE * s.SALEQTY) AS SALE_TOTAL,
         SUM(CASE WHEN s.SALEDT BETWEEN '${wb.cwStart}' AND '${wb.cwEnd}' THEN s.SALEAMT_VAT_EX ELSE 0 END) AS CW_REV,
         SUM(CASE WHEN s.SALEDT BETWEEN '${wb.pwStart}' AND '${wb.pwEnd}' THEN s.SALEAMT_VAT_EX ELSE 0 END) AS PW_REV
       FROM ${SALES_VIEW} s
       LEFT JOIN BCAVE.SEWON.SW_STYLEINFO si ON s.STYLECD = si.STYLECD
       WHERE ${brandClause.replace(/BRANDCD/g, 's.BRANDCD')}
         AND s.SALEDT BETWEEN '${fromDt}' AND '${toDt}'
         ${weekFilter}
         ${chFilter}
         ${itemNm ? `AND si.ITEMNM = '${itemNm.replace(/'/g, "''")}'` : ''}
       GROUP BY s.STYLECD, si.STYLENM, s.BRANDCD
       ORDER BY REVENUE DESC
       LIMIT 20`
    )

    return NextResponse.json({
      products: rows.map(p => ({
        code:    p.STYLECD,
        name:    p.STYLENM ?? p.STYLECD,
        brand:   p.BRANDCD,
        revenue: Number(p.REVENUE) || 0,
        qty:     Number(p.QTY) || 0,
        tagTotal:  Number(p.TAG_TOTAL) || 0,
        saleTotal: Number(p.SALE_TOTAL) || 0,
        cwRev:   Number(p.CW_REV) || 0,
        pwRev:   Number(p.PW_REV) || 0,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
