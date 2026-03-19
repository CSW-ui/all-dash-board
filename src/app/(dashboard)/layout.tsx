'use client'

import { TopNav } from '@/components/layout/TopNav'
import { AuthProvider } from '@/contexts/AuthContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-surface-subtle">
        <TopNav />
        <main className="px-4 py-3">{children}</main>
      </div>
    </AuthProvider>
  )
}
