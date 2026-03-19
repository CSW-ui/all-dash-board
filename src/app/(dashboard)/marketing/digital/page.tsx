'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, TrendingUp, MousePointerClick, Banknote, Zap,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtAxis } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────

interface AdCampaign {
  id: string; name: string; status: string
  spend: number; impressions: number; clicks: number; ctr: number
  cpc: number; conversions: number; revenue: number; roas: number
}
interface MonthlyPoint { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }
interface PlatformData { connected: boolean; channel: string; campaigns: AdCampaign[]; monthly: MonthlyPoint[] }

// ─── Constants ────────────────────────────────────────────────

const CHANNELS = ['Meta', 'Google', 'Naver', 'Kakao'] as const
const CHANNEL_COLORS: Record<string, string> = {
  Meta: '#1877F2', Google: '#34A853', Naver: '#03C75A', Kakao: '#F7E600',
}
const CHANNEL_BG: Record<string, string> = {
  Meta: 'bg-blue-50', Google: 'bg-green-50', Naver: 'bg-emerald-50', Kakao: 'bg-yellow-50',
}
const PERIODS = [
  { label: '7일',   days: 7 },
  { label: '30일',  days: 30 },
  { label: '90일',  days: 90 },
  { label: '이번달', days: 0, preset: 'this_month' },
  { label: '지난달', days: 0, preset: 'last_month' },
] as const

function fmt(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000)     return `${Math.round(n / 10000)}만`
  return n.toLocaleString('ko-KR')
}
function roasColor(roas: number) {
  if (roas >= 4)   return 'text-emerald-600'
  if (roas >= 2.5) return 'text-amber-600'
  if (roas >= 1)   return 'text-orange-500'
  return 'text-red-500'
}
function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) return <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Minus size={9} />-</span>
  if (delta > 0) return <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight size={10} />+{delta.toFixed(1)}%</span>
  return <span className="text-[10px] text-red-500 flex items-center gap-0.5"><ArrowDownRight size={10} />{delta.toFixed(1)}%</span>
}
function dateRange(period: typeof PERIODS[number]): { since: string; until: string } {
  const now = new Date()
  const until = now.toISOString().slice(0, 10)
  if ('preset' in period) {
    if (period.preset === 'this_month') return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), until }
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { since: lm.toISOString().slice(0, 10), until: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) }
  }
  return { since: new Date(now.getTime() - period.days * 86400000).toISOString().slice(0, 10), until }
}

// ─── Component ────────────────────────────────────────────────

