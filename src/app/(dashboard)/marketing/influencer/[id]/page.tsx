'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Send, CheckCircle, Eye, Pencil, X, Instagram, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/formatters'
import { SeedingTracker } from '@/components/marketing/SeedingTracker'

interface Project {
  id: string
  title: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

interface Stats {
  seedingCount: number
  postedCount: number
  totalViews: number
  totalReach: number
}

interface TopPerformer {
  handle: string
  platform: string
  views: number
  reach: number
  likes: number
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  '진행중': { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
  '완료':   { label: '완료',   cls: 'bg-gray-100 text-gray-500' },
  '예정':   { label: '예정',   cls: 'bg-blue-100 text-blue-700' },
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} className="text-pink-500" />,
  youtube:   <Youtube size={12} className="text-red-500" />,
  tiktok:    <span className="text-[10px] font-bold text-gray-700">TT</span>,
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '진행중', start_date: '', end_date: '' })

  async function load() {
    const res = await fetch(`/api/seeding-projects/${id}`)
    if (!res.ok) { router.push('/marketing/influencer'); return }
    const data = await res.json()
    setProject(data.project)
    setStats(data.stats)
    setTopPerformers(data.topPerformers ?? [])
    setEditForm({
      title: data.project.title,
      description: data.project.description ?? '',
      status: data.project.status,
      start_date: data.project.start_date ?? '',
      end_date: data.project.end_date ?? '',
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveEdit() {
    await fetch(`/api/seeding-projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      }),
    })
    setEditing(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">불러오는 중...</div>
  if (!project) return null

  const sc = STATUS_CFG[project.status] ?? STATUS_CFG['진행중']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/marketing/influencer')}
          className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-surface-subtle transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3 bg-white rounded-xl border border-surface-border p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">프로젝트명</label>
                  <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">상태</label>
                  <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent">
                    {['진행중', '예정', '완료'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">설명</label>
                  <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">시작일</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">종료일</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full text-sm border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="text-xs font-medium bg-brand-accent text-white px-3 py-1.5 rounded-lg hover:bg-brand-accent-hover">저장</button>
                <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-surface-border hover:bg-surface-subtle">취소</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', sc.cls)}>{sc.label}</span>
              {project.start_date && (
                <span className="text-xs text-gray-400">
                  {project.start_date} {project.end_date ? `~ ${project.end_date}` : ''}
                </span>
              )}
              <button onClick={() => setEditing(true)} className="p-1 text-gray-300 hover:text-gray-600">
                <Pencil size={13} />
              </button>
            </div>
          )}
          {project.description && !editing && (
            <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
          )}
        </div>
      </div>

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Send size={14} />, label: '시딩 건수', value: stats.seedingCount, color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: <CheckCircle size={14} />, label: '게시 완료', value: stats.postedCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: <Eye size={14} />, label: '총 조회수', value: stats.totalViews, color: 'text-violet-600', bg: 'bg-violet-50' },
            { icon: <Users size={14} />, label: '총 도달수', value: stats.totalReach, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', k.bg, k.color)}>
                {k.icon}
              </div>
              <p className={cn('text-xl font-bold', k.color)}>{fmtNum(k.value)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-border">
            <p className="text-xs font-semibold text-gray-700">TOP 인플루언서 <span className="text-gray-400 font-normal ml-1">게시 결과 기준</span></p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">#</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">인플루언서</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">조회수</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">좋아요</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">도달수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {topPerformers.map((p, i) => (
                <tr key={p.handle} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <div className="flex items-center gap-1.5">
                      {PLATFORM_ICON[p.platform]}
                      {p.handle}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmtNum(p.views)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtNum(p.likes)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtNum(p.reach)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Workflow */}
      <SeedingTracker projectId={id} onStatsChange={load} />
    </div>
  )
}
