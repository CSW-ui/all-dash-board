'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onCollected: () => void
  projectId?: string
}

const CATEGORIES = ['패션', '뷰티', '라이프스타일', '스포츠', '여행']

export function ApifyCollector({ onCollected, projectId }: Props) {
  const [platform, setPlatform] = useState<'instagram' | 'tiktok'>('instagram')
  const [handlesText, setHandlesText] = useState('')
  const [category, setCategory] = useState('패션')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok?: string; err?: string } | null>(null)

  async function handleCollect() {
    const handles = handlesText.split(/[\n,]+/).map(h => h.trim()).filter(Boolean)
    if (!handles.length) return

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/apify/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, handles, category, project_id: projectId ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult({ ok: `${data.collected}명 프로필 수집 완료` })
      setHandlesText('')
      onCollected()
    } catch (err) {
      setResult({ err: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Apify 프로필 수집</p>
        <div className="flex gap-1 bg-surface-subtle rounded-lg p-0.5">
          {(['instagram', 'tiktok'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                platform === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {p === 'instagram' ? 'Instagram' : 'TikTok'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">
            계정명 입력 (줄바꿈 또는 쉼표로 구분)
          </label>
          <textarea
            value={handlesText}
            onChange={e => setHandlesText(e.target.value)}
            placeholder={`account1\naccount2\naccount3\n(@ 없이 입력해도 됩니다)`}
            rows={4}
            className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent resize-none font-mono"
          />
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button
            onClick={handleCollect}
            disabled={loading || !handlesText.trim()}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-brand-accent text-white px-3 py-2 rounded-lg hover:bg-brand-accent-hover disabled:opacity-50 transition-colors"
          >
            {loading
              ? <><Loader2 size={12} className="animate-spin" /> 수집 중...</>
              : <><Download size={12} /> 수집 시작</>
            }
          </button>

          {loading && (
            <p className="text-[10px] text-gray-400 text-center">
              Apify 실행 중... 최대 2분 소요
            </p>
          )}
        </div>
      </div>

      {result?.ok && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          ✓ {result.ok}
        </div>
      )}
      {result?.err && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {result.err}
        </div>
      )}
    </div>
  )
}
