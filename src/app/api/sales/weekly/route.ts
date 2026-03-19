import { NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER, SALES_VIEW } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'

// GET /api/sales/weekly?brand=all&toDt=20260308&channelGroup=오프라인&channel=백화점
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand        = searchParams.get('brand') || 'all'

  // 브랜드 유효성 검증 (SQL 인젝션 방지)
  if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  const toDt         = searchParams.get('toDt')  || '20261231'
  const channelGroup = searchParams.get('channelGroup') || ''  // 오프라인|온라인|해외
  const channel      = searchParams.get('channel') || ''       // 특정 채널명 (우선순위↑)

  const year    = toDt.slice(0, 4)
  const lyYear  = String(parseInt(year) - 1)
  const fromDt  = `${year}0101`
  const lyFromDt = `${lyYear}0101`
  const lyToDt   = `${lyYear}1231`

  const stylecd      = searchParams.get('stylecd') || ''

  const brandClause = brand === 'all' ? BRAND_FILTER : `BRANDCD = '${brand}'`
  const styleFilter = stylecd ? `AND STYLECD = '${stylecd.replace(/'/g, "''")}'` : ''

  // 채널 필터 SQL 생성
  function buildChannelFilter(tableAlias = ''): string {
    const col = tableAlias ? `${tableAlias}.SHOPTYPENM` : 'SHOPTYPENM'
    if (channel) return `AND ${col} = '${channel.replace(/'/g, "''")}'`
    if (channelGroup === '해외') {
      return `AND (${col} LIKE '%해외%' OR ${col} LIKE '%global%' OR ${col} LIKE '%수출%' OR ${col} LIKE '%export%')`
    }
    if (channelGroup === '오프라인') {
      return `AND (${col} LIKE '%백화점%' OR ${col} LIKE '%아울렛%' OR ${col} LIKE '%가두%' OR ${col} LIKE '%직영%' OR ${col} LIKE '%대리%' OR ${col} LIKE '%면세%' OR ${col} LIKE '%팝업%' OR ${col} LIKE '%편집%' OR ${col} LIKE '%오프%' OR ${col} LIKE '%로드샵%' OR ${col} LIKE '%부티크%')`
    }
    if (channelGroup === '온라인') {
      return `AND NOT (${col} LIKE '%해외%' OR ${col} LIKE '%global%' OR ${col} LIKE '%수출%' OR ${col} LIKE '%백화점%' OR ${col} LIKE '%아울렛%' OR ${col} LIKE '%가두%' OR ${col} LIKE '%직영%' OR ${col} LIKE '%대리%' OR ${col} LIKE '%면세%' OR ${col} LIKE '%팝업%' OR ${col} LIKE '%편집%' OR ${col} LIKE '%오프%' OR ${col} LIKE '%로드샵%' OR ${col} LIKE '%부티크%')`
    }
    return ''
  }

  const chFilter = buildChannelFilter()

  try {
    const [cyRows, lyRows] = await Promise.all([
      // 금년 주간 집계
      snowflakeQuery<{ WEEK_NUM: number; WEEK_START: string; REVENUE: number; QTY: number }>(
        `SELECT
           WEEKOFYEAR(TO_DATE(SALEDT, 'YYYYMMDD')) AS WEEK_NUM,
           TO_VARCHAR(DATE_TRUNC('WEEK', TO_DATE(SALEDT, 'YYYYMMDD')), 'YYYYMMDD') AS WEEK_START,
           SUM(SALEAMT_VAT_EX) AS REVENUE,
           SUM(SALEQTY) AS QTY
         FROM ${SALES_VIEW}
         WHERE ${brandClause}
           AND SALEDT BETWEEN '${fromDt}' AND '${toDt}'
           ${chFilter}
           ${styleFilter}
         GROUP BY WEEK_NUM, WEEK_START
         ORDER BY WEEK_NUM`
      ),
      // 전년 주간 집계 (전체 연도)
      snowflakeQuery<{ WEEK_NUM: number; REVENUE: number }>(
        `SELECT
           WEEKOFYEAR(TO_DATE(SALEDT, 'YYYYMMDD')) AS WEEK_NUM,
           SUM(SALEAMT_VAT_EX) AS REVENUE
         FROM ${SALES_VIEW}
         WHERE ${brandClause}
           AND SALEDT BETWEEN '${lyFromDt}' AND '${lyToDt}'
           ${chFilter}
           ${styleFilter}
         GROUP BY WEEK_NUM
         ORDER BY WEEK_NUM`
      ),
    ])

    // 1-52주 배열 빌드 (없는 주는 null)
    const lyMap = new Map(lyRows.map(r => [Number(r.WEEK_NUM), Number(r.REVENUE)]))
    const cyMap = new Map(cyRows.map(r => [
      Number(r.WEEK_NUM),
      { revenue: Number(r.REVENUE), qty: Number(r.QTY), weekStart: r.WEEK_START },
    ]))

    const weeks = Array.from({ length: 52 }, (_, i) => {
      const weekNum = i + 1
      const cy = cyMap.get(weekNum)
      return {
        weekNum,
        weekStart: cy?.weekStart ?? null,
        cy:       cy ? cy.revenue : null,
        ly:       lyMap.get(weekNum) ?? null,
        qty:      cy ? cy.qty : null,
      }
    })

    const cyTotal = cyRows.reduce((s, r) => s + Number(r.REVENUE), 0)
    const lyTotal = lyRows.reduce((s, r) => s + Number(r.REVENUE), 0)
    const maxWeek = cyRows.length > 0 ? Math.max(...cyRows.map(r => Number(r.WEEK_NUM))) : 0

    return NextResponse.json({ weeks, meta: { cyTotal, lyTotal, maxWeek } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
