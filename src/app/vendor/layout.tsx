'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// 협력사 전용 레이아웃 (사이드바 없음)
function VendorShell({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // /vendor/login 경로는 인증 체크 없이 바로 렌더링
  const isLoginPage = pathname === '/vendor/login'

  useEffect(() => {
    if (!isLoginPage && !loading && (!profile || profile.role !== 'vendor')) {
      router.replace('/vendor/login')
    }
  }, [loading, profile, router, isLoginPage])

  // 로그인 페이지는 layout 없이 바로 표시
  if (isLoginPage) return <>{children}</>

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  // 권한 없음 — 리다이렉트 대기
  if (!profile || profile.role !== 'vendor') return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 바 */}
      <header className="h-14 bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-4">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center">
              <span className="text-white text-sm font-black">B</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">B.CAVE 협력사 포털</p>
              <p className="text-[10px] text-gray-400">Vendor Portal</p>
            </div>
          </div>

          {/* 업체명 + 로그아웃 */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-700">{profile.vendor_name ?? profile.name}</p>
              <p className="text-[10px] text-gray-400">{profile.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VendorShell>{children}</VendorShell>
    </AuthProvider>
  )
}
