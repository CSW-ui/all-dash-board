'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie,
} from 'recharts'
import { RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Zap, Skull, TrendingDown, ArrowUpRight } from 'lucide-react'
import { PlanningItemTable } from '@/components/planning/PlanningItemTable'
import { cn } from '@/lib/utils'
import { BRAND_COLORS, BRAND_TABS, ITEM_CATEGORIES, CATEGORY_COLORS } from '@/lib/constants'
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
  item: string; category: string; styleCnt: number; skuCnt: number
  avgTag: number; avgCost: number
  ordQty: number; ordTagAmt: number; ordCostAmt: number
  inQty: number; inAmt: number; inboundRate: number
  saleQty: number; saleAmt: number; tagAmt: number; salePriceAmt: number; costAmt: number
  dcRate: number; cogsRate: number; salesRate: number
  cwAmt: number; pwAmt: number; pw2Amt: number; cwQty: number; cwCost: number; cwCogsRate: number; wow: number
  recentWowAvg: number
  monthAmt: number; monthQty: number
  shopInv: number; shopAvail?: number; whAvail: number
  totalInv: number; invTagAmt: number; invCostAmt: number
  sellThrough: number
}
interface PlanKpi {
  totalStyles: number; totalSkus: number
  totalOrdQty: number; totalOrdTagAmt: number
  totalInQty: number; totalInAmt: number
  totalSaleAmt: number; totalSaleQty: number; totalSaleTagAmt: number
  totalInvQty: number; totalCostAmt: number
  totalMonthAmt: number; totalMonthQty: number
  totalInvTagAmt: number; totalInvCostAmt: number
  salesRate: number; sellThrough: number; inboundRate: number; dcRate: number; cogsRate: number
}
interface PlanChannel { channel: string; qty: number; amt: number }
interface PlanData { kpi: PlanKpi; items: PlanItem[]; channels: PlanChannel[] }

// ── 상품 진단 ──────────────────────────────────────────────────
type DiagGrade = 'hero' | 'normal' | 'rising' | 'slow' | 'dead'

function diagnosItem(cur: PlanItem, comp?: PlanItem): DiagGrade {
  const curRate = cur.salesRate
  const compRate = comp && comp.inQty > 0
    ? (comp.saleQty / comp.inQty) * 100 : null

  // 전년 기준선이 없으면 절대 기준 사용
  if (compRate === null) {
    if (curRate >= 70) return 'hero'
    if (curRate >= 40) return 'normal'
    if (cur.recentWowAvg >= 15) return 'rising'
    if (curRate >= 20) return 'slow'
    return 'dead'
  }

  const gap = curRate - compRate

  // Rising 보정: 최근 3주 WoW 평균 ≥ 15%
  if (gap < -20 && cur.recentWowAvg >= 15) return 'rising'

  if (gap >= 20) return 'hero'
  if (gap >= -20) return 'normal'
  if (gap >= -40) return 'slow'
  // Dead: gap < -40 AND 최근 판매 미미
  if (cur.cwAmt === 0 && cur.pwAmt === 0) return 'dead'
  return 'slow'
}

const DIAG_CONFIG: Record<DiagGrade, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  hero:   { label: 'Hero',         color: '#059669', bg: '#d1fae5', icon: Zap },
  normal: { label: 'Normal',       color: '#3b82f6', bg: '#dbeafe', icon: TrendingUp },
  rising: { label: 'Rising',       color: '#8b5cf6', bg: '#ede9fe', icon: ArrowUpRight },
  slow:   { label: 'Slow Moving',  color: '#d97706', bg: '#fef3c7', icon: TrendingDown },
  dead:   { label: 'Dead Stock',   color: '#dc2626', bg: '#fee2e2', icon: Skull },
}

