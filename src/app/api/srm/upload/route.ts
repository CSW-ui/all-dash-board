import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 엑셀 컬럼명 → DB 컬럼명 매핑
const COLUMN_MAP: Record<string, string> = {
  '스타일코드': 'stylecd',
  '차수': 'chasu',
  '컬러코드': 'colorcd',
  '브랜드': 'brandcd',
  '스타일명': 'stylenm',
  '소싱MD': 'sourcing_md',
  '디자이너': 'designer',
  '기획MD': 'planning_md',
  '발주일': 'order_date',
  '오더타입': 'order_type',
  '복종': 'item_category',
  '아이템': 'item_name',
  '시즌': 'season',
  '컬러수': 'color_qty',
  'PO수량': 'po_qty',
  '확정납기': 'confirmed_due',
  '업체': 'vendor',
  '국가': 'country',
  '공장': 'factory',
  '납품처': 'delivery',
  '다이렉트': 'direct_ship',
  // 원단
  '원단업체': 'fabric_vendor',
  '원단스펙': 'fabric_spec',
  'BT확인': 'bt_confirm',
  'BULK확인': 'bulk_confirm',
  'KSK결과': 'ksk_result',
  'GB결과': 'gb_result',
  // 사양
  '아트워크확인': 'artwork_confirm',
  'QC1접수': 'qc1_receive',
  'QC1확인': 'qc1_confirm',
  'QC2접수': 'qc2_receive',
  'QC2확인': 'qc2_confirm',
  'QC3접수': 'qc3_receive',
  'QC3확인': 'qc3_confirm',
  'APP확인': 'app_confirm',
  'PP1접수': 'pp1_receive',
  'PP1확인': 'pp1_confirm',
  'PP2접수': 'pp2_receive',
  'PP2확인': 'pp2_confirm',
  'PP확인': 'pp_confirm',
  '매칭차트': 'matching_chart',
  '용척확인': 'yardage_confirm',
  // 생산
  '원단발주': 'fabric_order',
  '원단선적': 'fabric_ship',
  '원단입고': 'fabric_inbound',
  '재단시작': 'cutting_start',
  '봉제시작': 'sewing_start',
  '봉제완료': 'sewing_complete',
  '완성일': 'finish_date',
  '선적일': 'shipping_date',
  '검품샘플': 'acceptance_sample',
  '검품확인': 'acceptance_confirm',
  '검품완료': 'acceptance_all',
  '최종KSK': 'final_test_ksk',
  '최종GB': 'final_test_gb',
  // 입고
  '비고': 'remark',
  '비고이력': 'remark_history',
  '입고1일자': 'inbound_1_date',
  '입고1수량': 'inbound_1_qty',
  '입고2일자': 'inbound_2_date',
  '입고2수량': 'inbound_2_qty',
  '입고3일자': 'inbound_3_date',
  '입고3수량': 'inbound_3_qty',
  '입고4일자': 'inbound_4_date',
  '입고4수량': 'inbound_4_qty',
  '입고5일자': 'inbound_5_date',
  '입고5수량': 'inbound_5_qty',
  '예정수량': 'expected_qty',
  '입고율': 'expected_rate',
  '잔여수량': 'remaining_qty',
  '마감': 'is_closed',
  '과부족비고': 'over_short_remark',
  // 원가
  '예상원가': 'expected_cost',
  '확정원가': 'confirmed_cost',
  '확정단가': 'confirmed_price',
  '혼용률': 'material_mix',
  '워시코드': 'wash_code',
}

// 엑셀 행 데이터를 DB 컬럼명으로 변환
function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const dbCol = COLUMN_MAP[key] || key
    // 빈 문자열은 null로 변환
    mapped[dbCol] = value === '' ? null : value
  }
  return mapped
}

// POST /api/srm/upload — 엑셀 파싱 데이터 대량 업로드
export async function POST(req: Request) {
  const body = await req.json()
  const rows: Record<string, unknown>[] = body.rows

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '업로드할 데이터가 없습니다.' }, { status: 400 })
  }

  // 엑셀 컬럼명을 DB 컬럼명으로 매핑
  const mappedRows = rows.map((row) => ({
    ...mapRow(row),
    updated_at: new Date().toISOString(),
  }))

  // 필수 필드 검증
  const invalid = mappedRows.filter((r: any) => !r.stylecd || !r.colorcd || !r.brandcd)
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `필수 필드(스타일코드, 컬러코드, 브랜드) 누락: ${invalid.length}건` },
      { status: 400 }
    )
  }

  // 500건씩 배치 업서트
  const BATCH_SIZE = 500
  let totalUpserted = 0
  const errors: string[] = []

  for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
    const batch = mappedRows.slice(i, i + BATCH_SIZE)
    const { error } = await supabaseAdmin
      .from('srm_production')
      .upsert(batch, { onConflict: 'stylecd,chasu,colorcd' })

    if (error) {
      errors.push(`배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      totalUpserted += batch.length
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: '일부 배치 실패', details: errors, upserted: totalUpserted },
      { status: 207 }
    )
  }

  return NextResponse.json({ ok: true, upserted: totalUpserted }, { status: 201 })
}
