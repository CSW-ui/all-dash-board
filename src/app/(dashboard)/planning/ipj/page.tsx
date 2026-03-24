'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { BRAND_COLORS, BRAND_TABS, ITEM_CATEGORIES, CATEGORY_COLORS } from '@/lib/constants'
import { fmtW, fmtM } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'

const SEASON_OPTIONS = [
  { label: '26 S/S', year: '26', season: '봄,여름,상반기,스탠다드' },
  { label: '26 봄', year: '26', season: '봄' },
  { label: '26 여름', year: '26', season: '여름' },
  { label: '25 F/W', year: '25', season: '가을,겨울,하반기,스탠다드' },
  { label: '25 S/S', year: '25', season: '봄,여름,상반기,스탠다드' },
]

interface IpjItem {
  item: string; category: string
  stCnt: number; stclCnt: number
  ordQty: number; ordTagAmt: number; ordCostAmt: number
  inQty: number; inAmt: number
  stCnt1st: number; stclCnt1st: number; ordQty1st: number; ordTag1st: number; ordCost1st: number
  stCntQR: number; stclCntQR: number; ordQtyQR: number; ordTagQR: number; ordCostQR: number
  saleQty: number; saleAmt: number; tagAmt: number; salePriceAmt: number; costAmt: number
  saleAmtOl: number; tagAmtOl: number; onlineRatio: number
  // 이월
  coSaleQty: number; coSaleAmt: number; coTagAmt: number; coCostAmt: number
  coStCnt: number; coStclCnt: number; coSaleAmtOl: number
  coDcRate: number; coCogsRate: number
  totalSaleAmt: number; totalTagAmt: number
  // 재고
  invStCnt: number; invStclCnt: number; totalInvQty: number; invTagAmt: number; invCostAmt: number
  shopInvQty: number; whAvail: number
  salesRate: number; dcRate: number; cogsRate: number
  firstCostRate: number; qrCostRate: number
}

// 억 단위 포맷
const fmtE = (v: number) => {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1)
  if (Math.abs(v) >= 1e7) return (v / 1e8).toFixed(2)
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + '만'
  return v.toLocaleString()
}

