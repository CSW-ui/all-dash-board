'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Package } from 'lucide-react'
import { PlanningItemTable } from '@/components/planning/PlanningItemTable'
import { cn } from '@/lib/utils'
import { BRAND_COLORS, BRAND_TABS } from '@/lib/constants'
import { fmtW, fmtDelta, fmtDeltaPt } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
const SEASON_OPTIONS = [
  { label: '26 S/S', year: '26', season: '봄,여름,상반기,스탠다드' },
  { label: '26 봄', year: '26', season: '봄' },
  { label: '26 여름', year: '26', season: '여름' },
  { label: '26 상반기', year: '26', season: '상반기' },
  { label: '26 스탠다드', year: '26', season: '스탠다드' },
  { label: '25 F/W', year: '25', season: '가을,겨울,하반기,스탠다드' },
  { label: '25 가을', year: '25', season: '가을' },
  { label: '25 겨울', year: '25', season: '겨울' },
  { label: '25 S/S', year: '25', season: '봄,여름,상반기,스탠다드' },
  { label: '25 봄', year: '25', season: '봄' },
  { label: '25 여름', year: '25', season: '여름' },
]

// ── 타입 ──────────────────────────────────────────────────────
interface PlanItem {
  item: string; styleCnt: number; avgTag: number; avgCost: number
  ordQty: number; ordTagAmt: number; ordCostAmt: number
  inQty: number; inAmt: number; inboundRate: number
  saleQty: number; saleAmt: number; tagAmt: number; salePriceAmt: number; costAmt: number
  dcRate: number; cogsRate: number
  cwAmt: number; pwAmt: number; cwQty: number; cwCost: number; cwCogsRate: number; wow: number
  shopInv: number; shopAvail?: number; whAvail: number
  totalInv: number; sellThrough: number
}
interface PlanKpi {
  totalStyles: number
  totalOrdQty: number; totalOrdTagAmt: number
  totalInQty: number; totalInAmt: number
  totalSaleAmt: number; totalSaleQty: number
  totalInvQty: number; totalCostAmt: number
  sellThrough: number; inboundRate: number; dcRate: number; cogsRate: number
}
interface PlanChannel { channel: string; qty: number; amt: number }
interface PlanData { kpi: PlanKpi; items: PlanItem[]; channels: PlanChannel[] }

// (포맷 함수는 @/lib/formatters에서 import)

// ── 인사이트 생성 (규칙 기반) ──────────────────────────────────
interface Insight { type: 'growth' | 'warning' | 'suggest'; icon: React.ElementType; title: string; items: string[] }

function generateInsights(cur: PlanItem[], prev: PlanItem[]): Insight[] {
  const pm = new Map(prev.map(p => [p.item, p]))
  const insights: Insight[] = []

  const growth = cur
    .filter(c => { const p = pm.get(c.item); return p && p.saleAmt > 0 && ((c.saleAmt - p.saleAmt) / p.saleAmt) > 0.05 })
    .sort((a, b) => {
      const pa = pm.get(a.item)!; const pb = pm.get(b.item)!
      return ((b.saleAmt - pb.saleAmt) / pb.saleAmt) - ((a.saleAmt - pa.saleAmt) / pa.saleAmt)
    }).slice(0, 3)
  if (growth.length) {
    insights.push({ type: 'growth', icon: TrendingUp, title: '성장 아이템',
      items: growth.map(g => { const p = pm.get(g.item)!; return `${g.item} +${((g.saleAmt - p.saleAmt) / p.saleAmt * 100).toFixed(0)}% (${fmtW(g.saleAmt)})` }),
    })
  }

  const warning = cur.filter(c => {
    const p = pm.get(c.item)
    return (p && p.saleAmt > 0 && ((c.saleAmt - p.saleAmt) / p.saleAmt) < -0.1) || (c.sellThrough < 30 && c.totalInv > 100)
  }).slice(0, 3)
  if (warning.length) {
    insights.push({ type: 'warning', icon: AlertTriangle, title: '주의 필요',
      items: warning.map(w => {
        const p = pm.get(w.item)
        if (p && p.saleAmt > 0 && ((w.saleAmt - p.saleAmt) / p.saleAmt) < -0.1)
          return `${w.item} ${((w.saleAmt - p.saleAmt) / p.saleAmt * 100).toFixed(0)}% (소진율 ${w.sellThrough}%)`
        return `${w.item} 소진율 ${w.sellThrough}% (재고 ${w.totalInv.toLocaleString()})`
      }),
    })
  }

  const suggestions: string[] = []
  cur.forEach(c => {
    if (c.sellThrough > 70 && c.totalInv < 500) suggestions.push(`${c.item} 소진율 ${c.sellThrough}% — 물량 확대 검토`)
    const p = pm.get(c.item)
    if (p && c.avgTag > 0 && p.avgTag > 0) {
      const cr = (c.avgCost / c.avgTag) * 100; const pr = (p.avgCost / p.avgTag) * 100
      if (cr - pr > 3) suggestions.push(`${c.item} 원가율 ${cr.toFixed(1)}% (전년 ${pr.toFixed(1)}%) — 원가 검토`)
    }
  })
  if (suggestions.length) insights.push({ type: 'suggest', icon: Lightbulb, title: '기획 제안', items: suggestions.slice(0, 3) })

  return insights
}

