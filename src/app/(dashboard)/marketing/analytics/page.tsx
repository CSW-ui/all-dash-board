import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { RevenueLineChart } from '@/components/dashboard/RevenueLineChart'
import { ChannelBreakdown } from '@/components/marketing/ChannelBreakdown'
import { marketingKpis, trendData, channelData } from '@/lib/mock-data'

export default function MarketingAnalyticsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">마케팅 분석</h1>
        <p className="text-sm text-gray-500 mt-0.5">채널 성과 분석 및 인사이트 도출</p>
      </div>

      <KpiGrid metrics={marketingKpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueLineChart data={trendData} title="월별 전환수 추이" />
        </div>
        <div>
          <ChannelBreakdown data={channelData} />
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'SNS 광고 효율 상승', desc: '3월 SNS 광고 ROAS가 전월 대비 15% 향상되었습니다. 인스타그램 릴스 형식의 광고가 높은 전환율을 기록하고 있습니다.', color: 'border-l-pink-400' },
          { title: '검색 광고 CPC 증가', desc: '봄 시즌 키워드 경쟁 심화로 CPC가 8% 상승했습니다. 롱테일 키워드 활용 전략 검토가 필요합니다.', color: 'border-l-amber-400' },
          { title: '이메일 오픈율 최고치', desc: '뉴스레터 오픈율이 32.4%로 역대 최고를 기록했습니다. 개인화 제목 최적화 전략이 효과를 발휘하고 있습니다.', color: 'border-l-emerald-400' },
        ].map((insight) => (
          <div key={insight.title} className={`bg-white rounded-xl p-5 border border-surface-border border-l-4 ${insight.color} shadow-sm`}>
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">{insight.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{insight.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