export default function IpjPage() {
  const { allowedBrands } = useAuth()
  const [brand, setBrand] = useState('all')
  const [selSeason, setSelSeason] = useState(SEASON_OPTIONS[0])
  const [selCategory, setSelCategory] = useState('전체')
  // 기간 필터 (기본: 시즌 시작~오늘)
  const todayStr = new Date().toISOString().slice(0, 10)
  const defaultFrom = `20${selSeason.year}-01-01`
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(todayStr)

  const [items, setItems] = useState<IpjItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleBrands = allowedBrands
    ? [...(allowedBrands.length > 1 ? [{ label: '전체', value: 'all' }] : []),
       ...BRAND_TABS.filter(b => b.value !== 'all' && allowedBrands.includes(b.value))]
    : BRAND_TABS

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const fromDt = fromDate.replace(/-/g, '')
      const toDt = toDate.replace(/-/g, '')
      const res = await fetch(`/api/planning/ipj?brand=${brand}&year=${selSeason.year}&season=${selSeason.season}&fromDt=${fromDt}&toDt=${toDt}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setItems(json.items)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [brand, selSeason, fromDate, toDate])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (selCategory === '전체') return items
    return items.filter(i => i.category === selCategory)
  }, [items, selCategory])

  // 합계 계산
  const totals = useMemo(() => {
    return filtered.reduce((a, i) => ({
      stCnt: a.stCnt + i.stCnt, stclCnt: a.stclCnt + i.stclCnt,
      ordQty: a.ordQty + i.ordQty, ordTagAmt: a.ordTagAmt + i.ordTagAmt, ordCostAmt: a.ordCostAmt + i.ordCostAmt,
      inQty: a.inQty + i.inQty, inAmt: a.inAmt + i.inAmt,
      stCnt1st: a.stCnt1st + i.stCnt1st, stclCnt1st: a.stclCnt1st + i.stclCnt1st,
      ordQty1st: a.ordQty1st + i.ordQty1st, ordTag1st: a.ordTag1st + i.ordTag1st, ordCost1st: a.ordCost1st + i.ordCost1st,
      stCntQR: a.stCntQR + i.stCntQR, stclCntQR: a.stclCntQR + i.stclCntQR,
      ordQtyQR: a.ordQtyQR + i.ordQtyQR, ordTagQR: a.ordTagQR + i.ordTagQR, ordCostQR: a.ordCostQR + i.ordCostQR,
      saleQty: a.saleQty + i.saleQty, saleAmt: a.saleAmt + i.saleAmt,
      tagAmt: a.tagAmt + i.tagAmt, salePriceAmt: a.salePriceAmt + i.salePriceAmt, costAmt: a.costAmt + i.costAmt,
      saleAmtOl: a.saleAmtOl + i.saleAmtOl, tagAmtOl: a.tagAmtOl + i.tagAmtOl,
      coSaleAmt: a.coSaleAmt + i.coSaleAmt, coTagAmt: a.coTagAmt + i.coTagAmt,
      coCostAmt: a.coCostAmt + i.coCostAmt, coSaleAmtOl: a.coSaleAmtOl + i.coSaleAmtOl,
      coStCnt: a.coStCnt + i.coStCnt, coStclCnt: a.coStclCnt + i.coStclCnt,
      totalSaleAmt: a.totalSaleAmt + i.totalSaleAmt,
      invStCnt: a.invStCnt + i.invStCnt, invStclCnt: a.invStclCnt + i.invStclCnt,
      totalInvQty: a.totalInvQty + i.totalInvQty, invTagAmt: a.invTagAmt + i.invTagAmt, invCostAmt: a.invCostAmt + i.invCostAmt,
      shopInvQty: a.shopInvQty + i.shopInvQty, whAvail: a.whAvail + i.whAvail,
    }), {
      stCnt: 0, stclCnt: 0, ordQty: 0, ordTagAmt: 0, ordCostAmt: 0, inQty: 0, inAmt: 0,
      stCnt1st: 0, stclCnt1st: 0, ordQty1st: 0, ordTag1st: 0, ordCost1st: 0,
      stCntQR: 0, stclCntQR: 0, ordQtyQR: 0, ordTagQR: 0, ordCostQR: 0,
      saleQty: 0, saleAmt: 0, tagAmt: 0, salePriceAmt: 0, costAmt: 0,
      saleAmtOl: 0, tagAmtOl: 0,
      coSaleAmt: 0, coTagAmt: 0, coCostAmt: 0, coSaleAmtOl: 0, coStCnt: 0, coStclCnt: 0, totalSaleAmt: 0,
      invStCnt: 0, invStclCnt: 0, totalInvQty: 0, invTagAmt: 0, invCostAmt: 0,
      shopInvQty: 0, whAvail: 0,
    })
  }, [filtered])

  // 카테고리별 그루핑
  const grouped = useMemo(() => {
    const map = new Map<string, IpjItem[]>()
    filtered.forEach(i => {
      const arr = map.get(i.category) || []
      arr.push(i)
      map.set(i.category, arr)
    })
    // 카테고리별 소계 계산
    const result: { category: string; items: IpjItem[]; sub: typeof totals }[] = []
    map.forEach((items, cat) => {
      const sub = items.reduce((a, i) => ({
        stCnt: a.stCnt + i.stCnt, stclCnt: a.stclCnt + i.stclCnt,
        ordQty: a.ordQty + i.ordQty, ordTagAmt: a.ordTagAmt + i.ordTagAmt, ordCostAmt: a.ordCostAmt + i.ordCostAmt,
        inQty: a.inQty + i.inQty, inAmt: a.inAmt + i.inAmt,
        stCnt1st: a.stCnt1st + i.stCnt1st, stclCnt1st: a.stclCnt1st + i.stclCnt1st,
        ordQty1st: a.ordQty1st + i.ordQty1st, ordTag1st: a.ordTag1st + i.ordTag1st, ordCost1st: a.ordCost1st + i.ordCost1st,
        stCntQR: a.stCntQR + i.stCntQR, stclCntQR: a.stclCntQR + i.stclCntQR,
        ordQtyQR: a.ordQtyQR + i.ordQtyQR, ordTagQR: a.ordTagQR + i.ordTagQR, ordCostQR: a.ordCostQR + i.ordCostQR,
        saleQty: a.saleQty + i.saleQty, saleAmt: a.saleAmt + i.saleAmt,
        tagAmt: a.tagAmt + i.tagAmt, salePriceAmt: a.salePriceAmt + i.salePriceAmt, costAmt: a.costAmt + i.costAmt,
        saleAmtOl: a.saleAmtOl + i.saleAmtOl, tagAmtOl: a.tagAmtOl + i.tagAmtOl,
        coSaleAmt: a.coSaleAmt + i.coSaleAmt, coTagAmt: a.coTagAmt + i.coTagAmt,
        coCostAmt: a.coCostAmt + i.coCostAmt, coSaleAmtOl: a.coSaleAmtOl + i.coSaleAmtOl,
        coStCnt: a.coStCnt + i.coStCnt, coStclCnt: a.coStclCnt + i.coStclCnt,
        totalSaleAmt: a.totalSaleAmt + i.totalSaleAmt,
        invStCnt: a.invStCnt + i.invStCnt, invStclCnt: a.invStclCnt + i.invStclCnt,
        totalInvQty: a.totalInvQty + i.totalInvQty, invTagAmt: a.invTagAmt + i.invTagAmt, invCostAmt: a.invCostAmt + i.invCostAmt,
        shopInvQty: a.shopInvQty + i.shopInvQty, whAvail: a.whAvail + i.whAvail,
      }), {
        stCnt: 0, stclCnt: 0, ordQty: 0, ordTagAmt: 0, ordCostAmt: 0, inQty: 0, inAmt: 0,
        stCnt1st: 0, stclCnt1st: 0, ordQty1st: 0, ordTag1st: 0, ordCost1st: 0,
        stCntQR: 0, stclCntQR: 0, ordQtyQR: 0, ordTagQR: 0, ordCostQR: 0,
        saleQty: 0, saleAmt: 0, tagAmt: 0, salePriceAmt: 0, costAmt: 0,
        saleAmtOl: 0, tagAmtOl: 0,
        coSaleAmt: 0, coTagAmt: 0, coCostAmt: 0, coSaleAmtOl: 0, coStCnt: 0, coStclCnt: 0, totalSaleAmt: 0,
        invStCnt: 0, invStclCnt: 0, totalInvQty: 0, invTagAmt: 0, invCostAmt: 0,
        shopInvQty: 0, whAvail: 0,
      })
      result.push({ category: cat, items, sub })
    })
    return result.sort((a, b) => b.sub.ordTagAmt - a.sub.ordTagAmt)
  }, [filtered])

  // 접기/펼치기 상태 (기본: 모두 접힌 상태)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleCat = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  const expandAll = () => setExpanded(new Set(grouped.map(g => g.category)))
  const collapseAll = () => setExpanded(new Set())

  const tSalesRate = totals.inQty > 0 ? Math.round(totals.saleQty / totals.inQty * 1000) / 10 : 0
  const tDcRate = totals.tagAmt > 0 ? Math.round((1 - totals.salePriceAmt / totals.tagAmt) * 1000) / 10 : 0
  const tCogsRate = totals.saleAmt > 0 ? Math.round(totals.costAmt / totals.saleAmt * 1000) / 10 : 0
  const tOnlineRatio = totals.saleAmt > 0 ? Math.round(totals.saleAmtOl / totals.saleAmt * 1000) / 10 : 0
  const tFirstCostRate = totals.ordTag1st > 0 ? Math.round(totals.ordCost1st / totals.ordTag1st * 1000) / 10 : 0
  const tQrCostRate = totals.ordTagQR > 0 ? Math.round(totals.ordCostQR / totals.ordTagQR * 1000) / 10 : 0
  const tCoDcRate = totals.coTagAmt > 0 ? Math.round((1 - (totals.coTagAmt - totals.coCostAmt) / totals.coTagAmt) * 1000) / 10 : 0
  const tCoCogsRate = totals.coSaleAmt > 0 ? Math.round(totals.coCostAmt / totals.coSaleAmt * 1000) / 10 : 0

  // 비중 계산 함수
  const pct = (v: number, total: number) => total > 0 ? (v / total * 100).toFixed(1) : '0.0'

  const downloadExcel = () => {
    const rows = filtered.map(r => ({
      '카테고리': r.category, '품목': r.item,
      '비중(%)': pct(r.ordTagAmt, totals.ordTagAmt),
      'ST수': r.stCnt, 'SKU수': r.stclCnt,
      '발주금액(TAG)': r.ordTagAmt, '발주원가': r.ordCostAmt,
      '입고수량': r.inQty, '입고금액': r.inAmt,
      '1차ST': r.stCnt1st, '1차SKU': r.stclCnt1st, '1차금액': r.ordTag1st,
      'QRST': r.stCntQR, 'QRSKU': r.stclCntQR, 'QR금액': r.ordTagQR,
      '매출(TAG)': r.tagAmt, '매출실적': r.saleAmt, '판매수량': r.saleQty,
      '온라인매출': r.saleAmtOl, '온라인비중(%)': r.onlineRatio,
      '총재고': r.totalInvQty, '재고ST': r.invStCnt, '재고SKU': r.invStclCnt,
      '재고금액(TAG)': r.invTagAmt, '재고원가': r.invCostAmt,
      '판매율(%)': r.salesRate, '할인율(%)': r.dcRate, '원가율(%)': r.cogsRate,
      '1차원가율(%)': r.firstCostRate, 'QR원가율(%)': r.qrCostRate,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '입판재현황')
    XLSX.writeFile(wb, `입판재현황_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 데이터 행 렌더링 함수
  const renderRow = (r: IpjItem, idx: number) => {
    return (
      <tr key={r.item} className={cn('border-b border-surface-border/50 transition-colors',
        idx % 2 === 0 ? 'bg-white hover:bg-surface-subtle' : 'bg-surface-subtle/30 hover:bg-surface-subtle')}>
        {/* 구분 */}
        <td className="py-1.5 px-1 sticky left-0 bg-inherit z-10" />
        <td className="py-1.5 px-1 pl-6 text-gray-700 whitespace-nowrap sticky left-[60px] bg-inherit z-10">{r.item}</td>
        {/* 입고소진: 비중, ST, SKU, 금액(TAG), 원가 */}
        <td className="py-1.5 px-1 text-right text-[10px] text-gray-500">{pct(r.ordTagAmt, totals.ordTagAmt)}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-700">{r.stCnt}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-500">{r.stclCnt}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-700">{fmtE(r.ordTagAmt)}</td>
        {/* 1차: ST, SKU, 금액 */}
        <td className="py-1.5 px-1 text-right font-mono text-gray-600">{r.stCnt1st}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-500">{r.stclCnt1st}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-600">{fmtE(r.ordTag1st)}</td>
        {/* QR: ST, SKU, 금액 */}
        <td className="py-1.5 px-1 text-right font-mono text-orange-600">{r.stCntQR}</td>
        <td className="py-1.5 px-1 text-right font-mono text-orange-500">{r.stclCntQR}</td>
        <td className="py-1.5 px-1 text-right font-mono text-orange-600">{fmtE(r.ordTagQR)}</td>
        {/* 매장매출: Total, 온라인, 비중 */}
        <td className="py-1.5 px-1 text-right font-mono font-semibold text-blue-700">{fmtE(r.tagAmt)}</td>
        <td className="py-1.5 px-1 text-right font-mono text-blue-600">{fmtE(r.saleAmt)}</td>
        <td className="py-1.5 px-1 text-right font-mono text-blue-500">{r.saleQty.toLocaleString()}</td>
        <td className="py-1.5 px-1 text-right font-mono text-purple-600">{fmtE(r.saleAmtOl)}</td>
        <td className="py-1.5 px-1 text-right text-purple-500 text-[10px]">{r.onlineRatio}%</td>
        {/* 이월 매출 */}
        <td className="py-1.5 px-1 text-right font-mono text-amber-600">{r.coStCnt || '—'}</td>
        <td className="py-1.5 px-1 text-right font-mono text-amber-700 font-semibold">{r.coSaleAmt ? fmtE(r.coSaleAmt) : '—'}</td>
        <td className="py-1.5 px-1 text-right text-amber-600 text-[10px]">{r.coSaleAmt ? `${r.coDcRate}%` : '—'}</td>
        <td className="py-1.5 px-1 text-right text-amber-600 text-[10px]">{r.coSaleAmt ? `${r.coCogsRate}%` : '—'}</td>
        {/* 재고: Total(ST, SKU, 수량, TAG, 원가) */}
        <td className="py-1.5 px-1 text-right font-mono text-gray-600">{r.invStCnt}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-500">{r.invStclCnt}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-700">{r.totalInvQty.toLocaleString()}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-700">{fmtE(r.invTagAmt)}</td>
        <td className="py-1.5 px-1 text-right font-mono text-gray-500">{fmtE(r.invCostAmt)}</td>
        {/* 판매율(%) */}
        <td className="py-1.5 px-1 text-right">
          <span className={cn('px-1 py-px rounded-full text-[10px] font-semibold',
            r.salesRate >= 70 ? 'bg-green-100 text-green-700' : r.salesRate >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
            {r.salesRate}%
          </span>
        </td>
        <td className="py-1.5 px-1 text-right text-[10px] text-gray-600">{r.dcRate}%</td>
        {/* 원가율(%) */}
        <td className="py-1.5 px-1 text-right text-[10px] text-gray-700">{r.cogsRate}%</td>
        <td className="py-1.5 px-1 text-right text-[10px] text-gray-600">{r.firstCostRate}%</td>
        <td className="py-1.5 px-1 text-right text-[10px] text-orange-600">{r.qrCostRate}%</td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">입판재현황</h1>
          <p className="text-xs text-gray-400 mt-0.5">입고·판매·재고 종합 현황 (품목별 · 차수별)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll}
            className="text-[10px] text-gray-400 hover:text-gray-600 border border-surface-border rounded-lg px-2 py-1.5 hover:bg-surface-subtle">전체 펼치기</button>
          <button onClick={collapseAll}
            className="text-[10px] text-gray-400 hover:text-gray-600 border border-surface-border rounded-lg px-2 py-1.5 hover:bg-surface-subtle">전체 접기</button>
          <button onClick={downloadExcel}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-subtle transition-colors">
            <Download size={12} /> Excel
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-subtle transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
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
          onChange={e => setSelSeason(SEASON_OPTIONS[Number(e.target.value)])}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {SEASON_OPTIONS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>

        <span className="text-xs text-gray-400 ml-2">기간</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
        <span className="text-xs text-gray-300">~</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />

        <span className="text-xs text-gray-400 ml-2">품목</span>
        <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
          {ITEM_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelCategory(cat)}
              className={cn('px-2 py-1 text-[11px] font-medium rounded-md transition-colors',
                selCategory === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-3">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse" style={{ minWidth: 1600 }}>
              <thead>
                {/* 1단 헤더: 대분류 */}
                <tr className="bg-gray-800">
                  <th colSpan={2} className="text-center text-[11px] text-gray-200 font-bold py-1.5 sticky left-0 bg-gray-800 z-20">구분</th>
                  <th colSpan={4} className="text-center text-[11px] text-gray-200 font-bold py-1.5 border-l border-gray-600">입고소진</th>
                  <th colSpan={3} className="text-center text-[11px] text-yellow-300 font-bold py-1.5 border-l border-gray-600">1차</th>
                  <th colSpan={3} className="text-center text-[11px] text-orange-300 font-bold py-1.5 border-l border-gray-600">QR</th>
                  <th colSpan={5} className="text-center text-[11px] text-blue-300 font-bold py-1.5 border-l border-gray-600">당시즌 매출</th>
                  <th colSpan={4} className="text-center text-[11px] text-amber-300 font-bold py-1.5 border-l border-gray-600">이월 매출</th>
                  <th colSpan={5} className="text-center text-[11px] text-cyan-300 font-bold py-1.5 border-l border-gray-600">재고</th>
                  <th colSpan={2} className="text-center text-[11px] text-green-300 font-bold py-1.5 border-l border-gray-600">판매율(%)</th>
                  <th colSpan={3} className="text-center text-[11px] text-red-300 font-bold py-1.5 border-l border-gray-600">원가율(%)</th>
                </tr>
                {/* 2단 헤더: 세부 컬럼 */}
                <tr className="border-b border-surface-border bg-gray-50">
                  <th className="py-1.5 px-1 text-left text-[10px] text-gray-500 sticky left-0 bg-gray-50 z-20">카테고리</th>
                  <th className="py-1.5 px-1 text-left text-[10px] text-gray-500 sticky left-[60px] bg-gray-50 z-20">품목</th>
                  {/* 입고소진 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">비중%</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">ST수</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">SKU수</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">금액</th>
                  {/* 1차 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">ST</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">SKU</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">금액</th>
                  {/* QR */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-orange-400">ST</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-orange-400">SKU</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-orange-400">금액</th>
                  {/* 매장매출 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">TAG</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">매출</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">수량</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-purple-400">온라인</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-purple-400">비중%</th>
                  {/* 이월 매출 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-amber-500">ST</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-amber-500">매출</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-amber-500">DC%</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-amber-500">원가율</th>
                  {/* 재고 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">ST</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">SKU</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">수량</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">TAG</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">원가</th>
                  {/* 판매율 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">판매율</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">DC%</th>
                  {/* 원가율 */}
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">전체</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-gray-500">1차</th>
                  <th className="py-1.5 px-1 text-right text-[10px] text-orange-400">QR</th>
                </tr>
              </thead>
              <tbody>
                {/* TOTAL 행 */}
                <tr className="bg-gray-50 font-semibold border-b-2 border-gray-300">
                  <td className="py-2 px-1 sticky left-0 bg-gray-50 z-10" />
                  <td className="py-2 px-1 text-gray-900 sticky left-[60px] bg-gray-50 z-10">TOTAL</td>
                  <td className="py-2 px-1 text-right text-gray-500">100.0</td>
                  <td className="py-2 px-1 text-right">{totals.stCnt}</td>
                  <td className="py-2 px-1 text-right">{totals.stclCnt}</td>
                  <td className="py-2 px-1 text-right">{fmtE(totals.ordTagAmt)}</td>
                  <td className="py-2 px-1 text-right">{totals.stCnt1st}</td>
                  <td className="py-2 px-1 text-right">{totals.stclCnt1st}</td>
                  <td className="py-2 px-1 text-right">{fmtE(totals.ordTag1st)}</td>
                  <td className="py-2 px-1 text-right text-orange-600">{totals.stCntQR}</td>
                  <td className="py-2 px-1 text-right text-orange-600">{totals.stclCntQR}</td>
                  <td className="py-2 px-1 text-right text-orange-600">{fmtE(totals.ordTagQR)}</td>
                  <td className="py-2 px-1 text-right text-blue-700">{fmtE(totals.tagAmt)}</td>
                  <td className="py-2 px-1 text-right text-blue-700">{fmtE(totals.saleAmt)}</td>
                  <td className="py-2 px-1 text-right">{totals.saleQty.toLocaleString()}</td>
                  <td className="py-2 px-1 text-right text-purple-600">{fmtE(totals.saleAmtOl)}</td>
                  <td className="py-2 px-1 text-right text-purple-500">{tOnlineRatio}%</td>
                  <td className="py-2 px-1 text-right text-amber-600">{totals.coStCnt}</td>
                  <td className="py-2 px-1 text-right text-amber-700">{fmtE(totals.coSaleAmt)}</td>
                  <td className="py-2 px-1 text-right text-amber-600">{tCoDcRate}%</td>
                  <td className="py-2 px-1 text-right text-amber-600">{tCoCogsRate}%</td>
                  <td className="py-2 px-1 text-right">{totals.invStCnt}</td>
                  <td className="py-2 px-1 text-right">{totals.invStclCnt}</td>
                  <td className="py-2 px-1 text-right">{totals.totalInvQty.toLocaleString()}</td>
                  <td className="py-2 px-1 text-right">{fmtE(totals.invTagAmt)}</td>
                  <td className="py-2 px-1 text-right">{fmtE(totals.invCostAmt)}</td>
                  <td className="py-2 px-1 text-right"><span className="px-1 py-px rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">{tSalesRate}%</span></td>
                  <td className="py-2 px-1 text-right">{tDcRate}%</td>
                  <td className="py-2 px-1 text-right">{tCogsRate}%</td>
                  <td className="py-2 px-1 text-right">{tFirstCostRate}%</td>
                  <td className="py-2 px-1 text-right text-orange-600">{tQrCostRate}%</td>
                </tr>
                {/* 카테고리별 그룹 행 */}
                {grouped.map(g => {
                  const isOpen = expanded.has(g.category)
                  const catColor = CATEGORY_COLORS[g.category]
                  const s = g.sub
                  const sSalesRate = s.inQty > 0 ? Math.round(s.saleQty / s.inQty * 1000) / 10 : 0
                  const sDcRate = s.tagAmt > 0 ? Math.round((1 - s.salePriceAmt / s.tagAmt) * 1000) / 10 : 0
                  const sCogsRate = s.saleAmt > 0 ? Math.round(s.costAmt / s.saleAmt * 1000) / 10 : 0
                  const sOnlineRatio = s.saleAmt > 0 ? Math.round(s.saleAmtOl / s.saleAmt * 1000) / 10 : 0
                  const sFirstCostRate = s.ordTag1st > 0 ? Math.round(s.ordCost1st / s.ordTag1st * 1000) / 10 : 0
                  const sQrCostRate = s.ordTagQR > 0 ? Math.round(s.ordCostQR / s.ordTagQR * 1000) / 10 : 0
                  const sCoCogsRate = s.coSaleAmt > 0 ? Math.round(s.coCostAmt / s.coSaleAmt * 1000) / 10 : 0
                  const sCoDcRate = s.coTagAmt > 0 ? Math.round((1 - (s.coTagAmt - s.coCostAmt) / s.coTagAmt) * 1000) / 10 : 0
                  return (
                    <Fragment key={g.category}>
                      {/* 카테고리 소계 행 (클릭하면 펼침/접힘) */}
                      <tr onClick={() => toggleCat(g.category)}
                        className="bg-gray-100 border-b border-gray-300 cursor-pointer hover:bg-gray-200 font-semibold transition-colors">
                        <td className="py-2 px-1 sticky left-0 bg-gray-100 z-10">
                          {isOpen ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                        </td>
                        <td className="py-2 px-1 sticky left-[60px] bg-gray-100 z-10 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold mr-1" style={{ background: catColor?.bg, color: catColor?.text }}>{g.category}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{g.items.length}개 품목</span>
                        </td>
                        <td className="py-2 px-1 text-right text-[10px] text-gray-500">{pct(s.ordTagAmt, totals.ordTagAmt)}</td>
                        <td className="py-2 px-1 text-right">{s.stCnt}</td>
                        <td className="py-2 px-1 text-right">{s.stclCnt}</td>
                        <td className="py-2 px-1 text-right">{fmtE(s.ordTagAmt)}</td>
                        <td className="py-2 px-1 text-right">{s.stCnt1st}</td>
                        <td className="py-2 px-1 text-right">{s.stclCnt1st}</td>
                        <td className="py-2 px-1 text-right">{fmtE(s.ordTag1st)}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{s.stCntQR}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{s.stclCntQR}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{fmtE(s.ordTagQR)}</td>
                        <td className="py-2 px-1 text-right text-blue-700">{fmtE(s.tagAmt)}</td>
                        <td className="py-2 px-1 text-right text-blue-700">{fmtE(s.saleAmt)}</td>
                        <td className="py-2 px-1 text-right">{s.saleQty.toLocaleString()}</td>
                        <td className="py-2 px-1 text-right text-purple-600">{fmtE(s.saleAmtOl)}</td>
                        <td className="py-2 px-1 text-right text-purple-500">{sOnlineRatio}%</td>
                        <td className="py-2 px-1 text-right text-amber-600">{s.coStCnt}</td>
                        <td className="py-2 px-1 text-right text-amber-700">{fmtE(s.coSaleAmt)}</td>
                        <td className="py-2 px-1 text-right text-amber-600">{sCoDcRate}%</td>
                        <td className="py-2 px-1 text-right text-amber-600">{sCoCogsRate}%</td>
                        <td className="py-2 px-1 text-right">{s.invStCnt}</td>
                        <td className="py-2 px-1 text-right">{s.invStclCnt}</td>
                        <td className="py-2 px-1 text-right">{s.totalInvQty.toLocaleString()}</td>
                        <td className="py-2 px-1 text-right">{fmtE(s.invTagAmt)}</td>
                        <td className="py-2 px-1 text-right">{fmtE(s.invCostAmt)}</td>
                        <td className="py-2 px-1 text-right"><span className="px-1 py-px rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">{sSalesRate}%</span></td>
                        <td className="py-2 px-1 text-right">{sDcRate}%</td>
                        <td className="py-2 px-1 text-right">{sCogsRate}%</td>
                        <td className="py-2 px-1 text-right">{sFirstCostRate}%</td>
                        <td className="py-2 px-1 text-right text-orange-600">{sQrCostRate}%</td>
                      </tr>
                      {/* 펼쳤을 때 하위 품목 행 */}
                      {isOpen && g.items.map((r, i) => renderRow(r, i))}
                    </Fragment>
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
