import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 상태 전이 규칙: 현재 상태 → 허용되는 다음 상태
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['responded', 'draft'],        // 협력사가 응답하거나, MD가 취소(draft로 복귀)
  responded: ['confirmed', 'sent'],     // MD가 확정하거나, 재협상(sent로 재발송)
  confirmed: ['in_production'],         // 생산 시작
  in_production: ['completed'],         // 생산 완료
  completed: [],                        // 최종 상태
}

// 액션 → 상태 매핑
const ACTION_STATUS_MAP: Record<string, string> = {
  send: 'sent',
  confirm: 'confirmed',
  renegotiate: 'sent',
  close: 'completed',
}

// PATCH /api/srm/[id] — 단일 레코드 필드 업데이트 (인라인 셀 편집 + 상태 전이 검증)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // 상태 변경이 포함된 경우 전이 규칙 검증
  if (body.status) {
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('srm_production')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: '레코드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const currentStatus = current.status ?? 'draft'
    const allowed = STATUS_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `상태 전이 불가: ${currentStatus} → ${body.status}. 허용: [${allowed.join(', ')}]` },
        { status: 400 }
      )
    }
  }

  const { data, error } = await supabaseAdmin
    .from('srm_production')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/srm/[id] — 상태 변경 액션 (send, confirm, renegotiate, close)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { action } = body as { action: string }

  if (!action || !ACTION_STATUS_MAP[action]) {
    return NextResponse.json(
      { error: `유효하지 않은 액션입니다. 허용: [${Object.keys(ACTION_STATUS_MAP).join(', ')}]` },
      { status: 400 }
    )
  }

  const targetStatus = ACTION_STATUS_MAP[action]

  // 현재 상태 확인
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('srm_production')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: '레코드를 찾을 수 없습니다.' }, { status: 404 })
  }

  const currentStatus = current.status ?? 'draft'
  const allowed = STATUS_TRANSITIONS[currentStatus] ?? []

  if (!allowed.includes(targetStatus)) {
    return NextResponse.json(
      { error: `${action} 액션 불가: 현재 상태 '${currentStatus}'에서 '${targetStatus}'로 전이할 수 없습니다.` },
      { status: 400 }
    )
  }

  // 상태 업데이트 + 액션별 추가 필드
  const updateFields: Record<string, unknown> = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
  }

  // 액션별 타임스탬프 + 추가 필드 기록
  if (action === 'send') updateFields.sent_at = new Date().toISOString()
  if (action === 'confirm') updateFields.confirmed_at = new Date().toISOString()
  if (action === 'close') {
    updateFields.is_closed = true
    updateFields.completed_at = new Date().toISOString()
  }
  if (action === 'renegotiate') {
    updateFields.md_comment = body.md_comment ?? null
    updateFields.sent_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('srm_production')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/srm/[id] — 레코드 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('srm_production').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
