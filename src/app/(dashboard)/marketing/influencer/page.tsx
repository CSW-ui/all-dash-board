'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, ChevronRight, Send, CheckCircle, Eye, Heart, Users, MessageCircle, TrendingUp, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/formatters'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Project {
  id: string; title: string; description: string | null; status: string
  start_date: string | null; end_date: string | null; created_at: string
  seeding_count: number; posted_count: number; brand: string | null
}
interface Brand { code: string; name: string }
interface AggStats {
  totalPosted: number; totalViews: number; totalLikes: number
  totalComments: number; totalReach: number
}

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  '진행중': { label: '진행중', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  '완료':   { label: '완료',   cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400' },
  '예정':   { label: '예정',   cls: 'bg-blue-100 text-blue-600',       dot: 'bg-blue-400' },
}

function KpiCard({ icon, label, value, color, bg }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-border p-4">
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', bg, color)}>{icon}</div>
      <p className={cn('text-xl font-bold', color)}>{typeof value === 'number' ? fmtNum(value) : value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function InfluencerPage() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<Project[]>([])
  const [brands,    setBrands]    = useState<Brand[]>([])
  const [aggStats,  setAggStats]  = useState<AggStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating,  setCreating]  = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [q,            setQ]            = useState('')

  // AI 검색
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{
    summary: string
    searchParams: { hashtags: string[]; platform: string; category: string }
    scanned: number
    collected: number
    influencers: { handle: string; platform: string; followers: number; engagement_rate: number; full_name: string; biography: string; profile_pic_url: string; profile_url: string; posts_last_30d: number }[]
  } | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [filterBrand,  setFilterBrand]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [form, setForm] = useState({
    title: '', description: '', status: '진행중', start_date: '', end_date: '', brand: '',
  })

  async function load() {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      fetch('/api/seeding-projects'),
      fetch('/api/seeding-projects/stats'),
    ])
    const pData = await pRes.json()
    const sData = await sRes.json()
    if (Array.isArray(pData)) setProjects(pData)
    if (sData && !sData.error) setAggStats(sData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(d => { if (Array.isArray(d)) setBrands(d) }).catch(() => {})
  }, [])

  const filtered = useMemo(() => projects.filter(p => {
    if (filterBrand  && p.brand  !== filterBrand)  return false
    if (filterStatus && p.status !== filterStatus) return false
    if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false
    if (filterFrom && p.end_date   && p.end_date   < filterFrom) return false
    if (filterTo   && p.start_date && p.start_date > filterTo)   return false
    return true
  }), [projects, filterBrand, filterStatus, q, filterFrom, filterTo])

  const totalSeedings = projects.reduce((s, p) => s + p.seeding_count, 0)
  const totalPosted   = aggStats?.totalPosted ?? projects.reduce((s, p) => s + p.posted_count, 0)
  const postRate      = totalSeedings > 0 ? Math.round(totalPosted / totalSeedings * 100) : 0

  const chartData = [...projects]
    .sort((a, b) => b.seeding_count - a.seeding_count)
    .slice(0, 8)
    .map(p => ({
      name: p.title.length > 10 ? p.title.slice(0, 10) + '...' : p.title,
      시딩: p.seeding_count,
      게시: p.posted_count,
    }))

  async function handleAiSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!aiQuery.trim() || aiLoading) return
    setAiLoading(true); setAiError(null); setAiResult(null)
    try {
      const res = await fetch('/api/influencers/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiResult(data)
    } catch (err) {
      setAiError(String(err))
    } finally {
      setAiLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/seeding-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          start_date:  form.start_date  || null,
          end_date:    form.end_date    || null,
          brand:       form.brand       || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowCreate(false)
      setForm({ title: '', description: '', status: '진행중', start_date: '', end_date: '', brand: '' })
      router.push(`/marketing/influencer/${data.id}`)
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">인플루언서 시딩</h1>
          <p className="text-sm text-gray-500 mt-0.5">캠페인별 시딩 프로젝트 관리</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium bg-brand-accent text-white px-3 py-2 rounded-lg hover:bg-brand-accent-hover transition-colors">
          <Plus size={13} /> 새 프로젝트
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-brand-accent/30 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-700">새 프로젝트 만들기</p>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">프로젝트명 *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 26SS 런칭 인플루언서 시딩"
                  className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">브랜드</label>
                <select value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
                  className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent">
                  <option value="">선택</option>
                  {brands.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">상태</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent">
                  {['진행중', '예정', '완료'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">시작일</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">종료일</label>
                <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full text-xs border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-accent" />
              </div>
            </div>
            {createError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-surface-border hover:bg-surface-subtle">취소</button>
              <button type="submit" disabled={creating}
                className="text-xs font-medium bg-brand-accent text-white px-4 py-1.5 rounded-lg hover:bg-brand-accent-hover disabled:opacity-50">
                {creating ? '생성 중...' : '프로젝트 생성'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2-Panel */}
      <div className="flex gap-5 items-start">

        {/* LEFT: Project List */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-3 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="프로젝트 검색"
                className="w-full text-xs border border-surface-border rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-brand-accent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent bg-white">
                <option value="">전체 브랜드</option>
                {brands.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent bg-white">
                <option value="">전체 상태</option>
                {['진행중', '예정', '완료'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-400">기한</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent" />
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {projects.length === 0 ? '프로젝트가 없습니다' : '검색 결과 없음'}
              </div>
            ) : (
              <div className="divide-y divide-surface-border max-h-[calc(100vh-22rem)] overflow-y-auto">
                {filtered.map(p => {
                  const sc = STATUS_CFG[p.status] ?? STATUS_CFG['진행중']
                  const rate = p.seeding_count > 0 ? Math.round(p.posted_count / p.seeding_count * 100) : 0
                  return (
                    <button key={p.id} onClick={() => router.push(`/marketing/influencer/${p.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-subtle transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sc.dot)} />
                            <span className="text-xs font-semibold text-gray-800 truncate">{p.title}</span>
                            {p.brand && (
                              <span className="text-[10px] font-bold text-brand-accent bg-brand-accent-light px-1.5 py-0.5 rounded shrink-0">
                                {p.brand}
                              </span>
                            )}
                          </div>
                          {(p.start_date || p.end_date) && (
                            <p className="text-[10px] text-gray-400 mb-1.5 pl-3">
                              {p.start_date ?? ''}{p.end_date ? ` ~ ${p.end_date}` : ''}
                            </p>
                          )}
                          <div className="pl-3">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-gray-400">시딩 {p.seeding_count} · 게시 {p.posted_count}</span>
                              <span className="text-[10px] font-medium text-brand-accent">{rate}%</span>
                            </div>
                            <div className="h-1 bg-surface-muted rounded-full overflow-hidden">
                              <div className="h-full bg-brand-accent rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-brand-accent transition-colors mt-1 shrink-0" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Dashboard */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* AI 인플루언서 검색 */}
          <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-xl border border-violet-200/50 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-violet-500" />
              <span className="text-xs font-semibold text-gray-700">AI 인플루언서 발굴</span>
              <span className="text-[10px] text-gray-400">자연어로 원하는 인플루언서를 검색하세요</span>
            </div>
            <form onSubmit={handleAiSearch} className="flex gap-2">
              <input
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                placeholder="예: 커버낫에 어울리는 20대 남성 스트릿 패션 인플루언서 팔로워 3~10만"
                className="flex-1 text-xs border border-violet-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-400 bg-white/80 placeholder:text-gray-400"
                disabled={aiLoading}
              />
              <button type="submit" disabled={aiLoading || !aiQuery.trim()}
                className="flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white px-4 py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {aiLoading ? '발굴 중... (약 2분)' : '검색'}
              </button>
            </form>

            {aiError && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{aiError}</div>
            )}

            {aiResult && (
              <div className="mt-3 space-y-3">
                {/* AI 요약 */}
                <div className="bg-white/80 rounded-lg px-3 py-2.5 border border-violet-100">
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{aiResult.summary}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span>게시물 {aiResult.scanned}개 스캔</span>
                    <span>인플루언서 {aiResult.collected}명 발굴</span>
                    <span>해시태그: {aiResult.searchParams.hashtags.map(h => `#${h}`).join(' ')}</span>
                  </div>
                </div>

                {/* 결과 테이블 */}
                {aiResult.influencers.length > 0 && (
                  <div className="bg-white rounded-lg border border-violet-100 overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-violet-50/50 border-b border-violet-100 text-gray-500 font-semibold">
                          <th className="text-left px-3 py-2">인플루언서</th>
                          <th className="text-right px-2 py-2">팔로워</th>
                          <th className="text-right px-2 py-2">참여율</th>
                          <th className="text-right px-2 py-2">최근 게시</th>
                          <th className="text-center px-2 py-2">프로필</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.influencers.map((inf, i) => (
                          <tr key={inf.handle} className="border-b border-gray-50 hover:bg-violet-50/30">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {inf.profile_pic_url && (
                                  <img src={inf.profile_pic_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-800 truncate">{inf.handle}</p>
                                  {inf.full_name && <p className="text-[10px] text-gray-400 truncate">{inf.full_name}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 font-mono text-gray-700">{(inf.followers / 10000).toFixed(1)}만</td>
                            <td className={cn('text-right px-2 py-2 font-semibold', inf.engagement_rate >= 5 ? 'text-emerald-600' : inf.engagement_rate >= 2 ? 'text-amber-600' : 'text-gray-500')}>
                              {inf.engagement_rate}%
                            </td>
                            <td className="text-right px-2 py-2 text-gray-600">{inf.posts_last_30d}건</td>
                            <td className="text-center px-2 py-2">
                              <a href={inf.profile_url} target="_blank" rel="noreferrer"
                                className="text-violet-500 hover:text-violet-700">
                                <ExternalLink size={12} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<Send size={14} />}        label="총 시딩"   value={totalSeedings}            color="text-blue-600"    bg="bg-blue-50" />
            <KpiCard icon={<CheckCircle size={14} />} label="게시 완료" value={totalPosted}               color="text-emerald-600" bg="bg-emerald-50" />
            <KpiCard icon={<TrendingUp size={14} />}  label="게시율"    value={`${postRate}%`}            color="text-violet-600"  bg="bg-violet-50" />
            <KpiCard icon={<Eye size={14} />}         label="총 조회수" value={aggStats?.totalViews ?? 0} color="text-amber-600"   bg="bg-amber-50" />
          </div>

          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-700 mb-4">
              프로젝트별 시딩 현황
              <span className="text-gray-400 font-normal ml-1">시딩 수 상위 8개</span>
            </p>
            {chartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: '#f8fafc' }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="시딩" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="게시" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-700 mb-4">
              참여도 합계
              <span className="text-gray-400 font-normal ml-1">게시 완료된 콘텐츠 기준</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Eye size={18} />,           label: '조회수',    value: aggStats?.totalViews    ?? 0, color: 'text-amber-500',  bg: 'bg-amber-50' },
                { icon: <Heart size={18} />,         label: '좋아요',    value: aggStats?.totalLikes    ?? 0, color: 'text-pink-500',   bg: 'bg-pink-50' },
                { icon: <MessageCircle size={18} />, label: '댓글',      value: aggStats?.totalComments ?? 0, color: 'text-blue-500',   bg: 'bg-blue-50' },
                { icon: <Users size={18} />,         label: '추정 도달', value: aggStats?.totalReach    ?? 0, color: 'text-violet-500', bg: 'bg-violet-50' },
              ].map(item => (
                <div key={item.label} className={cn('text-center p-4 rounded-xl', item.bg)}>
                  <div className={cn('flex justify-center mb-1.5', item.color)}>{item.icon}</div>
                  <p className={cn('text-xl font-bold', item.color)}>{fmtNum(item.value)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
