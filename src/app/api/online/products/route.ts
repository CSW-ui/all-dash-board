import { NextRequest, NextResponse } from 'next/server'
import { snowflakeQuery, BRAND_FILTER } from '@/lib/snowflake'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { VALID_BRANDS } from '@/lib/constants'

// Snowflake 상품 + Supabase 수동입력 병합 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const brand = searchParams.get('brand') || 'all'
    const rawYear = searchParams.get('year') || '2026'
    // YEARCD는 2자리 (예: '26'), 프론트에서 4자리로 오면 뒤 2자리만 사용
    const year = rawYear.length === 4 ? rawYear.slice(2) : rawYear
    const season = searchParams.get('season') || ''
    const status = searchParams.get('status') || ''

    // 브랜드 유효성 검증 (SQL 인젝션 방지)
    if (brand !== 'all' && !VALID_BRANDS.has(brand)) {
      return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
    }

    // 1. Snowflake에서 발주 상품 조회 (스타일+컬러 단위)
    const brandWhere = brand !== 'all' ? `BRANDCD = '${brand}'` : BRAND_FILTER
    const seasonWhere = season ? `AND SEASONNM = '${season}'` : ''

    const sql = `
      SELECT STYLECD, STYLENM, BRANDCD, YEARCD, SEASONNM, ITEMNM, SEXNM,
             COLORCD, COLORNM,
             MAX(TAGPRICE) AS TAGPRICE, MAX(PRECOST) AS PRECOST,
             MAX(ORIGNNM) AS ORIGNNM, MAX(MANUFACTURER) AS MANUFACTURER,
             MAX(PLANGBNM) AS PLANGBNM,
             SUM(ORDQTY) AS TOTAL_ORDQTY,
             COUNT(DISTINCT CHASU) AS CHASU_CNT,
             LISTAGG(DISTINCT SIZECD, ',') WITHIN GROUP (ORDER BY SIZECD) AS SIZE_LIST
      FROM BCAVE.SEWON.SW_STYLEINFO_DETAIL
      WHERE ${brandWhere} AND YEARCD = '${year}' ${seasonWhere}
      GROUP BY STYLECD, STYLENM, BRANDCD, YEARCD, SEASONNM, ITEMNM, SEXNM,
               COLORCD, COLORNM
      ORDER BY STYLECD, COLORCD
    `
    console.log('[online/products] SQL:', sql)

    const sfData = await snowflakeQuery<{
      STYLECD: string; STYLENM: string; BRANDCD: string; YEARCD: string;
      SEASONNM: string; ITEMNM: string; SEXNM: string; COLORCD: string;
      COLORNM: string; TAGPRICE: string; PRECOST: string;
      ORIGNNM: string; MANUFACTURER: string; PLANGBNM: string;
      TOTAL_ORDQTY: string; CHASU_CNT: string; SIZE_LIST: string;
    }>(sql)

    console.log('[online/products] Snowflake rows:', sfData.length)

    // 2. Supabase에서 수동입력 데이터 조회 (테이블 없으면 무시)
    let manualData: Record<string, unknown>[] | null = null
    try {
      const supabase = createSupabaseServerClient()
      const { data, error } = await supabase
        .from('online_product_info')
        .select('*')
      if (!error) manualData = data
      else console.log('[online/products] Supabase skip:', error.message)
    } catch {
      console.log('[online/products] Supabase 테이블 없음 - 스킵')
    }

    // 3. 병합
    const manualMap = new Map<string, typeof manualData extends (infer T)[] | null ? T : never>()
    manualData?.forEach(m => {
      manualMap.set(`${m.stylecd}_${m.colorcd}_${m.brandcd}`, m)
    })

    const merged = sfData.map(sf => {
      const key = `${sf.STYLECD}_${sf.COLORCD}_${sf.BRANDCD}`
      const manual = manualMap.get(key)

      // 상태 결정
      let computedStatus = 'draft'
      if (manual) {
        if (manual.status === 'complete') computedStatus = 'complete'
        else if (manual.product_description || manual.selling_points?.length) computedStatus = 'design'
        else if (manual.material_mix) computedStatus = 'sourcing'
        else if (manual.launch_date) computedStatus = 'planning'
      }

      return {
        stylecd: sf.STYLECD,
        stylenm: sf.STYLENM,
        brandcd: sf.BRANDCD,
        yearcd: sf.YEARCD,
        seasonnm: sf.SEASONNM,
        itemnm: sf.ITEMNM,
        sexnm: sf.SEXNM,
        colorcd: sf.COLORCD,
        colornm: sf.COLORNM,
        chasu: `${sf.CHASU_CNT}차`,
        tagprice: Number(sf.TAGPRICE) || 0,
        precost: Number(sf.PRECOST) || 0,
        orignnm: sf.ORIGNNM,
        manufacturer: sf.MANUFACTURER,
        plangbnm: sf.PLANGBNM,
        ordqty: Number(sf.TOTAL_ORDQTY) || 0,
        sizes: sf.SIZE_LIST || '',
        // 수동입력 데이터
        manual: manual || null,
        status: manual?.status || computedStatus,
        hasImages: !!(manual?.thumbnail_urls?.length),
        imageCount: (manual?.thumbnail_urls?.length || 0) + (manual?.lookbook_urls?.length || 0) + (manual?.detail_urls?.length || 0),
      }
    })

    // 4. 상태 필터
    const filtered = status ? merged.filter(m => m.status === status) : merged

    // 5. 상태별 카운트
    const counts = {
      total: merged.length,
      draft: merged.filter(m => m.status === 'draft').length,
      planning: merged.filter(m => m.status === 'planning').length,
      sourcing: merged.filter(m => m.status === 'sourcing').length,
      design: merged.filter(m => m.status === 'design').length,
      complete: merged.filter(m => m.status === 'complete').length,
    }

    return NextResponse.json({ products: filtered, counts })
  } catch (err: unknown) {
    console.error('온라인 상품 조회 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
