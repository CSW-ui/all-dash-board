import Link from 'next/link'
import { ArrowRight, CalendarRange, Users, MonitorPlay } from 'lucide-react'

const tools = [
  {
    title: 'IMC 플랜',
    desc: '캠페인 간트차트 설계, 상품·인플루언서·광고 통합 관리',
    href: '/marketing/imc-plan',
    icon: CalendarRange,
    color: 'text-pink-500 bg-pink-50',
  },
  {
    title: '인플루언서 추적',
    desc: 'Apify 수집 → 시딩 진행 → 게시 결과 3단계 워크플로우',
    href: '/marketing/influencer',
    icon: Users,
    color: 'text-violet-500 bg-violet-50',
  },
  {
    title: '디지털 마케팅 추적',
    desc: 'Meta 광고 성과 분석 및 Adriel 멀티채널 벤치마킹',
    href: '/marketing/digital',
    icon: MonitorPlay,
    color: 'text-blue-500 bg-blue-50',
  },
]

export default function MarketingPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">마케팅</h1>
        <p className="text-sm text-gray-500 mt-0.5">마케팅 업무 자동화 도구 모음</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-white rounded-xl p-5 border border-surface-border shadow-sm hover:shadow-md transition-all group"
            >
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
