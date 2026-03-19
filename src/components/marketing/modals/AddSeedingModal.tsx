'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface CampaignOption {
  id: string
  title: string
  campaign_products: { product_code: string; product_name: string }[]
}

interface InfluencerOption {
  id: string
  handle: string
  platform: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
  defaultInfluencer?: { id: string; handle: string }
  projectId?: string
}

const SEEDING_TYPES = ['제품발송', '콘텐츠의뢰']

export function AddSeedingModal({ onClose, onSaved, defaultInfluencer, projectId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([])

  const [form, setForm] = useState({
    campaign_id: '',
    influencer_id: defaultInfluencer?.id ?? '',
    product_code: '',
    product_name: '',
    seeding_date: new Date().toISOString().slice(0, 10),
    seeding_type: '제품발송',
    status: '발송완료',
  })

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCampaigns(d)
    }).catch(() => {})
    fetch('/api/influencers').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setInfluencers(d)
    }).catch(() => {})
  }, [])

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const selectedCampaign = campaigns.find(c => c.id === form.campaign_id)
  const products = selectedCampaign?.campaign_products ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/seeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, project_id: projectId ?? null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <h2 className="text-sm font-bold text-gray-900">시딩 등록</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">캠페인 *</label>
              <select
                required
                value={form.campaign_id}
                onChange={e => { set('campaign_id', e.target.value); set('product_code', ''); set('product_name', '') }}
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              >
                <option value="">선택</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            {products.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">상품</label>
                <select
                  value={form.product_code}
                  onChange={e => {
                    const p = products.find(x => x.product_code === e.target.value)
                    set('product_code', e.target.value)
                    set('product_name', p?.product_name ?? '')
                  }}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                >
                  <option value="">전체 / 직접입력</option>
                  {products.map(p => (
                    <option key={p.product_code} value={p.product_code}>
                      {p.product_code} · {p.product_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!form.product_code && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">상품코드</label>
                  <input
                    value={form.product_code}
                    onChange={e => set('product_code', e.target.value)}
                    placeholder="CO26S-001"
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">상품명</label>
                  <input
                    value={form.product_name}
                    onChange={e => set('product_name', e.target.value)}
                    placeholder="상품명"
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">인플루언서 *</label>
              <select
                required
                value={form.influencer_id}
                onChange={e => set('influencer_id', e.target.value)}
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              >
                <option value="">선택</option>
                {influencers.map(inf => (
                  <option key={inf.id} value={inf.id}>
                    {inf.handle} ({inf.platform})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">시딩 날짜</label>
                <input
                  type="date"
                  value={form.seeding_date}
                  onChange={e => set('seeding_date', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">유형</label>
                <select
                  value={form.seeding_type}
                  onChange={e => set('seeding_type', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                >
                  {SEEDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-surface-border flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-surface-border hover:bg-surface-subtle">
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm font-medium bg-brand-accent text-white px-4 py-2 rounded-lg hover:bg-brand-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
