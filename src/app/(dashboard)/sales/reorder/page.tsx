import { RefreshCw } from 'lucide-react'

export default function ReorderPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
        <RefreshCw size={28} className="text-blue-500" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-bold text-gray-900">재발주 자동화</h1>
        <p className="text-sm text-gray-400 mt-1">판매 데이터 기반 자동 재발주 시스템</p>
        <p className="text-xs text-gray-300 mt-4">준비 중입니다</p>
      </div>
    </div>
  )
}
