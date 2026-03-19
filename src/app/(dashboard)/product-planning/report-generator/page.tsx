import { ReportGenerator } from '@/components/automation/ReportGenerator'

export default function ProductReportPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">보고서 생성</h1>
        <p className="text-sm text-gray-500 mt-0.5">상품 성과, 시장 분석 보고서를 자동으로 생성합니다</p>
      </div>
      <ReportGenerator />
    </div>
  )
}
