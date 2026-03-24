import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 협력사가 업데이트 가능한 생산 필드 목록
const PRODUCTION_UPDATE_FIELDS = [
  // 원단
  'fabric_vendor', 'fabric_spec', 'bt_confirm', 'bulk_confirm', 'ksk_result', 'gb_result',
  // 사양
  'artwork_confirm', 'qc1_receive', 'qc1_confirm', 'qc2_receive', 'qc2_confirm',
  'qc3_receive', 'qc3_confirm', 'app_confirm',
  'pp1_receive', 'pp1_confirm', 'pp2_receive', 'pp2_confirm',
  'pp_confirm', 'matching_chart', 'yardage_confirm',
  // 생산 단계
  'fabric_order', 'fabric_ship', 'fabric_inbound',
  'cutting_start', 'sewing_start', 'sewing_complete',
  'finish_date', 'shipping_date',
  'acceptance_sample', 'acceptance_confirm', 'acceptance_all',
  'final_test_ksk', 'final_test_gb',
  // 입고
  'inbound_1_date', 'inbound_1_qty', 'inbound_2_date', 'inbound_2_qty',
  'inbound_3_date', 'inbound_3_qty', 'inbound_4_date', 'inbound_4_qty',
  'inbound_5_date', 'inbound_5_qty',
  'expected_qty', 'remaining_qty', 'remark',
  // 원가/사양
  'expected_cost', 'confirmed_cost', 'confirmed_price',
  'material_mix', 'wash_code',
] as const

// POST /api/vendor/submissions — 협력사 업데이트 엔드포인트
// action=respond → 납기/원가 응답 제출, 상태 → responded
// action=update → 생산 필드 업데이트
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  // 프로필에서 vendor_name 확인
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, vendor_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'vendor' || !profile.vendor_name) {
    return NextResponse.json({ error: '협력사 권한이 없습니다.' }, { status: 403 })
  }

  const vendorName = profile.vendor_name
  const body = await req.json()
  const id = body.id as string
  const action = body.action as string
  const vendor_response = body.vendor_response as { proposed_due?: string; proposed_cost?: number; comment?: string } | undefined
  const production_updates = (body.production_updates ?? body.fields) as Record<string, unknown> | undefined

  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Snowflake 기반 ID인 경우 (sf-로 시작) → stylecd_chasu_colorcd로 Supabase에 upsert
  const isSnowflakeId = id.startsWith('sf-')

  // 기존 레코드 조회
  let record: Record<string, unknown> | null = null

  if (!isSnowflakeId) {
    // 실제 Supabase ID로 조회
    const { data } = await supabaseAdmin
      .from('srm_production')
      .select('*')
      .eq('id', id)
      .single()
    record = data
  }

  // ── Case 1: 납기/원가 응답 (action=respond) ──
  if (action === 'respond' && vendor_response) {
    if (isSnowflakeId || !record) {
      // Supabase에 레코드가 없으면 → stylecd/chasu/colorcd 기반으로 생성
      // 프론트에서 추가 정보를 보내줘야 함 → body에서 가져오기
      const stylecd = body.stylecd as string
      const chasu = body.chasu as string || '01'
      const colorcd = body.colorcd as string

      if (!stylecd || !colorcd) {
        return NextResponse.json({ error: '품번/컬러 정보가 필요합니다.' }, { status: 400 })
      }

      const brandcd = body.brandcd as string || ''
      const stylenm = body.stylenm as string || ''
      const season = body.season as string || ''
      const po_qty = body.po_qty as number || 0

      // upsert: 있으면 업데이트, 없으면 생성
      const { data, error } = await supabaseAdmin
        .from('srm_production')
        .upsert({
          stylecd,
          chasu,
          colorcd,
          brandcd,
          stylenm,
          season,
          po_qty,
          vendor: vendorName,
          vendor_response: vendor_response,
          vendor_responded_at: now,
          status: 'responded',
          last_vendor_update_at: now,
          updated_at: now,
        }, { onConflict: 'stylecd,chasu,colorcd' })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 기존 레코드가 있는 경우
    if (record.vendor !== vendorName) {
      return NextResponse.json({ error: '본인 협력사의 발주만 업데이트할 수 있습니다.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('srm_production')
      .update({
        vendor_response: vendor_response,
        vendor_responded_at: now,
        status: 'responded',
        last_vendor_update_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── Case 2: 생산 필드 업데이트 (action=update) ──
  if (action === 'update' && production_updates) {
    // 허용된 필드만 필터링
    const sanitized: Record<string, unknown> = {}
    for (const key of PRODUCTION_UPDATE_FIELDS) {
      if (key in production_updates) {
        sanitized[key] = production_updates[key]
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: '업데이트 가능한 필드가 없습니다.' }, { status: 400 })
    }

    if (isSnowflakeId || !record) {
      // Supabase에 레코드 없으면 → upsert로 생성
      const stylecd = body.stylecd as string
      const chasu = body.chasu as string || '01'
      const colorcd = body.colorcd as string

      if (!stylecd || !colorcd) {
        return NextResponse.json({ error: '품번/컬러 정보가 필요합니다.' }, { status: 400 })
      }

      const brandcd = body.brandcd as string || ''
      const stylenm = body.stylenm as string || ''
      const season = body.season as string || ''
      const po_qty = body.po_qty as number || 0

      const { data, error } = await supabaseAdmin
        .from('srm_production')
        .upsert({
          stylecd,
          chasu,
          colorcd,
          brandcd,
          stylenm,
          season,
          po_qty,
          vendor: vendorName,
          ...sanitized,
          status: 'in_production',
          last_vendor_update_at: now,
          updated_at: now,
        }, { onConflict: 'stylecd,chasu,colorcd' })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 기존 레코드가 있는 경우
    if (record.vendor !== vendorName) {
      return NextResponse.json({ error: '본인 협력사의 발주만 업데이트할 수 있습니다.' }, { status: 403 })
    }

    const currentStatus = record.status as string
    const newStatus = currentStatus === 'confirmed' ? 'in_production' : currentStatus

    const { data, error } = await supabaseAdmin
      .from('srm_production')
      .update({
        ...sanitized,
        status: newStatus,
        last_vendor_update_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'action(respond/update)과 해당 데이터가 필요합니다.' }, { status: 400 })
}
