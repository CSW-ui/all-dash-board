import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { ChannelBreakdown } from '@/components/marketing/ChannelBreakdown'
import { CampaignTable } from '@/components/marketing/CampaignTable'
import { marketingKpis, channelData, campaigns } from '@/lib/mock-data'

export default function CampaignDashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">IMC 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">통합 마케팅 커뮤니케이션 성과 현황</p>
        </div>
        <select className="text-sm border border-surface-border rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
          <option>2026년 3월</option>
          <option>2026년 2월</option>
          <option>2026년 1월</option>
        </select>
      </div>

      <KpiGrid metrics={marketingKpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ChannelBreakdown data={channelData} />
        </div>
        <div className="lg:col-span-2">
          <CampaignTable campaigns={campaigns} />
        </div>
      </div>
    </div>
  )
}
