'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { RefreshCw, Package, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAND_COLORS, BRAND_NAMES, BRAND_TABS, brandNameToCode } from '@/lib/constants'
import { fmtM, fmtPctI, fmtPctS } from '@/lib/formatters'
import { useTargetData } from '@/hooks/useTargetData'
import { useAuth } from '@/contexts/AuthContext'
import { PerfCells, PERF_GROUP_HEADER, PERF_HEADER_COLS } from '@/components/sales/PerfCells'
import {
  type ChannelGroup, type WeekPoint, type WeeklyMeta, type Product,
  type PerfData, type PerfMetrics, type SelFilter, type MonthProgress,
  CHANNEL_GROUP_ORDER, CHANNEL_GROUP_COLORS,
  getChannelGroup, fmt, pct, sumAgg, calcMetrics, channelParams,
} from '@/lib/sales-types'

const YEAR_TABS = [
  { label: '2026년', value: '2026' },
  { label: '2025년', value: '2025' },
]

interface BrandRow { label: string; brandcd: string; m: PerfMetrics; bold?: boolean }
interface ChRow { group: ChannelGroup; channel: string; m: PerfMetrics; isGroupTotal: boolean }

function getLastSunday(): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// ── 툴팁 ─────────────────────────────────────────────────────────
function WeekTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  const weekStart = p?.weekStart
  const dateLabel = weekStart
    ? `${parseInt(weekStart.slice(4, 6))}/${parseInt(weekStart.slice(6))} 주`
    : `W${label}`
  return (
    <div className="bg-white border border-surface-border rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-1.5">{dateLabel}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-3 mt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium">{p.value != null ? fmt(p.value) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function SalesDashboard() {
  const { allowedBrands, isAdmin } = useAuth()

  // 브랜드 권한에 따라 초기값 설정
  const defaultBrand = allowedBrands?.length === 1 ? allowedBrands[0] : 'all'
  const [brand,    setBrand]    = useState(defaultBrand)
  const [year,     setYear]     = useState('2026')
  const [selMonth, setSelMonth] = useState('')  // '' = 현재 월 자동, '202601' 등 = 특정 월

  // 권한이 있는 브랜드 탭만 표시
  const visibleBrandTabs = allowedBrands
    ? [
        ...(allowedBrands.length > 1 ? [{ label: '전체', value: 'all' }] : []),
        ...BRAND_TABS.filter(b => b.value !== 'all' && allowedBrands.includes(b.value)),
      ]
    : BRAND_TABS
  const [selWeek,  setSelWeek]  = useState<number | null>(null)
  const [selFilter, setSelFilter] = useState<SelFilter>({ type: 'total' })
  const [selProduct, setSelProduct] = useState<{ code: string; name: string } | null>(null)
  const [selBrand, setSelBrand] = useState<string | null>(null)  // 브랜드 행 클릭 필터
  const [selItemFilter, setSelItemFilter] = useState<string | null>(null)  // 품목 클릭 필터
  const [itemSortKey, setItemSortKey] = useState<string>('cwRev')
  const [itemSortDir, setItemSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleItemSort = (k: string) => { if (itemSortKey === k) setItemSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setItemSortKey(k); setItemSortDir('desc') } }

  const [weeks,     setWeeks]     = useState<WeekPoint[]>([])
  const [weekMeta,  setWeekMeta]  = useState<WeeklyMeta | null>(null)
  const [products,  setProducts]  = useState<Product[]>([])

  const [perfData, setPerfData]     = useState<PerfData | null>(null)
  const [perfLoading, setPerfLoading] = useState(true)
  const [itemData, setItemData]     = useState<any[]>([])

  const [wLoading, setWLoading] = useState(true)
  const [pLoading, setPLoading] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const { targets } = useTargetData()
  const lastSunday = useMemo(getLastSunday, [])

  // ── 주간 차트 데이터 fetch ─────────────────────────────────────
  const fetchWeekly = useCallback(async (sf: SelFilter, stylecd?: string | null) => {
    setWLoading(true); setError(null)
    const toDt = year === String(new Date().getFullYear()) ? lastSunday : `${year}1231`
    const styleParam = stylecd ? `&stylecd=${encodeURIComponent(stylecd)}` : ''
    try {
      const url = `/api/sales/weekly?brand=${brand}&toDt=${toDt}${channelParams(sf)}${styleParam}`
      const res  = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setWeeks(json.weeks)
      setWeekMeta(json.meta)
    } catch (e) { setError(String(e)) }
    finally { setWLoading(false) }
  }, [brand, year, lastSunday])

  // ── 상품 fetch (기본: 전주 실적 기준) ─────────────────────────
  const fetchProducts = useCallback(async (sw: number | null, sf: SelFilter) => {
    setPLoading(true)
    const toDt = year === String(new Date().getFullYear()) ? lastSunday : `${year}1231`
    const weekParam = sw != null ? `&weekNum=${sw}` : ''
    // 특정 주 선택 없으면 전주(최근 완료 주) 기준 조회
    const fromParam = sw == null && year === String(new Date().getFullYear())
      ? (() => {
          const d = new Date()
          const dow = d.getDay()
          const sun = new Date(d); sun.setDate(d.getDate() - (dow === 0 ? 7 : dow))
          const mon = new Date(sun); mon.setDate(sun.getDate() - 6)
          return `&fromDt=${mon.getFullYear()}${String(mon.getMonth()+1).padStart(2,'0')}${String(mon.getDate()).padStart(2,'0')}`
        })()
      : ''
    try {
      const url = `/api/sales/products?brand=${brand}&year=${year}&toDt=${toDt}${weekParam}${fromParam}${channelParams(sf)}`
      const res  = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setProducts(json.products ?? [])
    } catch (e) { setProducts([]) }
    finally { setPLoading(false) }
  }, [brand, year, lastSunday])

  // ── 영업 현황 데이터 fetch ────────────────────────────────────
  const fetchPerformance = useCallback(async (stylecd?: string | null) => {
    setPerfLoading(true)
    const styleParam = stylecd ? `&stylecd=${encodeURIComponent(stylecd)}` : ''
    try {
      const monthParam = selMonth ? `&month=${selMonth}` : ''
      const res = await fetch(`/api/sales/performance?brand=${brand}${styleParam}${monthParam}`)
      const perfJson = await res.json()
      if (!res.ok) throw new Error(perfJson.error)
      setPerfData(perfJson)
    } catch { setPerfData(null) }
    finally { setPerfLoading(false) }
  }, [brand, selMonth])

  // ── 품목 데이터 fetch (브랜드 행 클릭 시 별도 호출) ────────
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/items?brand=${brand}`)
      const json = await res.json()
      if (res.ok && json.items) setItemData(json.items)
    } catch {}
  }, [brand])

  // 초기 + brand탭/year 변경 시 → 전체 fetch
  useEffect(() => {
    setSelWeek(null); setSelFilter({ type: 'total' }); setSelProduct(null); setSelBrand(null); setSelItemFilter(null)
    fetchWeekly({ type: 'total' })
    fetchProducts(null, { type: 'total' })
    fetchPerformance()
    fetchItems()
  }, [brand, year, selMonth])

  // 채널 행 클릭 → 차트 + 베스트만 re-fetch (perf 테이블 유지)
  useEffect(() => {
    if (selFilter.type === 'total') return // 초기 로드는 위에서 처리
    fetchWeekly(selFilter, selProduct?.code)
    fetchProducts(selWeek, selFilter)
  }, [selFilter])

  // 주간 클릭 → 베스트 + 품목 re-fetch
  useEffect(() => {
    fetchProducts(selWeek, selFilter)
    const b = selBrand ?? brand
    const weekP = selWeek ? `&weekNum=${selWeek}` : ''
    fetch(`/api/sales/items?brand=${b}${weekP}`).then(r => r.json()).then(j => { if (j.items) setItemData(j.items) }).catch(() => {})
  }, [selWeek])

  // 상품 클릭 → 차트만 re-fetch (다른 테이블 유지)
  useEffect(() => {
    fetchWeekly(selFilter, selProduct?.code)
  }, [selProduct])

  // ── 영업 현황 테이블 데이터 빌드 ──────────────────────────────
  const perfTableData = useMemo(() => {
    if (!perfData) return null
    // selBrand 필터 적용: 채널 테이블은 선택된 브랜드만
    const cy = selBrand ? perfData.cy.filter(r => r.brandcd === selBrand) : perfData.cy
    const ly = selBrand ? perfData.ly.filter(r => r.brandcd === selBrand) : perfData.ly

    // 현재 월 자동 감지 (API에서 계산된 monthStart 기반)
    const curMonth = perfData.meta.monthStart.slice(0, 6) // YYYYMM
    const curYear = curMonth.slice(0, 4)

    // 목표 데이터 필터: 정확한 월 매칭 우선, 없으면 해당 연도 전체 사용
    const exactMonthTargets = targets.filter(t => t.yyyymm === curMonth)
    const monthTargets = exactMonthTargets.length > 0
      ? exactMonthTargets
      : targets.filter(t => t.yyyymm.startsWith(curYear))
    // 연도 전체 합산 시 월수로 나눠서 월평균 산출
    const monthCount = exactMonthTargets.length > 0
      ? 1
      : new Set(targets.filter(t => t.yyyymm.startsWith(curYear)).map(t => t.yyyymm)).size || 1

    // 브랜드별 목표 lookup
    const brandTargetMap: Record<string, number> = {}
    // 채널별 목표 lookup: key = "brandcd|shoptypenm" or "all|shoptypenm"
    const channelTargetMap: Record<string, number> = {}

    for (const t of monthTargets) {
      const cd = brandNameToCode(t.brandnm)
      if (!cd) continue

      // 연도 합산 모드일 때는 월평균으로 변환
      const tgt = exactMonthTargets.length > 0 ? t.target : t.target / monthCount

      if (t.shoptypenm) {
        const key = `${cd}|${t.shoptypenm}`
        channelTargetMap[key] = (channelTargetMap[key] ?? 0) + tgt
        const allKey = `all|${t.shoptypenm}`
        channelTargetMap[allKey] = (channelTargetMap[allKey] ?? 0) + tgt
        // 채널 목표도 브랜드 합산에 포함
        brandTargetMap[cd] = (brandTargetMap[cd] ?? 0) + tgt
      } else {
        brandTargetMap[cd] = (brandTargetMap[cd] ?? 0) + tgt
      }
    }

    // 채널 목표 매칭 헬퍼 (shoptypenm의 부분 매칭 지원)
    function findChannelTarget(shoptypenm: string): number | null {
      // 현재 brand 필터에 따라 키 결정
      const prefix = brand === 'all' ? 'all' : brand
      const exact = channelTargetMap[`${prefix}|${shoptypenm}`]
      if (exact != null) return exact
      // 부분 매칭 시도
      const norm = shoptypenm.trim().toLowerCase()
      for (const [k, v] of Object.entries(channelTargetMap)) {
        if (!k.startsWith(`${prefix}|`)) continue
        if (k.split('|')[1].trim().toLowerCase().includes(norm) || norm.includes(k.split('|')[1].trim().toLowerCase())) return v
      }
      return null
    }

    // 월 진행도 계산
    const cwEndDate = new Date(
      parseInt(perfData.meta.cwEnd.slice(0, 4)),
      parseInt(perfData.meta.cwEnd.slice(4, 6)) - 1,
      parseInt(perfData.meta.cwEnd.slice(6, 8))
    )
    const monthYear = cwEndDate.getFullYear()
    const monthIdx = cwEndDate.getMonth()
    const daysElapsed = cwEndDate.getDate()
    const daysTotal = new Date(monthYear, monthIdx + 1, 0).getDate()
    const monthProgress: MonthProgress = { daysElapsed, daysTotal }

    // 브랜드별 행 (항상 전체 데이터 사용)
    const allCy = perfData.cy; const allLy = perfData.ly
    const brandCodes = Array.from(new Set(allCy.map(r => r.brandcd)))
    const brandSorted = brandCodes
      .map(bc => ({ bc, rev: allCy.filter(r => r.brandcd === bc).reduce((s, r) => s + r.mtdRev, 0) }))
      .sort((a, b) => b.rev - a.rev)
      .map(x => x.bc)

    const brandRows: BrandRow[] = []
    const cyAll = sumAgg(allCy); const lyAll = sumAgg(allLy)
    const totalTgt = Object.values(brandTargetMap).reduce((s, v) => s + v, 0) || null
    brandRows.push({ label: '합계', brandcd: 'all', m: calcMetrics(cyAll, lyAll, totalTgt), bold: true })
    for (const bc of brandSorted) {
      const c = sumAgg(allCy.filter(r => r.brandcd === bc))
      const l = sumAgg(allLy.filter(r => r.brandcd === bc))
      brandRows.push({ label: BRAND_NAMES[bc] ?? bc, brandcd: bc, m: calcMetrics(c, l, brandTargetMap[bc] ?? null) })
    }

    // 채널별 행
    const chRows: ChRow[] = []
    for (const grp of CHANNEL_GROUP_ORDER) {
      const gc = cy.filter(r => getChannelGroup(r.shoptypenm) === grp)
      const gl = ly.filter(r => getChannelGroup(r.shoptypenm) === grp)
      if (!gc.length) continue

      // 그룹 합계 - 그룹 내 채널 목표 합산
      const grpChannels = Array.from(new Set(gc.map(r => r.shoptypenm)))
      let grpTarget: number | null = null
      for (const ch of grpChannels) {
        const ct = findChannelTarget(ch)
        if (ct != null) grpTarget = (grpTarget ?? 0) + ct
      }
      chRows.push({ group: grp, channel: '합계', m: calcMetrics(sumAgg(gc), sumAgg(gl), grpTarget), isGroupTotal: true })

      const channels = grpChannels
        .sort((a, b) => gc.filter(r => r.shoptypenm === b).reduce((s, r) => s + r.mtdRev, 0)
                      - gc.filter(r => r.shoptypenm === a).reduce((s, r) => s + r.mtdRev, 0))
      for (const ch of channels) {
        const cc = sumAgg(gc.filter(r => r.shoptypenm === ch))
        const cl = sumAgg(gl.filter(r => r.shoptypenm === ch))
        chRows.push({ group: grp, channel: ch, m: calcMetrics(cc, cl, findChannelTarget(ch)), isGroupTotal: false })
      }
    }

    return { brandRows, chRows }
  }, [perfData, targets, brand, selBrand])

  // ── 퍼포먼스 테이블 클릭 핸들러 ────────────────────────────────
  const handleBrandClick = (brandcd: string) => {
    const next = selBrand === brandcd ? null : brandcd
    setSelBrand(next)
    // 품목/베스트만 re-fetch (해당 브랜드 또는 전체)
    const b = next === 'all' ? brand : (next ?? brand)
    const toDt = year === String(new Date().getFullYear()) ? lastSunday : `${year}1231`
    const fromDt = (() => { const d = new Date(); const dow = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - (dow === 0 ? 7 : dow)); const mon = new Date(sun); mon.setDate(sun.getDate() - 6); return `${mon.getFullYear()}${String(mon.getMonth()+1).padStart(2,'0')}${String(mon.getDate()).padStart(2,'0')}` })()
    // 차트 re-fetch
    fetch(`/api/sales/weekly?brand=${b}&toDt=${toDt}${channelParams(selFilter)}`).then(r => r.json()).then(j => { setWeeks(j.weeks ?? []); setWeekMeta(j.meta ?? null) }).catch(() => {})
    // 품목 re-fetch
    fetch(`/api/sales/items?brand=${b}`).then(r => r.json()).then(j => { if (j.items) setItemData(j.items) }).catch(() => {})
    // 베스트 re-fetch
    fetch(`/api/sales/products?brand=${b}&year=${year}&toDt=${toDt}&fromDt=${fromDt}${channelParams(selFilter)}`).then(r => r.json()).then(j => { setProducts(j.products ?? []) }).catch(() => {})
  }
  const salesRouter = useRouter()
  const handleChannelClick = (group: ChannelGroup, channel: string, isGroupTotal: boolean) => {
    if (isGroupTotal) {
      // 채널그룹 클릭 → 차트/베스트만 필터 (perf 테이블 유지)
      setSelFilter(prev => prev.type === 'group' && prev.group === group ? { type: 'total' } : { type: 'group', group })
    } else {
      // 개별 매장형태 클릭 → 상세 페이지 이동
      salesRouter.push(`/sales/channel/${encodeURIComponent(channel)}`)
    }
  }

  // ── 차트 x축 레이블 ────────────────────────────────────────────
  const MONTH_WEEK_TICKS = [1, 5, 9, 13, 18, 22, 26, 31, 35, 40, 44, 48]
  const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  const cyTotal  = weekMeta?.cyTotal ?? 0
  const lyTotal  = weekMeta?.lyTotal ?? 0
  const yoyDelta = lyTotal > 0 ? pct(cyTotal - lyTotal, lyTotal) : null

  return (
    <div className="flex flex-col gap-3 p-4 min-h-0">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">매출 실적 대시보드</h1>
          <p className="text-xs text-gray-400 mt-0.5">부가세 제외 · 단위: 백만원</p>
        </div>
        <button onClick={() => { fetchWeekly(selFilter); fetchProducts(selWeek, selFilter); fetchPerformance() }}
          disabled={wLoading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-subtle transition-colors">
          <RefreshCw size={12} className={wLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* ── 필터 ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400">브랜드</span>
        <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
          {visibleBrandTabs.map(b => (
            <button key={b.value} onClick={() => setBrand(b.value)}
              className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
                brand === b.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {b.value !== 'all' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-px"
                  style={{ background: BRAND_COLORS[b.value] }} />
              )}
              {b.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">연도</span>
        <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
          {YEAR_TABS.map(y => (
            <button key={y.value} onClick={() => setYear(y.value)}
              className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
                year === y.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {y.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">월</span>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-accent">
          <option value="">현재 월</option>
          {Array.from({ length: 12 }, (_, i) => {
            const m = `${year}${String(i + 1).padStart(2, '0')}`
            return <option key={m} value={m}>{i + 1}월</option>
          })}
        </select>
        {selBrand && (
          <button onClick={() => handleBrandClick(selBrand)}
            className="flex items-center gap-1 text-[10px] text-brand-accent border border-brand-accent/30 rounded-full px-2 py-0.5 hover:bg-brand-accent-light">
            {BRAND_NAMES[selBrand] ?? selBrand} <span className="text-[8px]">✕</span>
          </button>
        )}
        {selFilter.type !== 'total' && (
          <button onClick={() => setSelFilter({ type: 'total' })}
            className="flex items-center gap-1 text-[10px] text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-50">
            {selFilter.type === 'group' ? selFilter.group : (selFilter as { channel: string }).channel}
            <span className="text-[8px]">✕</span>
          </button>
        )}
        {selItemFilter && (
          <button onClick={() => setSelItemFilter(null)}
            className="flex items-center gap-1 text-[10px] text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-50">
            {selItemFilter} <span className="text-[8px]">✕</span>
          </button>
        )}
        {selProduct && (
          <button onClick={() => setSelProduct(null)}
            className="flex items-center gap-1 text-[10px] text-purple-600 border border-purple-200 rounded-full px-2 py-0.5 hover:bg-purple-50">
            {selProduct.name}
            <span className="text-[8px]">✕</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 break-all">{error}</div>
      )}

      {/* ── 주간 선 그래프 ── */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-xs font-semibold text-gray-700">
            주간 매출 추이 ({year}년)
            {selFilter.type !== 'total' && (
              <span className="ml-2 font-normal text-brand-accent">
                · {selFilter.type === 'group' ? selFilter.group : (selFilter as { channel: string }).channel}
              </span>
            )}
            {selProduct && (
              <span className="ml-2 font-normal text-purple-600">· {selProduct.name}</span>
            )}
          </h3>
          <div className="flex items-center gap-4 text-xs">
            {(() => {
              if (selWeek) {
                // 주간 클릭 시: 해당 주 데이터
                const w = weeks.find(wk => wk.weekNum === selWeek)
                const cwRev = w?.cy ?? 0; const lyRev = w?.ly ?? 0
                const delta = lyRev > 0 ? pct(cwRev - lyRev, lyRev) : null
                return (<>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-brand-accent" />W{selWeek} 금년 {fmt(cwRev)}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-300" />W{selWeek} 전년 {fmt(lyRev)}</span>
                  {delta != null && <span className={cn('font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>YoY {fmtPctS(delta)}</span>}
                </>)
              }
              // 기본: 금년 누적 기준 동기간 비교
              const maxW = Math.max(...weeks.filter(w => w.cy != null).map(w => w.weekNum), 0)
              const lyMatch = weeks.filter(w => w.weekNum <= maxW).reduce((s, w) => s + (w.ly ?? 0), 0)
              const delta = lyMatch > 0 ? pct(cyTotal - lyMatch, lyMatch) : null
              return (<>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-brand-accent" />금년 누적 {fmt(cyTotal)}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-300" />전년 동기 {fmt(lyMatch)}</span>
                {delta != null && <span className={cn('font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>YoY {fmtPctS(delta)}</span>}
              </>)
            })()}
            {selWeek && (
              <button onClick={() => setSelWeek(null)}
                className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-1.5 py-0.5">
                W{selWeek} 선택 해제
              </button>
            )}
          </div>
        </div>
        {wLoading ? (
          <div className="h-40 bg-surface-subtle animate-pulse rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={weeks}
              margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                if (state?.activePayload?.length) {
                  const w = state.activePayload[0].payload.weekNum as number
                  setSelWeek(prev => prev === w ? null : w)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
              <XAxis
                dataKey="weekNum" type="number" domain={[1, 52]}
                ticks={MONTH_WEEK_TICKS}
                tickFormatter={(w) => MONTH_LABELS[MONTH_WEEK_TICKS.indexOf(w)] ?? ''}
                tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<WeekTooltip />} />
              {selWeek != null && (
                <ReferenceLine x={selWeek} stroke="#e91e63" strokeDasharray="3 3" strokeWidth={1.5} />
              )}
              <Line type="monotone" dataKey="ly" name="전년" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="cy" name="금년" stroke="#e91e63" strokeWidth={2.5} connectNulls={false}
                dot={(props: any) => {
                  const { cx, cy: cyY, payload } = props
                  if (payload.cy == null) return <g key={props.key} />
                  if (payload.weekNum === selWeek) {
                    return <circle key={props.key} cx={cx} cy={cyY} r={6} fill="#e91e63" stroke="white" strokeWidth={2} />
                  }
                  return <circle key={props.key} cx={cx} cy={cyY} r={2.5} fill="#e91e63" />
                }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 브랜드 매출 현황 + 베스트 상품 ── */}
      <div className="flex gap-3" style={{ minHeight: 420 }}>

        {/* 브랜드 매출 현황 테이블 */}
        <div className="flex-1 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden min-w-0">
          <div className="px-4 py-2.5 border-b border-surface-border bg-surface-subtle flex items-center justify-between shrink-0">
            <h3 className="text-xs font-semibold text-gray-700">
              브랜드 매출 현황
              {perfData?.meta.monthLabel && (
                <span className="ml-2 font-normal text-gray-400">
                  {perfData.meta.monthLabel} · 전주 {perfData.meta.cwStart.slice(4,6)}/{perfData.meta.cwStart.slice(6)}~{perfData.meta.cwEnd.slice(4,6)}/{perfData.meta.cwEnd.slice(6)}
                </span>
              )}
            </h3>
          </div>

          {perfLoading ? (
            <div className="p-4 space-y-2 flex-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-7 bg-surface-subtle animate-pulse rounded" />
              ))}
            </div>
          ) : perfTableData ? (
            <div className="overflow-auto flex-1">
              {/* 브랜드별 요약 */}
              <table className="w-full text-[11px] border-collapse min-w-[1050px]">
                <thead className="sticky top-0 z-20">
                  {PERF_GROUP_HEADER}
                  <tr className="bg-gray-50 border-b border-surface-border text-gray-400 font-semibold uppercase tracking-wide">
                    <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-30 w-[120px]"></th>
                    {PERF_HEADER_COLS}
                  </tr>
                </thead>
                <tbody>
                  {perfTableData.brandRows.map((row) => (
                    <tr key={row.brandcd}
                      onClick={() => handleBrandClick(row.brandcd)}
                      className={cn('border-b border-surface-border cursor-pointer transition-colors',
                        row.bold ? 'bg-blue-50/40 font-semibold hover:bg-blue-100/40' : 'hover:bg-gray-50/50',
                        selBrand === row.brandcd && !row.bold && 'bg-brand-accent-light')}>
                      <td className={cn('px-3 py-2 sticky left-0 z-10',
                        row.bold ? 'bg-blue-50/40 font-bold text-gray-900' :
                        selBrand === row.brandcd ? 'bg-brand-accent-light font-semibold text-gray-900' :
                        'bg-white text-gray-700')}>
                        <span className="flex items-center gap-1.5">
                          {!row.bold && row.brandcd !== 'all' && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND_COLORS[row.brandcd] }} />
                          )}
                          {row.label}
                        </span>
                      </td>
                      <PerfCells m={row.m} />
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 유통채널별 매출 현황 */}
              <div className="px-3 py-2 bg-gray-100 border-t-2 border-gray-300">
                <h3 className="text-xs font-semibold text-gray-700">유통채널별 매출 현황</h3>
              </div>
              <table className="w-full text-[11px] border-collapse min-w-[1050px]">
                <thead className="sticky top-0 z-20">
                  {PERF_GROUP_HEADER}
                  <tr className="bg-gray-50 border-b border-surface-border text-gray-400 font-semibold uppercase tracking-wide">
                    <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-30 w-[120px]">매장형태</th>
                    {PERF_HEADER_COLS}
                  </tr>
                </thead>
                <tbody>
                  {perfTableData.chRows.map((row, i) => {
                    const grpColor = CHANNEL_GROUP_COLORS[row.group]
                    const isSelected = selFilter.type === 'group'
                      ? row.isGroupTotal && selFilter.group === row.group
                      : selFilter.type === 'channel'
                        ? !row.isGroupTotal && (selFilter as { channel: string }).channel === row.channel
                        : false
                    return (
                      <tr key={i}
                        onClick={() => handleChannelClick(row.group, row.channel, row.isGroupTotal)}
                        className={cn('border-b border-surface-border cursor-pointer transition-colors',
                          row.isGroupTotal ? 'bg-gray-50/60 font-semibold hover:bg-gray-100/60' : 'hover:bg-gray-50/50',
                          isSelected && 'bg-brand-accent-light')}>
                        <td className={cn('px-3 py-2 sticky left-0 z-10',
                          isSelected ? 'bg-brand-accent-light' :
                          row.isGroupTotal ? 'bg-gray-50/60' : 'bg-white')}>
                          {row.isGroupTotal ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: grpColor }} />
                              <span className="font-semibold text-gray-800">{row.group} 합계</span>
                            </span>
                          ) : (
                            <span className="text-gray-600 pl-4">{row.channel}</span>
                          )}
                        </td>
                        <PerfCells m={row.m} />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400 flex-1">데이터를 불러올 수 없습니다</div>
          )}
        </div>

        {/* 품목별 */}
        <div className="w-[300px] shrink-0 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-surface-border bg-surface-subtle shrink-0">
            <span className="text-xs font-semibold text-gray-700">품목별 실적</span>
          </div>
          <div className="overflow-y-auto flex-1">
            {perfLoading ? (
              <div className="p-2 space-y-2">{Array.from({length:8}).map((_,i)=><div key={i} className="h-6 bg-surface-subtle animate-pulse rounded"/>)}</div>
            ) : itemData.length > 0 ? (() => {
              const totalSale = itemData.reduce((s: number, i: any) => s + (i.cwRev || 0), 0)
              const sorted = [...itemData].filter((i: any) => i.cwRev > 0).sort((a: any, b: any) => b.cwRev - a.cwRev).slice(0, 20)
              return sorted.length > 0 ? (
                <table className="w-full text-[11px]">
                  <thead className="bg-surface-subtle sticky top-0">
                    <tr className="border-b border-surface-border text-gray-400 font-semibold">
                      {[{k:'item',l:'품목',a:'left'},{k:'cwRev',l:'매출',a:'right'},{k:'wow',l:'WoW',a:'right'},{k:'yoy',l:'YoY',a:'right'},{k:'share',l:'비중',a:'right'}].map(c=>(
                        <th key={c.k} className={cn('px-1 py-2 cursor-pointer hover:text-gray-900', c.a==='left'?'text-left px-2':'text-right', c.k==='share'&&'px-2')}
                          onClick={()=>toggleItemSort(c.k)}>
                          <span className="inline-flex items-center gap-0.5">{c.l}<ArrowUpDown size={8} className={cn(itemSortKey===c.k?'opacity-100 text-brand-accent':'opacity-20')}/></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].map(i=>({...i, share: totalSale>0?Math.round(i.cwRev/totalSale*1000)/10:0}))
                      .sort((a:any,b:any)=>{const va=a[itemSortKey]??0,vb=b[itemSortKey]??0;return typeof va==='string'?(itemSortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va)):(itemSortDir==='asc'?va-vb:vb-va)})
                      .map((item: any) => {
                      return (
                        <tr key={item.item}
                          onClick={() => {
                            const next = selItemFilter === item.item ? null : item.item
                            setSelItemFilter(next)
                            // 베스트 상품 re-fetch (품목 필터)
                            const toDt = year === String(new Date().getFullYear()) ? lastSunday : `${year}1231`
                            const fd = (() => { const d = new Date(); const dow = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - (dow === 0 ? 7 : dow)); const mon = new Date(sun); mon.setDate(sun.getDate() - 6); return `${mon.getFullYear()}${String(mon.getMonth()+1).padStart(2,'0')}${String(mon.getDate()).padStart(2,'0')}` })()
                            const b = selBrand ?? brand
                            const itemP = next ? `&item=${encodeURIComponent(next)}` : ''
                            fetch(`/api/sales/products?brand=${b}&year=${year}&toDt=${toDt}&fromDt=${fd}${channelParams(selFilter)}${itemP}`).then(r=>r.json()).then(j=>{setProducts(j.products??[])}).catch(()=>{})
                          }}
                          className={cn('border-b border-surface-border/50 cursor-pointer transition-colors',
                            selItemFilter === item.item ? 'bg-emerald-50' : 'hover:bg-surface-subtle')}>
                          <td className="px-2 py-2 text-gray-800 font-medium truncate max-w-[70px]">{item.item}</td>
                          <td className="px-1 py-2 text-right font-mono text-gray-700">{fmtM(item.cwRev)}</td>
                          <td className={cn('px-1 py-2 text-right font-mono', item.wow >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {item.pwRev > 0 ? `${item.wow >= 0 ? '+' : ''}${item.wow}%` : '—'}
                          </td>
                          <td className={cn('px-1 py-2 text-right font-mono', item.yoy >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {item.lyCwRev > 0 ? `${item.yoy >= 0 ? '+' : ''}${item.yoy}%` : '—'}
                          </td>
                          <td className="px-1 py-2 text-right text-gray-500">{item.share}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : <div className="py-8 text-center text-[10px] text-gray-400">데이터 없음</div>
            })() : null}
          </div>
        </div>

        {/* 베스트 상품 TOP 20 */}
        <div className="w-[340px] shrink-0 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border bg-surface-subtle flex items-center gap-2 shrink-0">
            <Package size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-700">베스트 상품 TOP 20</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-border bg-amber-50/50 flex-wrap shrink-0">
            {brand !== 'all' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold"
                style={{ background: BRAND_COLORS[brand] ?? '#999' }}>
                {BRAND_NAMES[brand] ?? brand}
              </span>
            )}
            {selWeek && (
              <span className="text-[10px] bg-brand-accent text-white px-2 py-0.5 rounded-full">W{selWeek}</span>
            )}
            {selFilter.type !== 'total' && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {selFilter.type === 'group' ? selFilter.group : (selFilter as { channel: string }).channel}
              </span>
            )}
            {selProduct && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {selProduct.name}
              </span>
            )}
            {brand === 'all' && selWeek == null && selFilter.type === 'total' && !selProduct && (
              <span className="text-[10px] text-gray-400">테이블/차트 클릭으로 필터</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {pLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-7 bg-surface-subtle animate-pulse rounded" />
                ))}
              </div>
            ) : products.length ? (
              <table className="w-full text-[10px]">
                <thead className="bg-surface-subtle sticky top-0">
                  <tr className="border-b border-surface-border text-gray-400">
                    <th className="text-left px-2 py-1.5 font-medium w-5">#</th>
                    <th className="text-left px-1.5 py-1.5 font-medium">상품명</th>
                    <th className="text-right px-1.5 py-1.5 font-medium">실적</th>
                    <th className="text-right px-1.5 py-1.5 font-medium">수량</th>
                    <th className="text-right px-1.5 py-1.5 font-medium">DC%</th>
                    <th className="text-right px-2 py-1.5 font-medium">WoW%</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const dc = p.tagTotal > 0 ? (1 - p.saleTotal / p.tagTotal) * 100 : 0
                    const wow = p.pwRev > 0 ? ((p.cwRev - p.pwRev) / p.pwRev) * 100 : (p.cwRev > 0 ? 100 : null)
                    return (
                      <tr key={p.code}
                        onClick={() => setSelProduct(prev => prev?.code === p.code ? null : { code: p.code, name: p.name || p.code })}
                        className={cn('border-b border-surface-border last:border-0 cursor-pointer transition-colors',
                          selProduct?.code === p.code ? 'bg-purple-50' : 'hover:bg-surface-subtle')}>
                        <td className="px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-1.5 py-1.5">
                          <div className="font-medium text-gray-800 truncate max-w-[100px]">{p.name || p.code}</div>
                          <span className="px-1 py-px rounded-full text-[8px] font-bold text-white"
                            style={{ background: BRAND_COLORS[p.brand] ?? '#999' }}>
                            {BRAND_NAMES[p.brand] ?? p.brand}
                          </span>
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-semibold text-gray-800">{fmtM(p.revenue)}</td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-gray-600">{p.qty.toLocaleString()}</td>
                        <td className="px-1.5 py-1.5 text-right text-gray-600">{dc.toFixed(1)}%</td>
                        <td className={cn('px-2 py-1.5 text-right font-mono',
                          wow == null ? 'text-gray-300' : wow >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {wow == null ? '—' : `${wow >= 0 ? '+' : ''}${Math.round(wow)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">데이터 없음</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
