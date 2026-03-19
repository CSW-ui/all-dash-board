'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, CheckCircle, Clock, Send, Plus, Trash2, ClipboardList, ChevronRight, ChevronUp, ChevronDown, X, Instagram, Youtube, RefreshCw, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/formatters'
import { ApifyCollector } from './ApifyCollector'
import { AddInfluencerModal } from './modals/AddInfluencerModal'
import { AddSeedingModal } from './modals/AddSeedingModal'
import { SeedingResultModal } from './modals/SeedingResultModal'

// ─── Types ───────────────────────────────────────────────────────────

interface Influencer {
  id: string
  handle: string
  platform: string
  followers: number
  category: string
  engagement_rate: number
  status: string
  notes: string | null
  collected_at: string
  full_name: string | null
  biography: string | null
  is_verified: boolean
  profile_pic_url: string | null
  posts_last_30d: number
}

interface SeedingRow {
  id: string
  campaignTitle: string
  productCode: string
  productName: string
  influencerHandle: string
  platform: string
  seedingDate: string
  seedingType: string
  status: string
}

interface ResultRow {
  seedingRecordId: string
  influencerHandle: string
  platform: string
  postUrl?: string
  views: number
  likes: number
  comments: number
  estimatedReach: number
  isPosted: boolean
  postedAt?: string
}

// ─── Constants ───────────────────────────────────────────────────────

const TABS = [
  { id: 0, label: '인플루언서 풀', desc: '수집 이력' },
  { id: 1, label: '후보 리스트', desc: '검토 이력' },
  { id: 2, label: '시딩 기록', desc: '발송 이력' },
  { id: 3, label: '결과 기록', desc: '게시 이력' },
]

const STATUS_BADGE: Record<string, string> = {
  '미검토': 'bg-gray-100 text-gray-500',
  '후보':   'bg-amber-50 text-amber-700',
  '선정':   'bg-blue-50 text-blue-700',
  '제외':   'bg-red-50 text-red-400',
}

const SEEDING_CFG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  '연락중':   { label: '연락중',   icon: <Clock size={11} />,       cls: 'bg-gray-100 text-gray-600' },
  '발송완료': { label: '발송완료', icon: <Send size={11} />,        cls: 'bg-amber-50 text-amber-700' },
  '수령확인': { label: '수령확인', icon: <Clock size={11} />,       cls: 'bg-blue-50 text-blue-700' },
  '게시완료': { label: '게시완료', icon: <CheckCircle size={11} />, cls: 'bg-emerald-50 text-emerald-700' },
}

const SEEDING_NEXT: Record<string, string> = {
  '연락중': '발송완료', '발송완료': '수령확인', '수령확인': '게시완료',
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} className="text-pink-500" />,
  youtube:   <Youtube size={12} className="text-red-500" />,
  tiktok:    <span className="text-[10px] font-bold text-gray-700">TT</span>,
}

const FOLLOWER_RANGES = [
  { label: '전체', min: 0, max: Infinity },
  { label: '나노 (~1만)', min: 0, max: 10000 },
  { label: '마이크로 (1~10만)', min: 10000, max: 100000 },
  { label: '매크로 (10~100만)', min: 100000, max: 1000000 },
  { label: '메가 (100만+)', min: 1000000, max: Infinity },
]

// ─── Component ───────────────────────────────────────────────────────

interface SeedingTrackerProps {
  projectId?: string
  onStatsChange?: () => void
}

