import { GanttChart } from '@/components/marketing/GanttChart'

export default function IMCPlanPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">IMC 플랜</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          통합 마케팅 커뮤니케이션 캠페인 타임라인 및 상세 관리
        </p>
      </div>
      <GanttChart />
    </div>
  )
}