// ── 인사이트 생성 ──────────────────────────────────────────────
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
    return (p && p.saleAmt > 0 && ((c.saleAmt - p.saleAmt) / p.saleAmt) < -0.1) || (c.salesRate < 30 && c.totalInv > 100)
  }).slice(0, 3)
  if (warning.length) {
    insights.push({ type: 'warning', icon: AlertTriangle, title: '주의 필요',
      items: warning.map(w => {
        const p = pm.get(w.item)
        if (p && p.saleAmt > 0 && ((w.saleAmt - p.saleAmt) / p.saleAmt) < -0.1)
          return `${w.item} ${((w.saleAmt - p.saleAmt) / p.saleAmt * 100).toFixed(0)}% (판매율 ${w.salesRate}%)`
        return `${w.item} 판매율 ${w.salesRate}% (재고 ${w.totalInv.toLocaleString()})`
      }),
    })
  }

  const suggestions: string[] = []
  cur.forEach(c => {
    if (c.salesRate > 70 && c.totalInv < 500) suggestions.push(`${c.item} 판매율 ${c.salesRate}% — 물량 확대 검토`)
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
  const [selCategory, setSelCategory] = useState('전체')

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

  // 카테고리 필터 적용
  const filteredItems = useMemo(() => {
    if (!data) return []
    if (selCategory === '전체') return data.items
    return data.items.filter(i => i.category === selCategory)
  }, [data, selCategory])

  const filteredCompItems = useMemo(() => {
    if (!compData) return []
    if (selCategory === '전체') return compData.items
    return compData.items.filter(i => i.category === selCategory)
  }, [compData, selCategory])

  const handleItemClick = (itemName: string) => {
    router.push(`/planning/${encodeURIComponent(itemName)}?year=${selSeason.year}&season=${encodeURIComponent(selSeason.season)}`)
  }

  // 진단 결과 계산
  const diagResults = useMemo(() => {
    const compMap = new Map((compData?.items ?? []).map(c => [c.item, c]))
    return filteredItems.map(item => ({
      ...item,
      diagnosis: diagnosItem(item, compMap.get(item.item)),
    }))
  }, [filteredItems, compData])

  // 진단 요약
  const diagSummary = useMemo(() => {
    const summary: Record<DiagGrade, { count: number; invTagAmt: number; items: string[] }> = {
      hero:   { count: 0, invTagAmt: 0, items: [] },
      normal: { count: 0, invTagAmt: 0, items: [] },
      rising: { count: 0, invTagAmt: 0, items: [] },
      slow:   { count: 0, invTagAmt: 0, items: [] },
      dead:   { count: 0, invTagAmt: 0, items: [] },
    }
    diagResults.forEach(r => {
      summary[r.diagnosis].count++
      summary[r.diagnosis].invTagAmt += r.invTagAmt
      summary[r.diagnosis].items.push(r.item)
    })
    return summary
  }, [diagResults])

  // KPI (필터 적용)
  const kpiData = useMemo(() => {
    if (!data) return null
    const items = filteredItems
    const totalStyles = items.reduce((s, i) => s + i.styleCnt, 0)
    const totalSkus = items.reduce((s, i) => s + i.skuCnt, 0)
    const totalInQty = items.reduce((s, i) => s + i.inQty, 0)
    const totalSaleQty = items.reduce((s, i) => s + i.saleQty, 0)
    const totalSaleAmt = items.reduce((s, i) => s + i.saleAmt, 0)
    const totalSaleTagAmt = items.reduce((s, i) => s + i.tagAmt, 0)
    const totalSalePriceAmt = items.reduce((s, i) => s + i.salePriceAmt, 0)
    const totalCostAmt = items.reduce((s, i) => s + i.costAmt, 0)
    const totalInvTagAmt = items.reduce((s, i) => s + i.invTagAmt, 0)
    const totalInvCostAmt = items.reduce((s, i) => s + i.invCostAmt, 0)
    const totalOrdTagAmt = items.reduce((s, i) => s + i.ordTagAmt, 0)

    const salesRate = totalInQty > 0 ? Math.round(totalSaleQty / totalInQty * 1000) / 10 : 0
    const dcRate = totalSaleTagAmt > 0 ? Math.round((1 - totalSalePriceAmt / totalSaleTagAmt) * 1000) / 10 : 0
    const cogsRate = totalSaleAmt > 0 ? Math.round(totalCostAmt / totalSaleAmt * 1000) / 10 : 0

    const totalInAmt = items.reduce((s, i) => s + i.inAmt, 0)

    return { totalStyles, totalSkus, totalSaleAmt, totalSaleTagAmt, salesRate, dcRate, cogsRate, totalInvTagAmt, totalInvCostAmt, totalOrdTagAmt, totalInAmt }
  }, [filteredItems, data])

  const compKpi = useMemo(() => {
    if (!compData) return null
    const items = filteredCompItems
    const totalInQty = items.reduce((s, i) => s + i.inQty, 0)
    const totalSaleQty = items.reduce((s, i) => s + i.saleQty, 0)
    const totalSaleAmt = items.reduce((s, i) => s + i.saleAmt, 0)
    const totalSaleTagAmt = items.reduce((s, i) => s + i.tagAmt, 0)
    const totalSalePriceAmt = items.reduce((s, i) => s + i.salePriceAmt, 0)
    const totalCostAmt = items.reduce((s, i) => s + i.costAmt, 0)
    const totalStyles = items.reduce((s, i) => s + i.styleCnt, 0)
    const totalSkus = items.reduce((s, i) => s + i.skuCnt, 0)
    const totalInvTagAmt = items.reduce((s, i) => s + i.invTagAmt, 0)
    const totalInvCostAmt = items.reduce((s, i) => s + i.invCostAmt, 0)

    const salesRate = totalInQty > 0 ? Math.round(totalSaleQty / totalInQty * 1000) / 10 : 0
    const dcRate = totalSaleTagAmt > 0 ? Math.round((1 - totalSalePriceAmt / totalSaleTagAmt) * 1000) / 10 : 0
    const cogsRate = totalSaleAmt > 0 ? Math.round(totalCostAmt / totalSaleAmt * 1000) / 10 : 0

    const totalOrdTagAmt = items.reduce((s, i) => s + i.ordTagAmt, 0)
    const totalInAmt = items.reduce((s, i) => s + i.inAmt, 0)

    return { totalStyles, totalSkus, totalSaleAmt, salesRate, dcRate, cogsRate, totalInvTagAmt, totalInvCostAmt, totalOrdTagAmt, totalInAmt }
  }, [filteredCompItems, compData])

  // 생산비중 vs 매출비중 데이터
  const ratioChartData = useMemo(() => {
    if (!kpiData || !filteredItems.length) return []
    const totalOrd = filteredItems.reduce((s, i) => s + i.ordTagAmt, 0)
    const totalSale = filteredItems.reduce((s, i) => s + i.saleAmt, 0)
    return filteredItems
      .filter(i => i.ordTagAmt > 0 || i.saleAmt > 0)
      .map(i => ({
        item: i.item,
        prodRatio: totalOrd > 0 ? Math.round(i.ordTagAmt / totalOrd * 1000) / 10 : 0,
        saleRatio: totalSale > 0 ? Math.round(i.saleAmt / totalSale * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.saleRatio - a.saleRatio)
      .slice(0, 12)
  }, [filteredItems, kpiData])

  // 인사이트
  const insights = useMemo(() => {
    if (!data) return []
    return generateInsights(filteredItems, filteredCompItems)
  }, [filteredItems, filteredCompItems, data])

  const insColors = { growth: 'bg-emerald-50 border-emerald-200 text-emerald-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', suggest: 'bg-blue-50 border-blue-200 text-blue-800' }
  const insIconColors = { growth: 'text-emerald-500', warning: 'text-amber-500', suggest: 'text-blue-500' }

  // 판매율 도넛 차트 데이터
  const salesRatePieData = useMemo(() => {
    if (!kpiData) return []
    const rate = kpiData.salesRate
    return [
      { name: '판매', value: rate, fill: '#e91e63' },
      { name: '미판매', value: Math.max(0, 100 - rate), fill: '#f1f5f9' },
    ]
  }, [kpiData])

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

      {/* 필터: 브랜드 + 시즌 + 카테고리 */}
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

        <span className="text-xs text-gray-400 ml-2">품목</span>
        <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
          {ITEM_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelCategory(cat)}
              className={cn('px-2 py-1 text-[11px] font-medium rounded-md transition-colors',
                selCategory === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {cat !== '전체' && CATEGORY_COLORS[cat] && (
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 mb-px" style={{ background: CATEGORY_COLORS[cat].text }} />
              )}
              {cat}
            </button>
          ))}
        </div>

{/* 전년 비교는 KPI 블록 내 정량+정율로 표시 */}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>}

      {/* KPI 섹션 — ① 매출 ② 판매율 ③ 발주 ④ 입고 ⑤ 재고 ⑥ 할인율 */}
      <div className="grid grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[110px] bg-surface-subtle animate-pulse rounded-xl" />
        )) : kpiData && (
          <>
            {/* ① 매출 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">매출</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtW(kpiData.totalSaleAmt)}</p>
              <p className="text-[10px] text-gray-500">{kpiData.totalStyles}st · {kpiData.totalSkus}SKU</p>
              {compKpi && (
                <div className="flex gap-1.5 mt-0.5">
                  <span className={cn('text-[10px] font-medium', kpiData.totalSaleAmt >= compKpi.totalSaleAmt ? 'text-emerald-600' : 'text-red-500')}>
                    {fmtDelta(kpiData.totalSaleAmt, compKpi.totalSaleAmt).t}
                  </span>
                  <span className="text-[10px] text-gray-400">({fmtW(kpiData.totalSaleAmt - compKpi.totalSaleAmt)})</span>
                </div>
              )}
            </div>

            {/* ② 판매율 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-3 flex flex-col items-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide w-full">판매율</p>
              <div className="relative" style={{ width: 64, height: 64 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={salesRatePieData} dataKey="value" innerRadius={20} outerRadius={30} startAngle={90} endAngle={-270} strokeWidth={0}>
                      {salesRatePieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{kpiData.salesRate}%</span>
              </div>
              <span className={cn('text-[10px] font-medium', compKpi ? 'text-gray-600' : 'text-gray-300')}>
                {compKpi ? fmtDeltaPt(kpiData.salesRate, compKpi.salesRate).t : '—'}
              </span>
            </div>

            {/* ③ 발주 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">발주(TAG)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtW(kpiData.totalOrdTagAmt)}</p>
              {compKpi && (
                <div className="flex gap-1.5 mt-0.5">
                  <span className={cn('text-[10px] font-medium', kpiData.totalOrdTagAmt >= compKpi.totalOrdTagAmt ? 'text-emerald-600' : 'text-red-500')}>
                    {fmtDelta(kpiData.totalOrdTagAmt, compKpi.totalOrdTagAmt).t}
                  </span>
                  <span className="text-[10px] text-gray-400">({fmtW(kpiData.totalOrdTagAmt - compKpi.totalOrdTagAmt)})</span>
                </div>
              )}
            </div>

            {/* ④ 입고 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">입고금액</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtW(kpiData.totalInAmt)}</p>
              <p className="text-[10px] text-gray-500">입고율 {data?.kpi.inboundRate ?? 0}%</p>
              {compKpi && (
                <div className="flex gap-1.5 mt-0.5">
                  <span className={cn('text-[10px] font-medium', kpiData.totalInAmt >= compKpi.totalInAmt ? 'text-emerald-600' : 'text-red-500')}>
                    {fmtDelta(kpiData.totalInAmt, compKpi.totalInAmt).t}
                  </span>
                  <span className="text-[10px] text-gray-400">({fmtW(kpiData.totalInAmt - compKpi.totalInAmt)})</span>
                </div>
              )}
            </div>

            {/* ⑤ 재고 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">재고(TAG)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtW(kpiData.totalInvTagAmt)}</p>
              <p className="text-[10px] text-gray-500">원가 {fmtW(kpiData.totalInvCostAmt)}</p>
            </div>

            {/* ⑥ 할인율 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">할인율</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{kpiData.dcRate}%</p>
              <span className={cn('text-[10px] font-medium', compKpi ? (kpiData.dcRate <= compKpi.dcRate ? 'text-emerald-600' : 'text-red-500') : 'text-gray-300')}>
                {compKpi ? fmtDeltaPt(kpiData.dcRate, compKpi.dcRate).t : '—'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 진단 요약 카드 + 생산vs매출 비중 차트 */}
      {!loading && (
        <div className="grid grid-cols-12 gap-3">
          {/* 진단 요약 5개 카드 */}
          <div className="col-span-5 grid grid-cols-5 gap-2">
            {(['hero', 'normal', 'rising', 'slow', 'dead'] as DiagGrade[]).map(grade => {
              const cfg = DIAG_CONFIG[grade]
              const s = diagSummary[grade]
              return (
                <div key={grade} className="rounded-xl border p-3 flex flex-col gap-1" style={{ background: cfg.bg, borderColor: cfg.color + '30' }}>
                  <div className="flex items-center gap-1">
                    <cfg.icon size={12} style={{ color: cfg.color }} />
                    <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-lg font-bold" style={{ color: cfg.color }}>{s.count}<span className="text-[10px] font-normal ml-0.5">품목</span></p>
                  <p className="text-[9px]" style={{ color: cfg.color }}>재고 {fmtW(s.invTagAmt)}</p>
                  <p className="text-[8px] text-gray-500 truncate" title={s.items.join(', ')}>{s.items.slice(0, 3).join(', ')}{s.items.length > 3 ? '...' : ''}</p>
                </div>
              )
            })}
          </div>

          {/* 생산비중 vs 매출비중 차트 */}
          <div className="col-span-7 bg-white rounded-xl border border-surface-border shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              생산비중 vs 매출비중
              <span className="ml-2 font-normal text-gray-400">기획 적중률 — 매출비중이 생산비중을 상회할수록 효율적</span>
            </h3>
            {ratioChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ratioChartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="item" type="category" tick={{ fontSize: 10 }} width={56} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="prodRatio" name="생산비중" fill="#94a3b8" radius={[0, 2, 2, 0]} barSize={8} />
                  <Bar dataKey="saleRatio" name="매출비중" fill="#e91e63" radius={[0, 2, 2, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-xs text-gray-300">데이터 없음</div>}
          </div>
        </div>
      )}

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
          <span className="ml-2 font-normal text-gray-400">{selSeason.label} · {selCategory !== '전체' ? selCategory + ' · ' : ''}품목 클릭 시 상세 페이지</span>
        </h3>
        <PlanningItemTable
          items={diagResults}
          compItems={filteredCompItems}
          loading={loading}
          onItemClick={handleItemClick}
        />
      </div>
    </div>
  )
}