export function SeedingTracker({ projectId, onStatsChange }: SeedingTrackerProps = {}) {
  const [tab, setTab] = useState(0)
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [seedings, setSeedings] = useState<SeedingRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(false)

  // Tab 0 filters
  const [fPlatform, setFPlatform] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fFollowers, setFFollowers] = useState(0)
  const [fEngagement, setFEngagement] = useState(0)
  const [fStatus, setFStatus] = useState('')
  const [fQ, setFQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Sorting (tab 0 pool)
  const [sortCol, setSortCol] = useState<string>('collected_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  // Modals
  const [showAddInfluencer, setShowAddInfluencer] = useState(false)
  const [showAddSeeding, setShowAddSeeding] = useState(false)
  const [seedingTarget, setSeedingTarget] = useState<Influencer | null>(null)
  const [resultTarget, setResultTarget] = useState<{ id: string; handle: string } | null>(null)
  const [editNotes, setEditNotes] = useState<{ id: string; notes: string } | null>(null)
  const [recollecting, setRecollecting] = useState<string | null>(null)
  const [editHandle, setEditHandle] = useState<{ id: string; value: string } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b, c] = await Promise.all([
        fetch(projectId ? `/api/influencers?project_id=${projectId}` : '/api/influencers').then(r => r.json()),
        fetch(projectId ? `/api/seeding?project_id=${projectId}` : '/api/seeding').then(r => r.json()),
        fetch(projectId ? `/api/seeding/results?project_id=${projectId}` : '/api/seeding/results').then(r => r.json()),
      ])
      if (Array.isArray(a)) setInfluencers(a)
      if (Array.isArray(b)) setSeedings(b)
      if (Array.isArray(c)) setResults(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function patchInfluencer(id: string, body: object) {
    await fetch(`/api/influencers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    fetchAll()
    onStatsChange?.()
  }

  async function bulkCandidate() {
    await Promise.all(Array.from(selected).map(id => patchInfluencer(id, { status: '후보' })))
    setSelected(new Set())
  }

  async function bulkDelete() {
    if (!confirm(`선택한 ${selected.size}명을 삭제하시겠습니까?`)) return
    await Promise.all(Array.from(selected).map(id =>
      fetch(`/api/influencers/${id}`, { method: 'DELETE' })
    ))
    setSelected(new Set())
    fetchAll()
  }

  async function saveNotes(id: string, notes: string) {
    await patchInfluencer(id, { notes })
    setEditNotes(null)
  }

  async function saveHandle(id: string, newHandle: string) {
    const handle = newHandle.trim()
    if (!handle) return
    const normalized = handle.startsWith('@') ? handle : `@${handle}`
    await patchInfluencer(id, { handle: normalized })
    setEditHandle(null)
    // Auto-recollect if instagram
    const inf = influencers.find(i => i.id === id)
    if (inf?.platform === 'instagram') {
      setRecollecting(id)
      try {
        const cleanHandle = normalized.replace(/^@/, '')
        const res = await fetch('/api/apify/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'instagram', handles: [cleanHandle], category: inf.category, project_id: projectId ?? null }),
        })
        if (res.ok) fetchAll()
      } finally {
        setRecollecting(null)
      }
    }
  }

  async function advanceSeeding(id: string, current: string) {
    const next = SEEDING_NEXT[current]
    if (!next) return
    await fetch(`/api/seeding/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    fetchAll()
  }

  async function deleteInfluencer(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/influencers/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function deleteSeeding(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/seeding/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  // Filtered pool
  const range = FOLLOWER_RANGES[fFollowers]
  const filteredPool = influencers.filter(inf => {
    if (fPlatform && inf.platform !== fPlatform) return false
    if (fCategory && inf.category !== fCategory) return false
    if (inf.followers < range.min || inf.followers > range.max) return false
    if (fEngagement > 0 && inf.engagement_rate < fEngagement) return false
    if (fStatus && inf.status !== fStatus) return false
    if (fQ && !inf.handle.toLowerCase().includes(fQ.toLowerCase())) return false
    return true
  })

  const pool = [...filteredPool].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortCol) {
      case 'handle':        return a.handle.localeCompare(b.handle) * dir
      case 'followers':     return (a.followers - b.followers) * dir
      case 'engagement_rate': return (a.engagement_rate - b.engagement_rate) * dir
      case 'engagement_abs': {
        const aVal = Math.round(a.engagement_rate / 100 * a.followers)
        const bVal = Math.round(b.engagement_rate / 100 * b.followers)
        return (aVal - bVal) * dir
      }
      case 'posts_last_30d': return (a.posts_last_30d - b.posts_last_30d) * dir
      case 'collected_at':  return a.collected_at.localeCompare(b.collected_at) * dir
      default: return 0
    }
  })

  const candidates = influencers.filter(i => ['후보', '선정', '제외'].includes(i.status))
  const categories = Array.from(new Set(influencers.map(i => i.category).filter(Boolean)))

  const counts = {
    pool: influencers.length,
    candidate: influencers.filter(i => ['후보', '선정'].includes(i.status)).length,
    seeding: seedings.length,
    result: results.filter(r => r.isPosted).length,
  }

  return (
    <div className="space-y-4">

      {/* Funnel */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-surface-border px-4 py-3 shadow-sm w-fit">
        {[
          { label: '수집', n: counts.pool,      color: 'text-gray-700' },
          { label: '후보', n: counts.candidate, color: 'text-amber-600' },
          { label: '시딩', n: counts.seeding,   color: 'text-blue-600' },
          { label: '게시', n: counts.result,    color: 'text-emerald-600' },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
            <div className="flex items-center gap-1.5 px-2">
              <span className={cn('text-sm font-bold', s.color)}>{s.n}</span>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-subtle rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 rounded-lg text-xs font-medium transition-all',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
            <span className="ml-1 text-gray-400 font-normal hidden sm:inline">· {t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Tab 0: 인플루언서 풀 ── */}
      {tab === 0 && (
        <div className="space-y-3">
          <ApifyCollector onCollected={fetchAll} projectId={projectId} />

          {/* Filters */}
          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              {[
                <select key="p" value={fPlatform} onChange={e => setFPlatform(e.target.value)}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent">
                  <option value="">전체 플랫폼</option>
                  {['instagram','tiktok','youtube'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>,
                <select key="c" value={fCategory} onChange={e => setFCategory(e.target.value)}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent">
                  <option value="">전체 카테고리</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>,
                <select key="f" value={fFollowers} onChange={e => setFFollowers(Number(e.target.value))}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent">
                  {FOLLOWER_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                </select>,
                <select key="e" value={fEngagement} onChange={e => setFEngagement(Number(e.target.value))}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent">
                  <option value={0}>참여율 전체</option>
                  <option value={3}>3%+</option>
                  <option value={5}>5%+</option>
                  <option value={10}>10%+</option>
                </select>,
                <select key="s" value={fStatus} onChange={e => setFStatus(e.target.value)}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent">
                  <option value="">전체 상태</option>
                  {['미검토','후보','선정','제외'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>,
                <input key="q" value={fQ} onChange={e => setFQ(e.target.value)}
                  placeholder="핸들 검색"
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent" />,
              ]}
            </div>
          </div>

          {/* Bulk action */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-brand-accent-light border border-brand-accent/20 rounded-xl px-4 py-2.5">
              <span className="text-xs font-medium text-brand-accent">{selected.size}명 선택됨</span>
              <button onClick={bulkCandidate}
                className="text-xs font-medium bg-brand-accent text-white px-3 py-1.5 rounded-lg hover:bg-brand-accent-hover transition-colors">
                후보 등록
              </button>
              <button onClick={bulkDelete}
                className="text-xs font-medium bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                삭제
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Pool table */}
          <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">
                수집된 인플루언서 <span className="text-gray-400 font-normal ml-1">{pool.length}명</span>
              </p>
              <button onClick={() => setShowAddInfluencer(true)}
                className="flex items-center gap-1 text-xs text-brand-accent border border-dashed border-brand-accent/40 rounded-lg px-2.5 py-1.5 hover:bg-brand-accent-light transition-colors">
                <Plus size={11} /> 수동 추가
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-xs text-gray-400">불러오는 중...</div>
            ) : pool.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">수집된 인플루언서가 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2.5">
                        <input type="checkbox"
                          checked={selected.size === pool.length && pool.length > 0}
                          onChange={e => setSelected(e.target.checked ? new Set(pool.map(i => i.id)) : new Set())}
                          className="accent-brand-accent" />
                      </th>
                      {[
                        { col: 'handle', label: '핸들', align: 'left' },
                        { col: 'platform', label: '플랫폼', align: 'left' },
                        { col: 'followers', label: '팔로워', align: 'right' },
                        { col: 'category', label: '카테고리', align: 'left' },
                        { col: 'engagement_rate', label: '참여율', align: 'right' },
                        { col: 'engagement_abs', label: '참여수', align: 'right' },
                        { col: 'posts_last_30d', label: '30일 게시', align: 'right' },
                        { col: 'status', label: '상태', align: 'center' },
                        { col: 'collected_at', label: '수집일', align: 'right' },
                      ].map(({ col, label, align }) => {
                        const active = sortCol === col
                        const sortable = !['platform', 'category', 'status'].includes(col)
                        return (
                          <th key={col} className={`px-3 py-2.5 text-${align}`}>
                            {sortable ? (
                              <button onClick={() => toggleSort(col)}
                                className={cn(
                                  'inline-flex items-center gap-0.5 font-semibold text-xs',
                                  align === 'right' && 'flex-row-reverse',
                                  active ? 'text-brand-accent' : 'text-gray-500 hover:text-gray-700'
                                )}>
                                {label}
                                {active
                                  ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
                                  : <span className="w-2.5 inline-block" />}
                              </button>
                            ) : (
                              <span className="font-semibold text-xs text-gray-500">{label}</span>
                            )}
                          </th>
                        )
                      })}
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {pool.map(inf => (
                      <tr key={inf.id} className="hover:bg-surface-subtle group">
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.has(inf.id)}
                            onChange={e => {
                              const s = new Set(selected)
                              e.target.checked ? s.add(inf.id) : s.delete(inf.id)
                              setSelected(s)
                            }}
                            className="accent-brand-accent" />
                        </td>
                        <td className="px-3 py-2.5">
                          {editHandle?.id === inf.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editHandle.value}
                                onChange={e => setEditHandle({ id: inf.id, value: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveHandle(inf.id, editHandle.value)
                                  if (e.key === 'Escape') setEditHandle(null)
                                }}
                                className="text-xs border border-brand-accent rounded px-2 py-1 w-36 focus:outline-none"
                              />
                              <button onClick={() => saveHandle(inf.id, editHandle.value)}
                                className="text-[10px] text-brand-accent font-medium">저장</button>
                              <button onClick={() => setEditHandle(null)}
                                className="text-[10px] text-gray-400">취소</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-gray-800 text-xs">{inf.handle}</span>
                              {inf.is_verified && <span className="text-blue-500 text-[10px]">✓</span>}
                              {inf.full_name && <span className="text-[10px] text-gray-400 ml-1">{inf.full_name}</span>}
                              {recollecting === inf.id && <RefreshCw size={10} className="animate-spin text-blue-400 ml-0.5" />}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5">
                            {PLATFORM_ICON[inf.platform]}
                            <span className="text-gray-500 capitalize">{inf.platform}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-700">{fmtNum(inf.followers)}</td>
                        <td className="px-3 py-2.5">
                          <span className="bg-surface-muted text-gray-600 px-1.5 py-0.5 rounded text-[11px]">{inf.category}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={inf.engagement_rate >= 5 ? 'text-emerald-600 font-semibold' : 'text-gray-700'}>
                            {inf.engagement_rate}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">
                          {inf.engagement_rate > 0 && inf.followers > 0
                            ? fmtNum(Math.round(inf.engagement_rate / 100 * inf.followers))
                            : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">
                          {inf.posts_last_30d > 0 ? inf.posts_last_30d : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_BADGE[inf.status] ?? 'bg-gray-100 text-gray-500')}>
                            {inf.status ?? '미검토'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-400">{inf.collected_at?.slice(0, 10)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {!['후보','선정'].includes(inf.status) && (
                              <button onClick={() => patchInfluencer(inf.id, { status: '후보' })}
                                className="text-[10px] text-amber-600 hover:text-amber-700 font-medium px-1.5 py-0.5 rounded hover:bg-amber-50">
                                후보
                              </button>
                            )}
                            {inf.status !== '제외' && (
                              <button onClick={() => patchInfluencer(inf.id, { status: '제외' })}
                                className="text-[10px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50">
                                제외
                              </button>
                            )}
                            <button
                              onClick={() => setEditHandle({ id: inf.id, value: inf.handle })}
                              className="p-1 text-gray-300 hover:text-gray-600"
                              title="계정명 수정"
                            >
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteInfluencer(inf.id)}
                              className="p-1 text-gray-300 hover:text-red-400">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 1: 후보 리스트 ── */}
      {tab === 1 && (
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              후보 리스트 <span className="text-gray-400 font-normal ml-1">{candidates.length}명 누적</span>
            </p>
          </div>
          {candidates.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">인플루언서 풀에서 후보를 선택하세요</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">핸들</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">플랫폼</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">팔로워</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">참여율</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">메모</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">상태</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {candidates.map(inf => (
                    <tr key={inf.id} className="hover:bg-surface-subtle group">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{inf.handle}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {PLATFORM_ICON[inf.platform]}
                          <span className="text-gray-500 capitalize">{inf.platform}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(inf.followers)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={inf.engagement_rate >= 5 ? 'text-emerald-600 font-semibold' : 'text-gray-700'}>
                          {inf.engagement_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        {editNotes?.id === inf.id ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus value={editNotes.notes}
                              onChange={e => setEditNotes({ id: inf.id, notes: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveNotes(inf.id, editNotes.notes)
                                if (e.key === 'Escape') setEditNotes(null)
                              }}
                              className="flex-1 text-xs border border-brand-accent rounded px-2 py-0.5 focus:outline-none" />
                            <button onClick={() => saveNotes(inf.id, editNotes.notes)}
                              className="text-brand-accent text-[10px] font-medium">저장</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditNotes({ id: inf.id, notes: inf.notes ?? '' })}
                            className="text-left text-gray-600 hover:text-gray-900 truncate w-full">
                            {inf.notes || <span className="text-gray-300 italic">메모 추가...</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_BADGE[inf.status] ?? '')}>
                          {inf.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {inf.status !== '선정' && (
                            <button onClick={() => {
                              patchInfluencer(inf.id, { status: '선정' })
                              setSeedingTarget(inf)
                              setShowAddSeeding(true)
                            }}
                              className="flex items-center gap-1 text-[10px] text-blue-600 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50">
                              <Plus size={10} /> 시딩 등록
                            </button>
                          )}
                          {inf.status !== '제외' && (
                            <button onClick={() => patchInfluencer(inf.id, { status: '제외' })}
                              className="text-[10px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50">
                              제외
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: 시딩 기록 ── */}
      {tab === 2 && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddSeeding(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-brand-accent text-white px-3 py-2 rounded-lg hover:bg-brand-accent-hover transition-colors">
              <Plus size={13} /> 시딩 등록
            </button>
          </div>
          <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-border">
              <p className="text-xs font-semibold text-gray-700">
                시딩 기록 <span className="text-gray-400 font-normal ml-1">{seedings.length}건 누적</span>
              </p>
            </div>
            {loading ? (
              <div className="text-center py-8 text-xs text-gray-400">불러오는 중...</div>
            ) : seedings.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">등록된 시딩이 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">날짜</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">인플루언서</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">캠페인</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">상품</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">유형</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500">상태</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {seedings.map(r => {
                      const sc = SEEDING_CFG[r.status] ?? SEEDING_CFG['연락중']
                      const canNext = !!SEEDING_NEXT[r.status]
                      return (
                        <tr key={r.id} className="hover:bg-surface-subtle group">
                          <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{r.seedingDate}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            <div className="flex items-center gap-1.5">
                              {PLATFORM_ICON[r.platform]}
                              {r.influencerHandle}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-[120px]">
                            <span className="block truncate">{r.campaignTitle}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-gray-700 truncate max-w-[100px]">{r.productName}</p>
                            <p className="text-gray-400 font-mono">{r.productCode}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium',
                              r.seedingType === '제품발송' ? 'bg-violet-50 text-violet-700' : 'bg-pink-50 text-pink-700')}>
                              {r.seedingType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => canNext && advanceSeeding(r.id, r.status)} disabled={!canNext}
                              title={canNext ? `→ ${SEEDING_NEXT[r.status]}` : '최종'}
                              className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-colors',
                                sc.cls, canNext && 'hover:opacity-70 cursor-pointer')}>
                              {sc.icon}{sc.label}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setResultTarget({ id: r.id, handle: r.influencerHandle })}
                                title="결과 입력" className="p-1 text-gray-400 hover:text-brand-accent">
                                <ClipboardList size={13} />
                              </button>
                              <button onClick={() => deleteSeeding(r.id)}
                                className="p-1 text-gray-400 hover:text-red-500">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: 결과 기록 ── */}
      {tab === 3 && (
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              결과 기록 <span className="text-gray-400 font-normal ml-1">{results.length}건 누적</span>
            </p>
            <span className="text-xs text-emerald-600 font-medium">
              게시완료 {results.filter(r => r.isPosted).length}건
            </span>
          </div>
          {results.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              시딩 기록 탭에서 📋 버튼으로 결과를 입력하세요
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">인플루언서</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">플랫폼</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">조회수</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">좋아요</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">댓글</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">추정도달</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">게시일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {results.map(r => (
                    <tr key={r.seedingRecordId} className="hover:bg-surface-subtle">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        <div className="flex items-center gap-1.5">
                          {PLATFORM_ICON[r.platform]}
                          {r.influencerHandle}
                          {r.postUrl && (
                            <a href={r.postUrl} target="_blank" rel="noopener noreferrer"
                              className="text-gray-400 hover:text-brand-accent">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 capitalize">{r.platform}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">{r.isPosted ? fmtNum(r.views) : '-'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.isPosted ? fmtNum(r.likes) : '-'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.isPosted ? fmtNum(r.comments) : '-'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{r.isPosted ? fmtNum(r.estimatedReach) : '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.isPosted
                          ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle size={12} /> {r.postedAt?.slice(5)}</span>
                          : <span className="text-gray-400">미게시</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddInfluencer && (
        <AddInfluencerModal onClose={() => setShowAddInfluencer(false)} onSaved={fetchAll} projectId={projectId} />
      )}
      {showAddSeeding && (
        <AddSeedingModal
          onClose={() => { setShowAddSeeding(false); setSeedingTarget(null) }}
          onSaved={() => { fetchAll(); onStatsChange?.() }}
          defaultInfluencer={seedingTarget ? { id: seedingTarget.id, handle: seedingTarget.handle } : undefined}
          projectId={projectId}
        />
      )}
      {resultTarget && (
        <SeedingResultModal
          seedingRecordId={resultTarget.id}
          influencerHandle={resultTarget.handle}
          onClose={() => setResultTarget(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}
