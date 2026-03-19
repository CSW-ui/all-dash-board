import { ExcelUploader } from '@/components/admin/ExcelUploader'
import { UserPermissions } from '@/components/admin/UserPermissions'
import { Settings, Database, FileSpreadsheet, Users } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">관리자 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">데이터 업로드 및 시스템 관리</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: FileSpreadsheet, title: '목표매출 업로드', desc: '월별 브랜드별 목표 Excel', color: 'bg-emerald-50 text-emerald-600', active: true },
          { icon: Database, title: 'Snowflake 연동', desc: 'BCAVE.SEWON 실시간 연결', color: 'bg-blue-50 text-blue-600', active: false },
          { icon: Users, title: '사용자 권한 관리', desc: '브랜드별 접근 권한', color: 'bg-violet-50 text-violet-600', active: true },
        ].map((item) => (
          <div
            key={item.title}
            className={`bg-white rounded-xl p-4 border shadow-sm flex items-center gap-3 ${item.active ? 'border-brand-accent/30' : 'border-surface-border opacity-60'}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}>
              <item.icon size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
            {item.active && (
              <span className="ml-auto text-xs bg-brand-accent-light text-brand-accent font-medium px-2 py-0.5 rounded-full">활성</span>
            )}
          </div>
        ))}
      </div>

      {/* Excel Upload Section */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-gray-800">월별 목표매출 업로드</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            업로드된 목표 데이터는 대시보드 차트의 목표선(점선)에 반영됩니다
          </p>
        </div>
        <div className="p-5">
          <ExcelUploader />
        </div>
      </div>
      {/* User Permissions Section */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-gray-800">사용자 브랜드 권한 관리</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            사용자별 접근 가능한 브랜드를 설정합니다. 관리자는 전체 브랜드에 접근 가능합니다.
          </p>
        </div>
        <div className="p-5">
          <UserPermissions />
        </div>
      </div>
    </div>
  )
}