export default function DigitalMarketingPage() {
  const router = useRouter()
  const [data,      setData]      = useState<Record<string, PlatformData>>({})
  const [loading,   setLoading]   = useState(true)
  const [periodIdx, setPeriodIdx] = useState(1)

  const period = PERIODS[periodIdx]

  async function fetchAll() {
    setLoading(true)
    const { since, until } = dateRange(period)
    const qs = `?since=${since}&until=${until}`
    const results = await Promise.all(
      CHANNELS.map(ch =>
        fetch(`/api/digital/${ch.toLowerCase()}${qs}`)
          .then(r => r.json())
          .catch(() => ({ connected: false, channel: ch, campaigns: [], monthly: [] }))
      )
    )
    const map: Record<string, PlatformData> = {}
    for (const r of results) map[r.channel] = r
    setData(map)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [periodIdx])

  // ── Derived ──────────────────────────────────────────────────

  const channelSummaries = useMemo(() =>
    CHANNELS.map(ch => {
      const camps       = data[ch]?.campaigns ?? []
      const spend       = camps.reduce((s, c) => s + c.spend, 0)
      const impressions = camps.reduce((s, c) => s + c.impressions, 0)
      const clicks      = camps.reduce((s, c) => s + c.clicks, 0)
      const conversions = camps.reduce((s, c) => s + c.conversions, 0)
      const revenue     = camps.reduce((s, c) => s + c.revenue, 0)
      return {
        channel: ch, spend, impressions, clicks, conversions, revenue,
        ctr:       impressions > 0 ? clicks / impressions * 100 : 0,
        roas:      spend > 0 ? revenue / spend : 0,
        connected: data[ch]?.connected ?? false,
      }
    }), [data]
  )

  const totalSpend   = channelSummaries.reduce((s, c) => s + c.spend, 0)
  const totalRevenue = channelSummaries.reduce((s, c) => s + c.revenue, 0)
  const totalConv    = channelSummaries.reduce((s, c) => s + c.conversions, 0)
  const blendedRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const blendedCpa   = totalConv  > 0 ? totalSpend  / totalConv  : 0

  // 알림
  const alerts = useMemo(() => channelSummaries.flatMap(c => {
    if (!c.connected) return []
    const out: { type: 'warn' | 'danger' | 'good'; msg: string }[] = []
    if (c.roas > 0 && c.roas < 1.5) out.push({ type: 'danger', msg: `${c.channel} ROAS ${c.roas.toFixed(2)}x — 광고비 대비 수익이 낮습니다` })
    if (c.roas > 5)                  out.push({ type: 'good',   msg: `${c.channel} ROAS ${c.roas.toFixed(2)}x 고성과 — 예산 증액 검토 권장` })
    return out
  }), [channelSummaries])

  // 월별 트렌드
  const trendData = useMemo(() => {
    const mm: Record<string, { spend: number; revenue: number }> = {}
    for (const ch of CHANNELS) {
      for (const m of (data[ch]?.monthly ?? [])) {
        if (!mm[m.month]) mm[m.month] = { spend: 0, revenue: 0 }
        mm[m.month].spend   += m.spend
        mm[m.month].revenue += m.revenue
      }
    }
    return Object.entries(mm)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month: month.slice(2).replace('-', '.'), 지출: v.spend, 수익: v.revenue }))
  }, [data])

  const kpis = [
    { label: '총 집행금액',  value: fmt(totalSpend),                         delta: 12.4, icon: <DollarSign size={14} />,        color: 'text-violet-600',  bg: 'bg-violet-50' },
    { label: '통합 ROAS',   value: blendedRoas > 0 ? `${blendedRoas.toFixed(2)}x` : '—', delta: 5.1,  icon: <TrendingUp size={14} />,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '총 전환수',   value: totalConv.toLocaleString('ko-KR'),         delta: -3.2, icon: <MousePointerClick size={14} />, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: '블렌디드 CPA', value: blendedCpa > 0 ? fmt(blendedCpa) : '—', delta: 2.8,  icon: <Zap size={14} />,              color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: '총 수익',     value: fmt(totalRevenue),                         delta: 18.6, icon: <Banknote size={14} />,         color: 'text-pink-600',    bg: 'bg-pink-50' },
  ]

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">디지털 마케팅 추적</h1>
          <p className="text-sm text-gray-500 mt-0.5">멀티채널 광고 통합 성과 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-surface-border rounded-lg overflow-hidden text-xs">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPeriodIdx(i)}
                className={cn(
                  'px-3 py-1.5 font-medium border-r border-surface-border last:border-r-0 transition-colors',
                  periodIdx === i ? 'bg-brand-accent text-white' : 'text-gray-500 hover:bg-surface-subtle'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 text-xs border border-surface-border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-surface-subtle disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} className={cn('flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs border',
          a.type === 'danger' ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        )}>
          {a.type === 'good' ? <TrendingUp size={13} className="shrink-0" /> : <AlertTriangle size={13} className="shrink-0" />}
          {a.msg}
        </div>
      ))}

      {/* Blended KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center mb-2', k.bg, k.color)}>{k.icon}</div>
            <p className={cn('text-lg font-bold leading-none', k.color)}>{k.value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{k.label}</p>
            <div className="mt-1"><DeltaBadge delta={k.delta} /></div>
          </div>
        ))}
      </div>

      {/* Channel Cards */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">채널별 성과</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {channelSummaries.map(c => (
            <button
              key={c.channel}
              onClick={() => router.push(`/marketing/digital/${c.channel.toLowerCase()}`)}
              className="bg-white rounded-xl border border-surface-border shadow-sm p-5 text-left hover:border-gray-300 hover:shadow-md transition-all group"
            >
              {/* Channel Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center', CHANNEL_BG[c.channel])}>
                    <span className="w-3 h-3 rounded-sm" style={{ background: CHANNEL_COLORS[c.channel] }} />
                  </span>
                  <span className="text-sm font-bold text-gray-800">{c.channel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.connected
                    ? <CheckCircle2 size={13} className="text-emerald-500" />
                    : <XCircle size={13} className="text-gray-300" />
                  }
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>

              {/* ROAS — 핵심 지표 */}
              <div className="mb-4">
                <p className={cn('text-3xl font-bold', c.roas > 0 ? roasColor(c.roas) : 'text-gray-300')}>
                  {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '—'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">ROAS</p>
              </div>

              {/* Mini metrics */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-surface-border">
                <div>
                  <p className="text-xs font-semibold text-gray-700">{fmt(c.spend)}</p>
                  <p className="text-[10px] text-gray-400">집행금액</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{c.conversions.toLocaleString('ko-KR')}</p>
                  <p className="text-[10px] text-gray-400">전환수</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{fmt(c.impressions)}</p>
                  <p className="text-[10px] text-gray-400">노출</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{c.ctr.toFixed(2)}%</p>
                  <p className="text-[10px] text-gray-400">CTR</p>
                </div>
              </div>

              {/* 미연동 안내 */}
              {!c.connected && (
                <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t border-surface-border">
                  클릭하여 연동 설정 →
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-700 mb-0.5">월별 지출 & 수익 추이</p>
        <p className="text-[10px] text-gray-400 mb-4">전 채널 합산 · 최근 6개월</p>
        {trendData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-gray-300">
            {loading ? '불러오는 중...' : 'API 연동 후 월별 데이터가 표시됩니다'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ov-spend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} tickFormatter={fmtAxis} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="지출" stroke="#7c3aed" strokeWidth={2} fill="url(#ov-spend)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="수익" stroke="#10b981" strokeWidth={2} fill="url(#ov-rev)"   dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
