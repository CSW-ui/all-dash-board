'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Shield, Save, Plus, Trash2, AlertCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'

const BRANDS = [
  { code: 'CO', label: '커버낫', color: '#e91e63' },
  { code: 'LE', label: '리(Lee)', color: '#3b82f6' },
  { code: 'WA', label: '와키윌리', color: '#10b981' },
  { code: 'CK', label: '커버낫 키즈', color: '#f59e0b' },
  { code: 'LK', label: 'Lee Kids', color: '#8b5cf6' },
]

const ROLES = [
  { value: 'admin', label: '관리자', desc: '전체 브랜드 접근, 시스템 설정' },
  { value: 'manager', label: '매니저', desc: '지정 브랜드 접근, 데이터 조회' },
  { value: 'staff', label: '스태프', desc: '지정 브랜드 조회 전용' },
]

interface UserRow {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'staff'
  brands: string[]
  created_at: string
  _dirty?: boolean
}

export function UserPermissions() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createSupabaseBrowserClient()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setUsers((data ?? []).map(u => ({ ...u, _dirty: false })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateUser = (id: string, field: string, value: any) => {
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, [field]: value, _dirty: true } : u
    ))
  }

  const toggleBrand = (id: string, brandCode: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u
      const brands = u.brands.includes(brandCode)
        ? u.brands.filter(b => b !== brandCode)
        : [...u.brands, brandCode]
      return { ...u, brands, _dirty: true }
    }))
  }

  const saveUser = async (user: UserRow) => {
    setSaving(user.id); setError(null); setSuccess(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({
        name: user.name,
        role: user.role,
        brands: user.role === 'admin' ? [] : user.brands,
      })
      .eq('id', user.id)

    if (err) setError(`저장 실패: ${err.message}`)
    else {
      setSuccess(`${user.name || user.email} 권한이 저장되었습니다`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, _dirty: false } : u))
      setTimeout(() => setSuccess(null), 3000)
    }
    setSaving(null)
  }

  const deleteUser = async (user: UserRow) => {
    if (!confirm(`${user.name || user.email} 프로필을 삭제하시겠습니까?`)) return
    const { error: err } = await supabase.from('profiles').delete().eq('id', user.id)
    if (err) setError(`삭제 실패: ${err.message}`)
    else fetchUsers()
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-700">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-subtle animate-pulse rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          등록된 사용자가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id}
              className={cn('bg-white border rounded-xl p-4 transition-colors',
                user._dirty ? 'border-amber-300 bg-amber-50/30' : 'border-surface-border')}>

              <div className="flex items-start justify-between gap-4">
                {/* 사용자 정보 */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <input
                      type="text"
                      value={user.name}
                      onChange={e => updateUser(user.id, 'name', e.target.value)}
                      className="text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-accent focus:outline-none w-full"
                      placeholder="이름"
                    />
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>

                {/* 역할 선택 */}
                <div className="flex items-center gap-2 shrink-0">
                  <Shield size={13} className="text-gray-400" />
                  <select
                    value={user.role}
                    onChange={e => updateUser(user.id, 'role', e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-accent"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 브랜드 권한 (admin이 아닐 때만) */}
              {user.role !== 'admin' ? (
                <div className="mt-3 pt-3 border-t border-surface-border">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">접근 가능 브랜드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BRANDS.map(b => {
                      const active = user.brands.includes(b.code)
                      return (
                        <button key={b.code}
                          onClick={() => toggleBrand(user.id, b.code)}
                          className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                            active
                              ? 'text-white border-transparent shadow-sm'
                              : 'text-gray-500 border-gray-200 hover:border-gray-400 bg-white')
                          }
                          style={active ? { background: b.color } : {}}>
                          {b.label}
                        </button>
                      )
                    })}
                    {user.brands.length === 0 && (
                      <span className="text-[10px] text-amber-500">브랜드를 선택해주세요</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-surface-border">
                  <p className="text-[10px] text-gray-400">관리자 — 전체 브랜드 접근 가능</p>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={() => deleteUser(user)}
                  className="text-[10px] text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors">
                  <Trash2 size={12} />
                </button>
                {user._dirty && (
                  <button onClick={() => saveUser(user)}
                    disabled={saving === user.id}
                    className="flex items-center gap-1.5 text-xs font-medium bg-brand-accent text-white px-3 py-1.5 rounded-lg hover:bg-brand-accent-hover transition-colors disabled:opacity-50">
                    <Save size={12} />
                    {saving === user.id ? '저장 중...' : '저장'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center mt-4">
        새 사용자는 Supabase에서 회원가입 후 이 페이지에서 권한을 설정합니다
      </p>
    </div>
  )
}
