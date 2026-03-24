import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/vendor/review — 협력사 제출 승인/반려 (MD 전용)
// 승인 시 srm_production 테이블에 데이터 반영
export async function POST(req: Request) {
  // 현재 로그인 사용자 확인
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  // 사용자 프로필 조회 (MD/admin만 허용)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: '승인 권한이 없습니다.' }, { status: 403 })
  }

  const body = await req.json()
  const { submission_id, action, reject_reason } = body

  if (!submission_id || !action) {
    return NextResponse.json({ error: 'submission_id와 action이 필요합니다.' }, { status: 400 })
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action은 approve 또는 reject만 가능합니다.' }, { status: 400 })
  }

  // 제출 데이터 조회
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('vendor_submissions')
    .select('*')
    .eq('id', submission_id)
    .single()

  if (fetchError || !submission) {
    return NextResponse.json({ error: '제출 데이터를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (submission.status !== 'pending') {
    return NextResponse.json({ error: '이미 처리된 제출건입니다.' }, { status: 400 })
  }

  // 반려 처리
  if (action === 'reject') {
    const { data, error } = await supabaseAdmin
      .from('vendor_submissions')
      .update({
        status: 'rejected',
        reject_reason: reject_reason ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, submission: data })
  }

  // 승인 처리: 제출 데이터를 srm_production에 반영
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // submission_type에 따라 반영할 필드 결정
  if (submission.submission_type === 'inbound_schedule' && submission.inbound_schedule) {
    const schedule = submission.inbound_schedule as Record<string, unknown>
    if (schedule.inbound_1_date) updatePayload.inbound_1_date = schedule.inbound_1_date
    if (schedule.inbound_1_qty) updatePayload.inbound_1_qty = schedule.inbound_1_qty
    if (schedule.inbound_2_date) updatePayload.inbound_2_date = schedule.inbound_2_date
    if (schedule.inbound_2_qty) updatePayload.inbound_2_qty = schedule.inbound_2_qty
    if (schedule.inbound_3_date) updatePayload.inbound_3_date = schedule.inbound_3_date
    if (schedule.inbound_3_qty) updatePayload.inbound_3_qty = schedule.inbound_3_qty
    if (schedule.inbound_4_date) updatePayload.inbound_4_date = schedule.inbound_4_date
    if (schedule.inbound_4_qty) updatePayload.inbound_4_qty = schedule.inbound_4_qty
    if (schedule.inbound_5_date) updatePayload.inbound_5_date = schedule.inbound_5_date
    if (schedule.inbound_5_qty) updatePayload.inbound_5_qty = schedule.inbound_5_qty
  }

  if (submission.submission_type === 'material_mix' && submission.material_data) {
    const material = submission.material_data as Record<string, unknown>
    if (material.material_mix) updatePayload.material_mix = material.material_mix
  }

  if (submission.submission_type === 'wash_code' && submission.wash_data) {
    const wash = submission.wash_data as Record<string, unknown>
    if (wash.wash_code) updatePayload.wash_code = wash.wash_code
  }

  // srm_production 업데이트 (stylecd + chasu + colorcd로 매칭)
  const { error: updateError } = await supabaseAdmin
    .from('srm_production')
    .update(updatePayload)
    .eq('stylecd', submission.stylecd)
    .eq('chasu', submission.chasu)
    .eq('colorcd', submission.colorcd)

  if (updateError) {
    return NextResponse.json({ error: `생산 데이터 반영 실패: ${updateError.message}` }, { status: 500 })
  }

  // 제출 상태를 approved로 변경
  const { data, error } = await supabaseAdmin
    .from('vendor_submissions')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submission_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, submission: data })
}
