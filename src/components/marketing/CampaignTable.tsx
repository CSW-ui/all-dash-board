import { Campaign } from '@/types'
import { formatCurrency } from '@/lib/utils'

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  sns: { label: 'SNS', color: 'bg-pink-100 text-pink-700' },
  search: { label: '검색', color: 'bg-blue-100 text-blue-700' },
  email: { label: '이메일', color: 'bg-amber-100 text-amber-700' },
  display: { label: '디스플레이', color: 'bg-green-100 text-green-700' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '진행 중', color: 'bg-emerald-100 text-emerald-700' },
  paused: { label: '일시정지', color: 'bg-gray-100 text-gray-600' },
  completed: { label: '완료', color: 'bg-blue-100 text-blue-700' },
}

interface CampaignTableProps {
  campaigns: Campaign[]
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-gray-800">캠페인 현황</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">캠페인명</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">채널</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">예산</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">집행</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">전환</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {campaigns.map((c) => {
              const roas = c.spend > 0 ? ((c.conversions * 50000) / c.spend).toFixed(1) : '0'
              const ch = CHANNEL_LABELS[c.channel]
              const st = STATUS_LABELS[c.status]
              return (
                <tr key={c.id} className="hover:bg-surface-subtle transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ch.color}`}>{ch.label}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{formatCurrency(c.budget)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-gray-800">{formatCurrency(c.spend)}</span>
                    <div className="w-16 h-1 bg-surface-muted rounded-full ml-auto mt-1">
                      <div
                        className="h-full bg-brand-accent rounded-full"
                        style={{ width: `${Math.min(100, (c.spend / c.budget) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-800">{c.conversions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-accent">{roas}x</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
