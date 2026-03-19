import { NextResponse } from 'next/server'
import { snowflakeQuery } from '@/lib/snowflake'
import { VALID_BRANDS } from '@/lib/constants'

interface StyleRow {
  STYLECD: string
  STYLENM: string
  BRANDCD: string
  YEARCD: string
  SEASONNM: string
  ITEMNM: string
}

// GET /api/products?brand=CO&year=26&season=봄&item=티셔츠&q=로고
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand  = searchParams.get('brand')
  const year   = searchParams.get('year')
  const season = searchParams.get('season')
  const item   = searchParams.get('item')
  const q      = searchParams.get('q')

  // 브랜드 유효성 검증 (SQL 인젝션 방지)
  if (brand && !VALID_BRANDS.has(brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }

  const conditions: string[] = [`BRANDCD IN ('CO','WA','LE','CK','LK')`]
  if (brand)  conditions.push(`BRANDCD = '${brand}'`)
  if (year)   conditions.push(`YEARCD = '${year}'`)
  if (season) conditions.push(`SEASONNM = '${season}'`)
  if (item)   conditions.push(`ITEMNM = '${item}'`)
  if (q) {
    const qSafe = q.replace(/'/g, "''").toUpperCase()
    // STYLECD+COLORCD 조합 검색 (예: CO2503LT73BE → STYLECD=CO2503LT73, COLORCD=BE)
    // 또는 상품명, 스타일코드 검색
    conditions.push(`(UPPER(STYLENM) LIKE '%${qSafe}%' OR UPPER(STYLECD) LIKE '%${qSafe}%' OR UPPER(STYLECD || COLORCD) LIKE '%${qSafe}%')`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  try {
    // 컬러코드 검색을 위해 SW_SALEINFO의 COLORCD도 활용
    const qUpper = (q ?? '').toUpperCase()
    const hasColorSearch = q && q.length > 6 // STYLECD(8~10자) + COLORCD(2자) = 10자 이상이면 컬러 포함 가능

    let rows: StyleRow[]
    if (hasColorSearch) {
      // 컬러코드 포함 검색: STYLECD + COLORCD 조합
      const possibleStyleCd = qUpper.slice(0, -2) // 뒤 2자가 컬러
      const possibleColor = qUpper.slice(-2)
      rows = await snowflakeQuery<StyleRow>(
        `SELECT DISTINCT si.STYLECD, si.STYLENM, si.BRANDCD, si.YEARCD, si.SEASONNM, si.ITEMNM
         FROM BCAVE.SEWON.SW_STYLEINFO si
         LEFT JOIN (SELECT DISTINCT STYLECD, COLORCD FROM BCAVE.SEWON.SW_SALEINFO WHERE SALEDT >= '20250101') sc ON si.STYLECD = sc.STYLECD
         ${where.replace('STYLECD', 'si.STYLECD').replace('STYLENM', 'si.STYLENM').replace('BRANDCD', 'si.BRANDCD').replace('YEARCD', 'si.YEARCD').replace('SEASONNM', 'si.SEASONNM').replace('ITEMNM', 'si.ITEMNM')}
         OR (si.STYLECD = '${possibleStyleCd}' AND sc.COLORCD = '${possibleColor}')
         ORDER BY si.YEARCD DESC, si.BRANDCD, si.STYLENM
         LIMIT 50`
      )
    } else {
      rows = await snowflakeQuery<StyleRow>(
        `SELECT STYLECD, STYLENM, BRANDCD, YEARCD, SEASONNM, ITEMNM
         FROM BCAVE.SEWON.SW_STYLEINFO
         ${where}
         ORDER BY YEARCD DESC, BRANDCD, STYLENM
         LIMIT 50`
      )
    }
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/products/filters — 필터 선택지 목록
export async function POST() {
  try {
    const [brands, years, seasons, items] = await Promise.all([
      snowflakeQuery<{ BRANDCD: string }>(`SELECT DISTINCT BRANDCD FROM BCAVE.SEWON.SW_STYLEINFO WHERE BRANDCD IN ('CO','WA','LE','CK','LK') ORDER BY BRANDCD`),
      snowflakeQuery<{ YEARCD: string }>(`SELECT DISTINCT YEARCD FROM BCAVE.SEWON.SW_STYLEINFO WHERE BRANDCD IN ('CO','WA','LE','CK','LK') ORDER BY YEARCD DESC LIMIT 6`),
      snowflakeQuery<{ SEASONNM: string }>(`SELECT DISTINCT SEASONNM FROM BCAVE.SEWON.SW_STYLEINFO WHERE BRANDCD IN ('CO','WA','LE','CK','LK') AND SEASONNM IS NOT NULL ORDER BY SEASONNM`),
      snowflakeQuery<{ ITEMNM: string }>(`SELECT DISTINCT ITEMNM FROM BCAVE.SEWON.SW_STYLEINFO WHERE BRANDCD IN ('CO','WA','LE','CK','LK') AND ITEMNM IS NOT NULL ORDER BY ITEMNM`),
    ])
    return NextResponse.json({
      brands: brands.map(r => r.BRANDCD),
      years:  years.map(r => r.YEARCD),
      seasons: seasons.map(r => r.SEASONNM),
      items: items.map(r => r.ITEMNM),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
