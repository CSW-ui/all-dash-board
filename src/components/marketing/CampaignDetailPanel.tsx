'use client'

import { X, Package, Users, Megaphone, MapPin, Pencil, Trash2 } from 'lucide-react'
import { IMCCampaign } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  campaign: IMCCampaign
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

const statusLabel: Record<IMCCampaign['status'], { label: string; className: string }> = {
  planned: { label: '예정', className: 'bg-gray-100 text-gray-600' },
  active:  { label: '진행중', className: 'bg-emerald-50 text-emerald-700' },
  completed: { label: '완료', className: 'bg-blue-50 text-blue-700' },
}

function fmt(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`
  return n.toLocaleString('ko-KR') + '원'
}

export function CampaignDetailPanel({ campaign, onClose, onEdit, onDelete }: Props) {
  const st = statusLabel[campaign.status]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-50"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 animate-slide-in-right flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: campaign.color }}
              />
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', st.className)}>
                {st.label}
              </span>
            </div>
            <h2 className="text-sm font-bold text-gray-900 leading-snug">{campaign.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{campaign.startDate} ~ {campaign.endDate}</p>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <button onClick={onEdit} className="text-gray-400 hover:text-blue-600 p-1" title="수정">
                <Pencil size={16} />
              </button>
            )}
            {onDelete && (
              <button onClick={() => { if (confirm('삭제하시겠습니까?')) onDelete() }} className="text-gray-400 hover:text-red-600 p-1" title="삭제">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-surface-border">

          {/* Products */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Package size={13} className="text-brand-accent" />
              <p className="text-xs font-semibold text-gray-700">등록 상품</p>
            </div>
            {campaign.products.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 상품이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {campaign.products.map((p) => (
                  <div key={p.productCode} className="bg-surface-subtle rounded-lg px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-gray-800">{p.productName}</p>
                    <span className="text-xs text-gray-400 font-mono ml-2 shrink-0">{p.productCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seeding */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Users size={13} className="text-brand-accent" />
              <p className="text-xs font-semibold text-gray-700">인플루언서 시딩</p>
            </div>
            {campaign.seedingRecords.length === 0 ? (
              <p className="text-xs text-gray-400">시딩 내역이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left py-1 font-medium">핸들</th>
                      <th className="text-left py-1 font-medium">상품코드</th>
                      <th className="text-right py-1 font-medium">수량</th>
                      <th className="text-right py-1 font-medium">날짜</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {campaign.seedingRecords.map((r, i) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-1.5 font-medium">{r.influencerHandle}</td>
                        <td className="py-1.5 text-gray-500 font-mono">{r.productCode}</td>
                        <td className="py-1.5 text-right">{r.seedingQty}개</td>
                        <td className="py-1.5 text-right text-gray-400">{r.seedingDate.slice(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Megaphone size={13} className="text-brand-accent" />
              <p className="text-xs font-semibold text-gray-700">Meta 광고 연계</p>
            </div>
            {campaign.metaAds ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-subtle rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">집행</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(campaign.metaAds.spend)}</p>
                </div>
                <div className="bg-surface-subtle rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">수익</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(campaign.metaAds.revenue)}</p>
                </div>
                <div className="bg-surface-subtle rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">ROAS</p>
                  <p className="text-sm font-bold text-brand-accent mt-0.5">{campaign.metaAds.roas}x</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">연계된 Meta 광고가 없습니다.</p>
            )}
          </div>

          {/* OOH */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin size={13} className="text-brand-accent" />
              <p className="text-xs font-semibold text-gray-700">OOH 광고비</p>
              <span className="text-xs text-gray-400">(수동 입력)</span>
            </div>
            {campaign.oohCost > 0 ? (
              <div className="bg-surface-subtle rounded-lg px-3 py-2 inline-block">
                <p className="text-sm font-bold text-gray-900">{fmt(campaign.oohCost)}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">등록된 OOH 비용이 없습니다.</p>
            )}
          </div>

          {/* Notes */}
          {campaign.notes && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">메모</p>
              <p className="text-xs text-gray-600 bg-surface-subtle rounded-lg px-3 py-2">{campaign.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
