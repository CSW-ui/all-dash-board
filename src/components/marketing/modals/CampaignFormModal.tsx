'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductSearchInput } from './ProductSearchInput'

interface ProductRow {
  product_code: string
  product_name: string
}

interface Brand {
  code: string
  name: string
}

interface FormData {
  title: string
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed'
  color: string
  ooh_cost: string
  notes: string
  products: ProductRow[]
  brand: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
  initial?: Partial<FormData> & { id?: string }
}

const COLORS = ['#e91e63', '#7c3aed', '#0891b2', '#059669', '#f59e0b', '#ef4444']

const STATUS_OPTIONS = [
  { value: 'planned', label: '예정' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
]

export function CampaignFormModal({ onClose, onSaved, initial }: Props) {
  const isEdit = !!initial?.id
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])

  const [form, setForm] = useState<FormData>({
    title: initial?.title ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    status: initial?.status ?? 'planned',
    color: initial?.color ?? '#e91e63',
    ooh_cost: String(initial?.ooh_cost ?? ''),
    notes: initial?.notes ?? '',
    products: initial?.products ?? [],
    brand: (initial as Record<string, unknown>)?.brand as string ?? '',
  })

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setBrands(data)
    }).catch(() => {})
  }, [])

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload = {
        ...form,
        ooh_cost: Number(form.ooh_cost) || 0,
        products: form.products.filter(p => p.product_code && p.product_name),
      }

      const res = await fetch(
        isEdit ? `/api/campaigns/${initial!.id}` : '/api/campaigns',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

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
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border sticky top-0 bg-white z-10">
            <h2 className="text-sm font-bold text-gray-900">{isEdit ? '캠페인 수정' : '새 캠페인 등록'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">캠페인명 *</label>
              <input
                required
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="예: 2026 S/S 런칭 캠페인"
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">시작일 *</label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={e => updateField('start_date', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">종료일 *</label>
                <input
                  required
                  type="date"
                  value={form.end_date}
                  onChange={e => updateField('end_date', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
            </div>

            {/* Brand */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">브랜드</label>
              <select
                value={form.brand}
                onChange={e => updateField('brand', e.target.value)}
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              >
                <option value="">전체</option>
                {brands.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
              </select>
            </div>

            {/* Status + Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">상태</label>
                <select
                  value={form.status}
                  onChange={e => updateField('status', e.target.value as FormData['status'])}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">색상</label>
                <div className="flex gap-2 mt-1">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateField('color', c)}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all',
                        form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* OOH Cost */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">OOH 광고비 (원)</label>
              <input
                type="number"
                value={form.ooh_cost}
                onChange={e => updateField('ooh_cost', e.target.value)}
                placeholder="0"
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              />
            </div>

            {/* Products */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">등록 상품</label>
              <ProductSearchInput
                value={form.products}
                onChange={(products) => updateField('products', products)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">메모</label>
              <textarea
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={2}
                placeholder="캠페인 메모"
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-surface-border flex justify-end gap-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-surface-border hover:bg-surface-subtle"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm font-medium bg-brand-accent text-white px-4 py-2 rounded-lg hover:bg-brand-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? '저장 중...' : isEdit ? '수정 완료' : '캠페인 등록'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