// ── 메인 ──────────────────────────────────────────────────────
export default function PlanningDashboard() {
  const { allowedBrands } = useAuth()

  const [brand, setBrand] = useState('all')
  const [selSeason, setSelSeason] = useState(SEASON_OPTIONS[0])

  const router = useRouter()

  const [data, setData] = useState<PlanData | null>(null)
  const [compData, setCompData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleBrands = allowedBrands
    ? [...(allowedBrands.length > 1 ? [{ label: '전체', value: 'all' }] : []),
       ...BRAND_TABS.filter(b => b.value !== 'all' && allowedBrands.includes(b.value))]
    : BRAND_TABS

  // 전년 동시즌 자동 계산 + 동기간 맞춤
  const compYear = String(Number(selSeason.year) - 1)
  const compLabel = selSeason.label.replace(selSeason.year, compYear)

  // 전년 동기간: 전주 일요일의 전년 동일 날짜
  const compToDt = useMemo(() => {
    const today = new Date()
    const dow = today.getDay()
    const lastSun = new Date(today)
    lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
    const ly = new Date(lastSun)
    ly.setFullYear(ly.getFullYear() - 1)
    return `${ly.getFullYear()}${String(ly.getMonth()+1).padStart(2,'0')}${String(ly.getDate()).padStart(2,'0')}`
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [res, cRes] = await Promise.all([
        fetch(`/api/planning?brand=${brand}&year=${selSeason.year}&season=${selSeason.season}`),
        fetch(`/api/planning?brand=${brand}&year=${compYear}&season=${selSeason.season}&toDt=${compToDt}`),
      ])
      const [json, cJson] = await Promise.all([res.json(), cRes.json()])
      if (!res.ok) throw new Error(json.error)
      setData(json)
      setCompData(cRes.ok ? cJson : null)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [brand, selSeason, compYear, compToDt])

  useEffect(() => { fetchData() }, [fetchData])

  const handleItemClick = (itemName: string) => {
    router.push(`/planning/${encodeURIComponent(itemName)}?year=${selSeason.year}&season=${encodeURIComponent(selSeason.season)}`)
  }

  // KPI 카드
  const kpiCards = useMemo(() => {
    if (!data) return []
    const k = data.kpi; const ck = compData?.kpi
    return [
      { title: '총 스타일수', value: `${k.totalStyles}개`, delta: fmtDelta(k.totalStyles, ck?.totalStyles ?? 0) },
      { title: '발주금액(TAG)', value: fmtW(k.totalOrdTagAmt), delta: fmtDelta(k.totalOrdTagAmt, ck?.totalOrdTagAmt ?? 0) },
      { title: '입고율', value: `${k.inboundRate ?? 0}%`, delta: fmtDeltaPt(k.inboundRate ?? 0, ck?.inboundRate ?? 0) },
      { title: 'DC%(할인율)', value: `${k.dcRate ?? 0}%`, delta: fmtDeltaPt(k.dcRate ?? 0, ck?.dcRate ?? 0) },
      { title: '소진율', value: `${k.sellThrough}%`, delta: fmtDeltaPt(k.sellThrough, ck?.sellThrough ?? 0) },
      { title: '총 매출', value: fmtW(k.totalSaleAmt), delta: fmtDelta(k.totalSaleAmt, ck?.totalSaleAmt ?? 0) },
    ]
  }, [data, compData])

  // 인사이트
  const insights = useMemo(() => {
    if (!data) return []
    return generateInsights(data.items, compData?.items ?? [])
  }, [data, compData])

  const insColors = { growth: 'bg-emerald-50 border-emerald-200 text-emerald-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', suggest: 'bg-blue-50 border-blue-200 text-blue-800' }
  const insIconColors = { growth: 'text-emerald-500', warning: 'text-amber-500', suggest: 'text-blue-500' }

  return (
    <div className="flex flex-col gap-4 p-4 min-h-0">

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">기획현황판</h1>
          <p className="text-xs text-gray-400 mt-0.5">시즌별 아이템 기획·실적·재고 종합 분석</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-subtle transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400">브랜드</span>
        <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
          {visibleBrands.map(b => (
            <button key={b.value} onClick={() => setBrand(b.value)}
              className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
                brand === b.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {b.value !== 'all' && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-px" style={{ background: BRAND_COLORS[b.value] }} />}
              {b.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-2">시즌</span>
        <select value={SEASON_OPTIONS.indexOf(selSeason)}
          onChange={e => { const idx = Number(e.target.value); setSelSeason(SEASON_OPTIONS[idx]) }}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {SEASON_OPTIONS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>

        <span className="text-[10px] text-gray-300 ml-2">비교: {compLabel} (자동)</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>}

      {/* KPI 카드 */}
      <div className="grid grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[88px] bg-surface-subtle animate-pulse rounded-xl" />
        )) : kpiCards.map(kpi => (
          <div key={kpi.title} className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{kpi.title}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{kpi.value}</p>
            <span className={cn('text-[10px] font-medium',
              kpi.delta.pos === null ? 'text-gray-300' : kpi.delta.pos ? 'text-emerald-600' : 'text-red-500')}>
              {kpi.delta.t} vs {compLabel}
            </span>
          </div>
        ))}
      </div>

      {/* 인사이트 카드 */}
      {!loading && insights.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className={cn('rounded-xl border p-3', insColors[ins.type])}>
              <div className="flex items-center gap-1.5 mb-2">
                <ins.icon size={14} className={insIconColors[ins.type]} />
                <span className="text-xs font-semibold">{ins.title}</span>
              </div>
              <ul className="space-y-1">
                {ins.items.map((item, j) => <li key={j} className="text-[10px] leading-relaxed">· {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 품목별 상세 테이블 */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
        <h3 className="text-xs font-semibold text-gray-700 mb-3">
          품목별 기획·판매·재고 현황
          <span className="ml-2 font-normal text-gray-400">{selSeason.label} · 품목 클릭 시 상세 페이지</span>
        </h3>
        <PlanningItemTable items={data?.items ?? []} compItems={compData?.items ?? []} loading={loading} onItemClick={handleItemClick} />
      </div>
    </div>
  )
}
