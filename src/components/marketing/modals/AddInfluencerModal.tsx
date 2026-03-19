'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  onSaved: () => void
  projectId?: string
}

const PLATFORMS = ['instagram', 'youtube', 'tiktok']
const CATEGORIES = ['패션', '뷰티', '라이프스타일', '스포츠', '여행']

export function AddInfluencerModal({ onClose, onSaved, projectId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    handle: '',
    platform: 'instagram',
    followers: '',
    category: '패션',
    engagement_rate: '',
    profile_url: '',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          followers: Number(form.followers) || 0,
          engagement_rate: Number(form.engagement_rate) || 0,
          project_id: projectId ?? null,
        }),
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
            <h2 className="text-sm font-bold text-gray-900">인플루언서 추가</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">핸들 *</label>
                <input
                  required
                  value={form.handle}
                  onChange={e => set('handle', e.target.value)}
                  placeholder="@handle"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">플랫폼</label>
                <select
                  value={form.platform}
                  onChange={e => set('platform', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">카테고리</label>
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">팔로워</label>
                <input
                  type="number"
                  value={form.followers}
                  onChange={e => set('followers', e.target.value)}
                  placeholder="50000"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">참여율 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.engagement_rate}
                  onChange={e => set('engagement_rate', e.target.value)}
                  placeholder="3.5"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">프로필 URL</label>
                <input
                  type="url"
                  value={form.profile_url}
                  onChange={e => set('profile_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
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
              {loading ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
