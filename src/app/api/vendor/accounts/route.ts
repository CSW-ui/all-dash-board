import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/vendor/accounts — 협력사 계정 목록 조회
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, role, vendor_name, created_at')
    .eq('role', 'vendor')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/vendor/accounts — 협력사 계정 생성
export async function POST(req: Request) {
  const { email, password, name, vendor_name } = await req.json()

  if (!email || !password || !vendor_name) {
    return NextResponse.json({ error: '이메일, 비밀번호, 협력사명은 필수입니다' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })
  }

  // 1. Supabase Auth로 사용자 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 이메일 인증 건너뛰기
  })

  if (authError) {
    if (authError.message.includes('already')) {
      return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // 2. profiles 테이블에 vendor 역할로 등록
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      name: name || vendor_name,
      role: 'vendor',
      vendor_name,
      brands: [],
    }, { onConflict: 'id' })

  if (profileError) {
    // Auth는 생성됐지만 프로필 실패 → 롤백
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: `프로필 생성 실패: ${profileError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    id: authData.user.id,
    email,
    name: name || vendor_name,
    vendor_name,
  })
}

// DELETE /api/vendor/accounts — 협력사 계정 삭제
export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID 필수' }, { status: 400 })

  // profiles 삭제
  await supabaseAdmin.from('profiles').delete().eq('id', id)
  // auth 삭제
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
