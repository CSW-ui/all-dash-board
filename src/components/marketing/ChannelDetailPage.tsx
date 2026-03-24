'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle,
  TrendingUp, DollarSign, MousePointerClick, Banknote, Zap, Eye,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtAxis } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────

interface AdCampaign {
  id: string; name: string; status: 'active' | 'paused' | 'completed'
  spend: number; impressions: number; clicks: number; ctr: number
  cpc: number; conversions: number; revenue: number; roas: number
  accountLabel?: string; accountId?: string
}
interface MonthlyPoint { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }
interface PlatformData {
  connected: boolean; channel: string; error?: string
  campaigns: AdCampaign[]; monthly: MonthlyPoint[]
  accountCount?: number; partialErrors?: string[]
}

// ─── Constants ────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  meta: '#1877F2', google: '#34A853', naver: '#03C75A', kakao: '#F7E600',
}
const CHANNEL_LABELS: Record<string, string> = {
  meta: 'Meta', google: 'Google', naver: 'Naver', kakao: 'Kakao',
}
const CHANNEL_BG: Record<string, string> = {
  meta: 'bg-blue-50', google: 'bg-green-50', naver: 'bg-emerald-50', kakao: 'bg-yellow-50',
}
const BRAND_COLORS: Record<string, string> = {
  '커버낫': '#6366f1', '와키윌리': '#f59e0b', 'Lee': '#ef4444',
  '커버낫MKT': '#8b5cf6', '기타': '#94a3b8',
}
const STATUS_CFG = {
  active:    { label: '진행중', cls: 'bg-emerald-50 text-emerald-700' },
  paused:    { label: '일시정지', cls: 'bg-gray-100 text-gray-600' },
  completed: { label: '완료',   cls: 'bg-blue-50 text-blue-700' },
}
const PERIODS = [
  { label: '7일',   days: 7 },
  { label: '30일',  days: 30 },
  { label: '90일',  days: 90 },
  { label: '이번달', days: 0, preset: 'this_month' },
  { label: '지난달', days: 0, preset: 'last_month' },
] as const

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000)     return `${Math.round(n / 10000)}만`
  return n.toLocaleString('ko-KR')
}
function roasColor(roas: number) {
  if (roas >= 4)   return 'text-emerald-600 bg-emerald-50'
  if (roas >= 2.5) return 'text-amber-600 bg-amber-50'
  if (roas >= 1)   return 'text-orange-600 bg-orange-50'
  return 'text-red-600 bg-red-50'
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

// 캠페인 배열에서 KPI 계산
function calcKpi(camps: AdCampaign[]) {
  const spend       = camps.reduce((s, c) => s + c.spend, 0)
  const revenue     = camps.reduce((s, c) => s + c.revenue, 0)
  const conv        = camps.reduce((s, c) => s + c.conversions, 0)
  const impressions = camps.reduce((s, c) => s + c.impressions, 0)
  const clicks      = camps.reduce((s, c) => s + c.clicks, 0)
  const roas        = spend > 0 ? revenue / spend : 0
  const cpa         = conv  > 0 ? spend  / conv  : 0
  const ctr         = impressions > 0 ? clicks / impressions * 100 : 0
  const cvr         = clicks > 0 ? conv / clicks * 100 : 0
  return { spend, revenue, conv, impressions, clicks, roas, cpa, ctr, cvr }
}

// ─── Setup Guides ─────────────────────────────────────────────

const SETUP_GUIDES: Record<string, { steps: string[]; envVars: string[] }> = {
  meta: {
    steps: ['Meta Business Manager → 설정', '시스템 사용자 생성 → 광고 관리자 권한 부여', '액세스 토큰 생성 (만료 없음 설정)', '광고 계정 ID 확인 (act_XXXXXXX)'],
    envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_IDS'],
  },
  google: {
    steps: ['Google Cloud Console → 프로젝트 생성', 'Google Ads API 활성화', 'OAuth 2.0 자격증명 생성', 'Google Ads Manager에서 개발자 토큰 신청', 'OAuth 인증 흐름으로 refresh_token 발급'],
    envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'],
  },
  naver: {
    steps: ['searchad.naver.com 접속', 'API 관리 → API 이용 신청', 'API Key / Secret Key 발급', '고객 ID (숫자) 확인'],
    envVars: ['NAVER_ACCOUNTS (JSON)'],
  },
  kakao: {
    steps: ['business.kakao.com 접속', '내 광고계정 → API 관리', 'REST API 키 발급', '광고계정 ID 확인'],
    envVars: ['KAKAO_ACCOUNTS (JSON)'],
  },
}

// ─── Component ────────────────────────────────────────────────

interface Props { channel: string }

export function ChannelDetailPage({ channel }: Props) {
  const router    = useRouter()
  const [data,       setData]       = useState<PlatformData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [periodIdx,  setPeriodIdx]  = useState(1)
  const [brand,      setBrand]      = useState<string>('전체')
  const [viewMode,   setViewMode]   = useState<'single' | 'compare'>('single')

  const color  = CHANNEL_COLORS[channel] ?? '#7c3aed'
  const label  = CHANNEL_LABELS[channel] ?? channel
  const bg     = CHANNEL_BG[channel] ?? 'bg-purple-50'
  const guide  = SETUP_GUIDES[channel]
  const period = PERIODS[periodIdx]

  async function fetchData() {
    setLoading(true)
    const { since, until } = dateRange(period)
    const res = await fetch(`/api/digital/${channel}?since=${since}&until=${until}`).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    setData(json ?? { connected: false, channel, campaigns: [], monthly: [] })
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [periodIdx, channel])

  // 브랜드 목록 추출
  const brands = useMemo(() => {
    const labels = new Set<string>()
    for (const c of data?.campaigns ?? []) {
      if (c.accountLabel) labels.add(c.accountLabel)
    }
    return Array.from(labels).sort()
  }, [data])

  // 브랜드별 필터링
  const campaigns = useMemo(() => {
    const all = data?.campaigns ?? []
    if (brand === '전체') return all
    return all.filter(c => c.accountLabel === brand)
  }, [data, brand])

  const monthly = data?.monthly ?? []

  // KPI
  const kpi = calcKpi(campaigns)
  const kpis = [
    { label: '집행금액',  value: fmt(kpi.spend),                               icon: <DollarSign size={14} />,        color: 'text-violet-600',  bg: 'bg-violet-50' },
    { label: 'ROAS',     value: kpi.roas > 0 ? `${kpi.roas.toFixed(2)}x` : '—', icon: <TrendingUp size={14} />,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '총 전환',   value: kpi.conv.toLocaleString('ko-KR'),               icon: <MousePointerClick size={14} />, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'CPA',      value: kpi.cpa > 0 ? fmt(kpi.cpa) : '—',              icon: <Zap size={14} />,              color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: '수익',      value: fmt(kpi.revenue),                               icon: <Banknote size={14} />,         color: 'text-pink-600',    bg: 'bg-pink-50' },
    { label: '노출',      value: fmt(kpi.impressions),                           icon: <Eye size={14} />,              color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ]

  // 퍼널
  const funnel = [
    { step: '노출',   value: kpi.impressions, rate: '100%' },
    { step: '클릭',   value: kpi.clicks,       rate: `CTR ${kpi.ctr.toFixed(2)}%` },
    { step: '전환',   value: kpi.conv,         rate: `CVR ${kpi.cvr.toFixed(2)}%` },
  ]

  // 월별 차트
  const trendData = useMemo(() =>
    monthly.map(m => ({
      month:  m.month.slice(2).replace('-', '.'),
      지출:   m.spend,
      수익:   m.revenue,
      전환수: m.conversions,
    })), [monthly]
  )

  // ─── 브랜드 비교 데이터 ────────────────────────────────────
  const brandComparison = useMemo(() => {
    if (brands.length === 0) return []
    const allCamps = data?.campaigns ?? []
    return brands.map(b => {
      const bCamps = allCamps.filter(c => c.accountLabel === b)
      const k = calcKpi(bCamps)
      return { brand: b, campaigns: bCamps.length, ...k }
    })
  }, [data, brands])

  // 브랜드별 비교 바 차트
  const compareChartData = useMemo(() =>
    brandComparison.map(b => ({
      name: b.brand,
      광고비: b.spend,
      수익: b.revenue,
      ROAS: Number(b.roas.toFixed(2)),
    })), [brandComparison]
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/marketing/digital')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={14} /> 디지털 마케팅
          </button>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <h1 className="text-xl font-bold text-gray-900">{label} 광고</h1>
          </div>
          {data?.connected
            ? <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                <CheckCircle2 size={10} />연동됨{data?.accountCount ? ` (${data.accountCount}개 계정)` : ''}
              </span>
            : <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><XCircle size={10} />미연동</span>
          }
        </div>
        <div className="flex items-center gap-2">
          {/* 브랜드 필터 */}
          {brands.length > 1 && (
            <div className="flex items-center border border-surface-border rounded-lg overflow-hidden text-xs">
              {['전체', ...brands].map(b => (
                <button
                  key={b}
                  onClick={() => { setBrand(b); setViewMode('single') }}
                  className={cn(
                    'px-3 py-1.5 font-medium border-r border-surface-border last:border-r-0 transition-colors',
                    brand === b && viewMode === 'single'
                      ? 'text-white bg-gray-800'
                      : 'text-gray-500 hover:bg-surface-subtle'
                  )}
                >
                  {b}
                </button>
              ))}
              <button
                onClick={() => setViewMode(viewMode === 'compare' ? 'single' : 'compare')}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors flex items-center gap-1',
                  viewMode === 'compare'
                    ? 'text-white bg-gray-800'
                    : 'text-gray-500 hover:bg-surface-subtle'
                )}
                title="브랜드 비교"
              >
                <BarChart3 size={12} />비교
              </button>
            </div>
          )}

          {/* 기간 필터 */}
          <div className="flex items-center border border-surface-border rounded-lg overflow-hidden text-xs">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPeriodIdx(i)}
                className={cn(
                  'px-3 py-1.5 font-medium border-r border-surface-border last:border-r-0 transition-colors',
                  periodIdx === i ? 'text-white' : 'text-gray-500 hover:bg-surface-subtle'
                )}
                style={periodIdx === i ? { background: color } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-xs border border-surface-border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-surface-subtle disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 미연동 — 셋업 가이드 */}
      {!loading && !data?.connected && guide && (
        <div className="bg-white rounded-xl border border-surface-border shadow-sm p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{label} API 연동 설정</p>
              <p className="text-xs text-gray-500 mt-0.5">.env.local에 아래 키를 설정하면 실시간 데이터가 표시됩니다</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">설정 순서</p>
              <ol className="space-y-1.5">
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5" style={{ background: color, color: '#fff' }}>{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">필요한 환경변수</p>
              <div className="space-y-1.5">
                {guide.envVars.map(v => (
                  <div key={v} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="font-mono text-xs text-gray-700">{v}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">.env.local</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 브랜드 비교 모드 ─── */}
      {viewMode === 'compare' && brands.length > 1 && (
        <>
          {/* 비교 테이블 */}
          <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-border">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 size={13} className="text-gray-400" />
                브랜드별 성과 비교
                <span className="text-gray-400 font-normal">{label} 채널</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle">
                  <tr>
                    {['브랜드', '캠페인', '집행금액', '노출', '클릭', 'CTR', '전환', 'CPA', 'ROAS', '수익'].map(h => (
                      <th key={h} className={cn('px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap', h === '브랜드' ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {brandComparison.map(b => (
                    <tr key={b.brand} className="hover:bg-surface-subtle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_COLORS[b.brand] ?? '#94a3b8' }} />
                          <span className="font-semibold text-gray-800">{b.brand}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{b.campaigns}개</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(b.spend)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(b.impressions)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(b.clicks)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{b.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right text-gray-700">{b.conv.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{b.cpa > 0 ? fmt(b.cpa) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-bold', roasColor(b.roas))}>
                          {b.roas > 0 ? `${b.roas.toFixed(2)}x` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(b.revenue)}</td>
                    </tr>
                  ))}
                  {/* 합계 */}
                  {brandComparison.length > 1 && (() => {
                    const total = calcKpi(data?.campaigns ?? [])
                    return (
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-gray-700">합계</td>
                        <td className="px-4 py-3 text-right text-gray-500">{(data?.campaigns ?? []).length}개</td>
                        <td className="px-4 py-3 text-right text-gray-800">{fmt(total.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt(total.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt(total.clicks)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{total.ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right text-gray-700">{total.conv.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{total.cpa > 0 ? fmt(total.cpa) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-bold', roasColor(total.roas))}>
                            {total.roas > 0 ? `${total.roas.toFixed(2)}x` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">{fmt(total.revenue)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* 비교 바 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-700 mb-1">광고비 vs 수익</p>
              <p className="text-[10px] text-gray-400 mb-4">브랜드별 집행 규모와 수익 비교</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compareChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtAxis} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="광고비" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="수익" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-700 mb-1">ROAS 비교</p>
              <p className="text-[10px] text-gray-400 mb-4">브랜드별 광고수익률</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compareChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip formatter={(v: number) => `${v}x`} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="ROAS" radius={[4, 4, 0, 0]}>
                    {compareChartData.map((entry, i) => (
                      <Cell key={i} fill={BRAND_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ─── 단일 뷰 (전체 or 브랜드 선택) ─── */}
      {viewMode === 'single' && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center mb-2', k.bg, k.color)}>{k.icon}</div>
                <p className={cn('text-lg font-bold leading-none', k.color)}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Funnel + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Conversion Funnel */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-surface-border shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-700 mb-1">전환 퍼널</p>
              <p className="text-[10px] text-gray-400 mb-5">
                노출 → 클릭 → 전환 단계별 drop-off
                {brand !== '전체' && <span className="ml-1 text-gray-500 font-medium">({brand})</span>}
              </p>
              {kpi.impressions === 0 ? (
                <div className="flex items-center justify-center h-28 text-sm text-gray-300">데이터 없음</div>
              ) : (
                <div className="space-y-3">
                  {funnel.map((f, i) => {
                    const pct = kpi.impressions > 0 ? f.value / kpi.impressions * 100 : 0
                    const barW = Math.max(pct, 5)
                    return (
                      <div key={f.step}>
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: color }}>{i + 1}</span>
                            <span className="font-semibold text-gray-700">{f.step}</span>
                            {f.rate && <span className="text-gray-400 text-[10px]">{f.rate}</span>}
                          </div>
                          <span className="font-bold text-gray-800">{fmt(f.value)}</span>
                        </div>
                        <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barW}%`, background: color, opacity: 1 - i * 0.2 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-surface-border grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color }}>{kpi.ctr.toFixed(2)}%</p>
                  <p className="text-[10px] text-gray-400">CTR (클릭률)</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color }}>{kpi.cvr.toFixed(2)}%</p>
                  <p className="text-[10px] text-gray-400">CVR (전환율)</p>
                </div>
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-surface-border shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-700 mb-1">월별 성과 추이</p>
              <p className="text-[10px] text-gray-400 mb-4">지출 · 수익 · 전환수</p>
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-300">
                  {loading ? '불러오는 중...' : 'API 연동 후 데이터가 표시됩니다'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`gc-rev-${channel}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} tickFormatter={fmtAxis} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="지출" stroke="#7c3aed" strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="수익" stroke={color} strokeWidth={2} fill={`url(#gc-rev-${channel})`} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Campaign Table */}
          <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">
                캠페인 목록
                <span className="text-gray-400 font-normal ml-1.5">
                  {campaigns.length}개{brand !== '전체' && ` · ${brand}`}
                </span>
              </p>
              {loading && <span className="text-[11px] text-gray-400">불러오는 중...</span>}
            </div>
            {campaigns.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-300">
                {!data?.connected ? `${label} API를 연동하면 캠페인 데이터가 표시됩니다` : '캠페인 없음'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-subtle">
                    <tr>
                      {[
                        ...(brand === '전체' && brands.length > 1 ? ['브랜드'] : []),
                        '캠페인명', '상태', '집행금액', '노출', '클릭', 'CTR', 'CPC', '전환', 'CVR', 'ROAS',
                      ].map(h => (
                        <th key={h} className={cn('px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap', ['캠페인명', '상태', '브랜드'].includes(h) ? 'text-left' : 'text-right')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {[...campaigns].sort((a, b) => b.spend - a.spend).map(c => {
                      const sc  = STATUS_CFG[c.status] ?? STATUS_CFG.completed
                      const cvr = c.clicks > 0 ? c.conversions / c.clicks * 100 : 0
                      return (
                        <tr key={`${c.accountLabel}-${c.id}`} className="hover:bg-surface-subtle">
                          {brand === '전체' && brands.length > 1 && (
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND_COLORS[c.accountLabel ?? ''] ?? '#94a3b8' }} />
                                <span className="text-gray-600 text-[11px]">{c.accountLabel}</span>
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[220px] truncate">{c.name}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', sc.cls)}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmt(c.spend)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{fmt(c.impressions)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{fmt(c.clicks)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{c.ctr.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{c.cpc > 0 ? fmt(c.cpc) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{c.conversions.toLocaleString('ko-KR')}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{cvr.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-bold', roasColor(c.roas))}>
                              {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
