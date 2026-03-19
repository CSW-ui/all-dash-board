import Link from 'next/link'
import { ArrowRight, FileText, TrendingUp, Sparkles } from 'lucide-react'

const tools = [
  { title: '보고서 생성', desc: '상품 성과, 시장 분석 보고서 자동 생성', href: '/product-planning/report-generator', icon: FileText, color: 'text-blue-500 bg-blue-50' },
  { title: '트렌드 분석', desc: '시장 트렌드, 카테고리별 성과 데이터 분석', href: '/product-planning/trend-analysis', icon: TrendingUp, color: 'text-amber-500 bg-amber-50' },
  { title: 'AI 텍스트 작성', desc: '상품 설명, 기획서, 제안서 AI 자동 작성', href: '/product-planning/ai-writer', icon: Sparkles, color: 'text-violet-500 bg-violet-50' },
]

export default function ProductPlanningPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">상품기획</h1>
        <p className="text-sm text-gray-500 mt-0.5">상품기획 업무 자동화 도구 모음</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link key={tool.href} href={tool.href} className="bg-white rounded-xl p-5 border border-surface-border shadow-sm hover:shadow-md transition-all group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${tool.color}`}>
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{tool.title}</h3>
              <p className="text-sm text-gray-500 mb-4">{tool.desc}</p>
              <span className="flex items-center gap-1 text-xs font-medium text-brand-accent group-hover:gap-2 transition-all">
                바로가기 <ArrowRight size={13} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
