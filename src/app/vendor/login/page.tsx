'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function VendorLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  // 이미 로그인된 vendor 세션이 있으면 /vendor로 리다이렉트
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (prof?.role === 'vendor') {
          window.location.href = '/vendor'
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // vendor 역할 확인
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (prof?.role !== 'vendor') {
        await supabase.auth.signOut()
        throw new Error('협력사 계정이 아닙니다. 담당자에게 문의해 주세요.')
      }

      window.location.href = '/vendor'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 올바르지 않습니다'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16213e] via-[#1a2a4a] to-[#0f1a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <span className="text-white font-black text-xl">B</span>
          </div>
          <h1 className="text-xl font-bold text-white">B.CAVE 협력사 포털</h1>
          <p className="text-sm text-gray-400 mt-1">Vendor Portal</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vendor@example.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#e91e63] focus:ring-1 focus:ring-[#e91e63]/20"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#e91e63] focus:ring-1 focus:ring-[#e91e63]/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-medium bg-[#e91e63] text-white py-2.5 rounded-lg hover:bg-[#d81b60] disabled:opacity-50 transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          계정 문의: 비케이브 소싱팀 담당자
        </p>
      </div>
    </div>
  )
}
