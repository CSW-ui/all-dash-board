'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  seedingRecordId: string
  influencerHandle: string
  onClose: () => void
  onSaved: () => void
}

export function SeedingResultModal({ seedingRecordId, influencerHandle, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    post_url: '',
    views: '',
    likes: '',
    comments: '',
    estimated_reach: '',
    is_posted: true,
    posted_at: new Date().toISOString().slice(0, 10),
  })

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/seeding/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seeding_record_id: seedingRecordId,
          post_url: form.post_url || null,
          views: Number(form.views) || 0,
          likes: Number(form.likes) || 0,
          comments: Number(form.comments) || 0,
          estimated_reach: Number(form.estimated_reach) || 0,
          is_posted: form.is_posted,
          posted_at: form.is_posted ? form.posted_at : null,
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
            <div>
              <h2 className="text-sm font-bold text-gray-900">결과 입력</h2>
              <p className="text-xs text-gray-500">{influencerHandle}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">게시물 URL</label>
              <input
                type="url"
                value={form.post_url}
                onChange={e => set('post_url', e.target.value)}
                placeholder="https://..."
                className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">조회수</label>
                <input
                  type="number"
                  value={form.views}
                  onChange={e => set('views', e.target.value)}
                  placeholder="10000"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">좋아요</label>
                <input
                  type="number"
                  value={form.likes}
                  onChange={e => set('likes', e.target.value)}
                  placeholder="500"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">댓글</label>
                <input
                  type="number"
                  value={form.comments}
                  onChange={e => set('comments', e.target.value)}
                  placeholder="50"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">추정 도달</label>
                <input
                  type="number"
                  value={form.estimated_reach}
                  onChange={e => set('estimated_reach', e.target.value)}
                  placeholder="30000"
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_posted}
                  onChange={e => set('is_posted', e.target.checked)}
                  className="accent-brand-accent"
                />
                게시 완료
              </label>
              {form.is_posted && (
                <input
                  type="date"
                  value={form.posted_at}
                  onChange={e => set('posted_at', e.target.value)}
                  className="text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent"
                />
              )}
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
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
