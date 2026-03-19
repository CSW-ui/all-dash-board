import { Truck } from 'lucide-react'

export default function AllocationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
        <Truck size={28} className="text-emerald-500" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-bold text-gray-900">채널별 물량배분 자동화</h1>
        <p className="text-sm text-gray-400 mt-1">채널 판매 성과 기반 최적 물량 배분</p>
        <p className="text-xs text-gray-300 mt-4">준비 중입니다</p>
      </div>
    </div>
  )
}
