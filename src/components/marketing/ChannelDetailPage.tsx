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
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtAxis } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────

interface AdCampaign {
  id: string; name: string; status: 'active' | 'paused' | 'completed'
  spend: number; impressions: number; clicks: number; ctr: number
  cpc: number; conversions: number; revenue: number; roas: number
}
interface MonthlyPoint { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }
interface PlatformData { connected: boolean; channel: string; error?: string; campaigns: AdCampaign[]; monthly: MonthlyPoint[] }

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

// ─── Setup Guides ─────────────────────────────────────────────

const SETUP_GUIDES: Record<string, { steps: string[]; envVars: string[] }> = {
  meta: {
    steps: ['Meta Business Manager → 설정', '시스템 사용자 생성 → 광고 관리자 권한 부여', '액세스 토큰 생성 (만료 없음 설정)', '광고 계정 ID 확인 (act_XXXXXXX)'],
    envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
  },
  google: {
    steps: ['Google Cloud Console → 프로젝트 생성', 'Google Ads API 활성화', 'OAuth 2.0 자격증명 생성', 'Google Ads Manager에서 개발자 토큰 신청', 'OAuth 인증 흐름으로 refresh_token 발급'],
    envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'],
  },
  naver: {
    steps: ['searchad.naver.com 접속', 'API 관리 → API 이용 신청', 'API Key / Secret Key 발급', '고객 ID (숫자) 확인'],
    envVars: ['NAVER_API_KEY', 'NAVER_SECRET_KEY', 'NAVER_CUSTOMER_ID'],
  },
  kakao: {
    steps: ['business.kakao.com 접속', '내 광고계정 → API 관리', 'REST API 키 발급', '광고계정 ID 확인'],
    envVars: ['KAKAO_ACCESS_TOKEN', 'KAKAO_AD_ACCOUNT_ID'],
  },
}

// ─── Component ────────────────────────────────────────────────

interface Props { channel: string }

export function ChannelDetailPage({ channel }: Props) {
  const router    = useRouter()
  const [data,       setData]       = useState<PlatformData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [periodIdx,  setPeriodIdx]  = useState(1)

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

  // Derived
  const campaigns = data?.campaigns ?? []
  const monthly   = data?.monthly   ?? []

  const totalSpend       = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalRevenue     = campaigns.reduce((s, c) => s + c.revenue, 0)
  const totalConv        = campaigns.reduce((s, c) => s + c.conversions, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks      = campaigns.reduce((s, c) => s + c.clicks, 0)
  const roas             = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const cpa              = totalConv  > 0 ? totalSpend  / totalConv  : 0
  const ctr              = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0
  const cvr              = totalClicks > 0 ? totalConv / totalClicks * 100 : 0

  const kpis = [
    { label: '집행금액',  value: fmt(totalSpend),                          delta: 12.4,  icon: <DollarSign size={14} />,        color: 'text-violet-600',  bg: 'bg-violet-50' },
    { label: 'ROAS',     value: roas > 0 ? `${roas.toFixed(2)}x` : '—',  delta: 5.1,   icon: <TrendingUp size={14} />,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '총 전환',   value: totalConv.toLocaleString('ko-KR'),        delta: -3.2,  icon: <MousePointerClick size={14} />, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'CPA',      value: cpa > 0 ? fmt(cpa) : '—',                delta: 2.8,   icon: <Zap size={14} />,              color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: '수익',      value: fmt(totalRevenue),                        delta: 18.6,  icon: <Banknote size={14} />,         color: 'text-pink-600',    bg: 'bg-pink-50' },
    { label: '노출',      value: fmt(totalImpressions),                    delta: 8.2,   icon: <Eye size={14} />,              color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ]

  // 퍼널 데이터
  const funnel = [
    { step: '노출',   value: totalImpressions, rate: '100%',   note: '' },
    { step: '클릭',   value: totalClicks,       rate: `CTR ${ctr.toFixed(2)}%`, note: '' },
    { step: '전환',   value: totalConv,         rate: `CVR ${cvr.toFixed(2)}%`, note: '' },
  ]

  const trendData = useMemo(() =>
    monthly.map(m => ({
      month:  m.month.slice(2).replace('-', '.'),
      지출:   m.spend,
      수익:   m.revenue,
      전환수: m.conversions,
    })), [monthly]
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
            ? <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium"><CheckCircle2 size={10} />연동됨</span>
            : <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><XCircle size={10} />미연동</span>
          }
        </div>
        <div className="flex items-center gap-2">
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center mb-2', k.bg, k.color)}>{k.icon}</div>
            <p className={cn('text-lg font-bold leading-none', k.color)}>{k.value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{k.label}</p>
            <div className="mt-1"><DeltaBadge delta={k.delta} /></div>
          </div>
        ))}
      </div>

      {/* Funnel + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Conversion Funnel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-surface-border shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-700 mb-1">전환 퍼널</p>
          <p className="text-[10px] text-gray-400 mb-5">노출 → 클릭 → 전환 단계별 drop-off</p>
          {totalImpressions === 0 ? (
            <div className="flex items-center justify-center h-28 text-sm text-gray-300">데이터 없음</div>
          ) : (
            <div className="space-y-3">
              {funnel.map((f, i) => {
                const pct = totalImpressions > 0
                  ? f.value / totalImpressions * 100
                  : 0
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

          {/* 효율 지표 */}
          <div className="mt-5 pt-4 border-t border-surface-border grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color }}>{ctr.toFixed(2)}%</p>
              <p className="text-[10px] text-gray-400">CTR (클릭률)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color }}>{cvr.toFixed(2)}%</p>
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
            <span className="text-gray-400 font-normal ml-1.5">{campaigns.length}개</span>
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
                  {['캠페인명', '상태', '집행금액', '노출', '클릭', 'CTR', 'CPC', '전환', 'CVR', 'ROAS'].map(h => (
                    <th key={h} className={cn('px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap', ['캠페인명', '상태'].includes(h) ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {[...campaigns].sort((a, b) => b.spend - a.spend).map(c => {
                  const sc  = STATUS_CFG[c.status] ?? STATUS_CFG.completed
                  const cvr = c.clicks > 0 ? c.conversions / c.clicks * 100 : 0
                  return (
                    <tr key={c.id} className="hover:bg-surface-subtle">
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

    </div>
  )
}
