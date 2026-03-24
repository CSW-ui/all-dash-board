'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Search, Clock, CheckCircle2, Factory, Package, Loader2,
  X, ChevronRight, AlertTriangle, Send, Truck, BarChart3,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ───── 타입 ─────
type OrderStatus = 'sent' | 'responded' | 'confirmed' | 'in_production' | 'completed'

interface SrmOrder {
  id: string
  stylecd: string
  chasu: string
  colorcd: string
  colornm: string
  brandcd: string
  stylenm: string
  season: string
  pono: string
  erp_status: string
  country: string
  po_qty: number
  confirmed_due: string | null
  order_date: string | null
  vendor: string
  status: OrderStatus
  expected_cost: number | null
  expected_qty: number
  expected_rate: number
  remaining_qty: number
  md_comment?: string | null
  remark?: string
  // 원단
  fabric_vendor?: string; fabric_spec?: string
  bt_confirm?: string; bulk_confirm?: string
  ksk_result?: string; gb_result?: string
  // 사양
  artwork_confirm?: string
  qc1_receive?: string; qc1_confirm?: string
  qc2_receive?: string; qc2_confirm?: string
  qc3_receive?: string; qc3_confirm?: string
  app_confirm?: string
  pp1_receive?: string; pp1_confirm?: string
  pp2_receive?: string; pp2_confirm?: string
  pp_confirm?: string; matching_chart?: string; yardage_confirm?: string
  // 생산
  fabric_order?: string; fabric_ship?: string; fabric_inbound?: string
  cutting_start?: string; sewing_start?: string; sewing_complete?: string
  finish_date?: string; shipping_date?: string
  // 입고
  inbound_1_date?: string; inbound_1_qty?: number
  inbound_2_date?: string; inbound_2_qty?: number
  inbound_3_date?: string; inbound_3_qty?: number
  inbound_4_date?: string; inbound_4_qty?: number
  inbound_5_date?: string; inbound_5_qty?: number
  // 원가
  confirmed_cost?: number; confirmed_price?: number
  material_mix?: string; wash_code?: string
  // 응답
  proposed_due?: string; proposed_cost?: number; vendor_comment?: string
}

// ───── 상수 ─────
const TABS = [
  { key: 'response', label: '납기/원가 응답', icon: Send, badge: 'needResponse' as const },
  { key: 'production', label: '생산 진행', icon: Factory, badge: 'production' as const },
  { key: 'inbound', label: '입고 현황', icon: Truck, badge: 'inbound' as const },
  { key: 'all', label: '전체 현황', icon: BarChart3, badge: 'all' as const },
] as const

type TabKey = typeof TABS[number]['key']

const PRODUCTION_STAGES = [
  { key: 'fabric_order', label: '원단발주', short: '원발' },
  { key: 'fabric_ship', label: '원단출고', short: '원출' },
  { key: 'fabric_inbound', label: '원단입고', short: '원입' },
  { key: 'cutting_start', label: '재단', short: '재단' },
  { key: 'sewing_start', label: '봉제', short: '봉제' },
  { key: 'sewing_complete', label: '봉제완료', short: '봉완' },
  { key: 'finish_date', label: '완성', short: '완성' },
  { key: 'shipping_date', label: '선적', short: '선적' },
] as const

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: '발주확정', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  in_production: { label: '생산중', color: 'text-purple-700', bg: 'bg-purple-50' },
  completed: { label: '완료', color: 'text-green-700', bg: 'bg-green-50' },
  sent: { label: '응답대기', color: 'text-amber-700', bg: 'bg-amber-50' },
  responded: { label: 'MD검토', color: 'text-blue-700', bg: 'bg-blue-50' },
}

const fmtNum = (n: number | null | undefined) => n != null ? n.toLocaleString('ko-KR') : '—'
const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10) : ''

// ───── 생산 단계 계산 ─────
function getStageInfo(order: SrmOrder) {
  let completed = 0
  for (const stage of PRODUCTION_STAGES) {
    if ((order as Record<string, unknown>)[stage.key]) completed++
    else break
  }
  return { completed, total: PRODUCTION_STAGES.length, label: completed === 0 ? '대기' : completed >= PRODUCTION_STAGES.length ? '완료' : PRODUCTION_STAGES[completed - 1].label }
}

// ───── 상태 뱃지 ─────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status]
  if (!cfg) return null
  return <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
}

// ───── 입고율 바 ─────
function RateBar({ rate }: { rate: number }) {
  const capped = Math.min(rate, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', rate >= 100 ? 'bg-green-500' : rate > 0 ? 'bg-blue-500' : 'bg-gray-200')}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={cn('text-[10px] font-medium w-8 text-right', rate >= 100 ? 'text-green-600' : rate > 0 ? 'text-blue-600' : 'text-gray-400')}>
        {rate}%
      </span>
    </div>
  )
}

// ───── 생산 스테퍼 미니 ─────
function StageMini({ order }: { order: SrmOrder }) {
  const { completed } = getStageInfo(order)
  return (
    <div className="flex items-center gap-0.5">
      {PRODUCTION_STAGES.map((s, i) => (
        <div
          key={s.key}
          className={cn('w-2 h-2 rounded-full', i < completed ? 'bg-purple-500' : 'bg-gray-200')}
          title={s.label}
        />
      ))}
    </div>
  )
}

// ───── KPI 카드 ─────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 min-w-[160px]">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-[10px] text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 사이드 패널: 발주 상세
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DetailPanel({ order, onClose, onSave }: {
  order: SrmOrder; onClose: () => void
  onSave: (id: string, field: string, value: string | number) => void
}) {
  const { completed } = getStageInfo(order)
  const isReadOnly = order.status === 'completed'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-900">{order.stylecd}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100">{order.brandcd}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{order.stylenm}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: '시즌', v: order.season },
              { l: '발주유형', v: order.pono },
              { l: '컬러', v: `${order.colorcd} ${order.colornm}` },
              { l: '발주수량', v: fmtNum(order.po_qty) + 'pcs' },
              { l: '생산국', v: order.country || '—' },
              { l: '희망납기', v: fmtDate(order.confirmed_due) || '—' },
              { l: '발주일', v: fmtDate(order.order_date) || '—' },
              { l: '사전원가', v: order.expected_cost ? fmtNum(order.expected_cost) + '원' : '—' },
              { l: '입고율', v: `${order.expected_rate || 0}%` },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-[10px] text-gray-400">{l}</p>
                <p className="text-xs font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>

          {/* 생산 진행 스테퍼 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">생산 진행</p>
            <div className="space-y-1.5">
              {PRODUCTION_STAGES.map((stage, i) => {
                const val = (order as Record<string, unknown>)[stage.key] as string | undefined
                const isDone = i < completed
                const isCurrent = i === completed
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      isDone ? 'bg-purple-500 text-white' : isCurrent ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-300' : 'bg-gray-100 text-gray-400'
                    )}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={cn('text-xs flex-1', isDone ? 'text-purple-700 font-medium' : 'text-gray-500')}>{stage.label}</span>
                    {!isReadOnly ? (
                      <input
                        type="date"
                        defaultValue={val || ''}
                        onBlur={e => {
                          if (e.target.value !== (val || '')) onSave(order.id, stage.key, e.target.value)
                        }}
                        className="text-[11px] border border-gray-200 rounded px-2 py-1 w-[130px] focus:outline-none focus:border-brand-accent"
                      />
                    ) : (
                      <span className="text-[11px] text-gray-500 w-[130px] text-right">{fmtDate(val) || '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 입고 현황 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">입고 현황</p>
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5].map(n => {
                const dateKey = `inbound_${n}_date` as keyof SrmOrder
                const qtyKey = `inbound_${n}_qty` as keyof SrmOrder
                const dateVal = order[dateKey] as string | undefined
                const qtyVal = order[qtyKey] as number | undefined
                if (!dateVal && !qtyVal && n > 1) return null
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-12">{n}차</span>
                    <span className="text-xs text-gray-700 flex-1">{fmtDate(dateVal) || '—'}</span>
                    <span className="text-xs font-medium text-gray-900 w-20 text-right">{fmtNum(qtyVal)}</span>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                <span className="text-[10px] text-gray-400 w-12">잔여</span>
                <span className="text-xs font-bold text-gray-900 flex-1">{fmtNum(order.remaining_qty)}pcs</span>
                <RateBar rate={order.expected_rate || 0} />
              </div>
            </div>
          </div>

          {/* 원가 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">원가 정보</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: '사전원가', v: order.expected_cost, k: 'expected_cost' },
                { l: '확정원가', v: order.confirmed_cost, k: 'confirmed_cost' },
                { l: '확정가격', v: order.confirmed_price, k: 'confirmed_price' },
              ].map(({ l, v, k }) => (
                <div key={k}>
                  <p className="text-[10px] text-gray-400">{l}</p>
                  <p className="text-xs font-medium text-gray-900">{v ? fmtNum(v) + '원' : '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 원단/사양 요약 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">원단/사양</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { l: '원단업체', v: order.fabric_vendor },
                { l: '원단사양', v: order.fabric_spec },
                { l: 'BT컨펌', v: fmtDate(order.bt_confirm) },
                { l: 'BULK컨펌', v: fmtDate(order.bulk_confirm) },
                { l: '혼용율', v: order.material_mix },
                { l: '세탁기호', v: order.wash_code },
              ].map(({ l, v }) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-16">{l}</span>
                  <span className="text-gray-700">{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 페이지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function VendorPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<SrmOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('response')
  const [search, setSearch] = useState('')
  const [fSeason, setFSeason] = useState('')
  const [fYear, setFYear] = useState('2026')
  const [fBrand, setFBrand] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<SrmOrder | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 일괄 응답 입력값
  const [bulkDue, setBulkDue] = useState('')
  const [bulkCost, setBulkCost] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // 개별 인라인 응답 입력값: { [orderId]: { due, cost } }
  const [inlineInputs, setInlineInputs] = useState<Record<string, { due: string; cost: string }>>({})
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set())
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  // 필터 옵션 (API에서 전체 기준으로 내려옴)
  const [uniqueSets, setUniqueSets] = useState<{ seasons: string[]; brands: string[] }>({ seasons: [], brands: [] })

  // ── 데이터 로드 ──
  const fetchOrders = useCallback(async () => {
    if (!profile?.vendor_name) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('year', fYear)
      if (fSeason) params.set('season', fSeason)
      if (search) params.set('search', search)
      const res = await fetch(`/api/vendor/orders?${params.toString()}`)
      const json = await res.json()
      if (res.ok) {
        setOrders(json.orders ?? [])
        if (json.uniqueSets) setUniqueSets(json.uniqueSets)
      }
    } catch { /* 무시 */ }
    finally { setLoading(false) }
  }, [profile?.vendor_name, fYear, fSeason, search])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── 필드 저장 ──
  const saveField = async (id: string, field: string, value: string | number) => {
    const order = orders.find(o => o.id === id)
    try {
      await fetch('/api/vendor/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          stylecd: order?.stylecd,
          chasu: order?.chasu,
          colorcd: order?.colorcd,
          brandcd: order?.brandcd,
          stylenm: order?.stylenm,
          season: order?.season,
          po_qty: order?.po_qty,
          action: 'update',
          fields: { [field]: value || null },
        }),
      })
    } catch { /* 무시 */ }
  }

  // ── 인라인 입력값 변경 ──
  const setInlineValue = (id: string, field: 'due' | 'cost', value: string) => {
    setInlineInputs(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  // ── 개별 제출 ──
  const handleSingleSubmit = async (order: SrmOrder) => {
    const input = inlineInputs[order.id]
    if (!input?.due) return
    setSubmittingIds(prev => new Set(prev).add(order.id))
    try {
      const res = await fetch('/api/vendor/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          stylecd: order.stylecd,
          chasu: order.chasu,
          colorcd: order.colorcd,
          brandcd: order.brandcd,
          stylenm: order.stylenm,
          season: order.season,
          po_qty: order.po_qty,
          action: 'respond',
          vendor_response: {
            proposed_due: input.due,
            proposed_cost: input.cost ? Number(input.cost) : null,
            comment: '',
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error('제출 실패:', json)
        alert(`제출 실패: ${json.error || '알 수 없는 오류'}`)
        return
      }
      setSubmittedIds(prev => new Set(prev).add(order.id))
      setTimeout(() => {
        setSubmittedIds(prev => { const next = new Set(prev); next.delete(order.id); return next })
        fetchOrders()
      }, 1500)
    } catch (err) {
      console.error('네트워크 오류:', err)
      alert('네트워크 오류가 발생했습니다.')
    }
    finally { setSubmittingIds(prev => { const next = new Set(prev); next.delete(order.id); return next }) }
  }

  // ── 일괄 납기/원가 제출 ──
  const handleBulkSubmit = async () => {
    if (selectedIds.size === 0 || !bulkDue) return
    setBulkSubmitting(true)
    try {
      const promises = Array.from(selectedIds).map(id => {
        const order = orders.find(o => o.id === id)
        return fetch('/api/vendor/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            stylecd: order?.stylecd,
            chasu: order?.chasu,
            colorcd: order?.colorcd,
            brandcd: order?.brandcd,
            stylenm: order?.stylenm,
            season: order?.season,
            po_qty: order?.po_qty,
            action: 'respond',
            vendor_response: {
              proposed_due: bulkDue,
              proposed_cost: bulkCost ? Number(bulkCost) : null,
              comment: '',
            },
          }),
        })
      })
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkDue('')
      setBulkCost('')
      fetchOrders()
    } catch { /* 무시 */ }
    finally { setBulkSubmitting(false) }
  }

  // ── 파생 데이터 ──
  const seasons = uniqueSets.seasons
  const brands = uniqueSets.brands

  const filtered = orders.filter(o => {
    if (fBrand && o.brandcd !== fBrand) return false
    return true
  })

  // 탭별 아이템
  const responseItems = filtered.filter(o => o.status === 'confirmed' || o.status === 'sent' || o.status === 'responded')
  const productionItems = filtered.filter(o => o.status === 'confirmed' || o.status === 'in_production')
  const inboundItems = filtered.filter(o => o.status === 'in_production' || o.status === 'completed')

  const badgeCounts = {
    needResponse: responseItems.length,
    production: productionItems.length,
    inbound: inboundItems.length,
    all: filtered.length,
  }

  // KPI
  const delayedCount = filtered.filter(o => {
    if (!o.confirmed_due || o.status === 'completed') return false
    return new Date() > new Date(o.confirmed_due)
  }).length
  const avgRate = filtered.length > 0
    ? Math.round(filtered.reduce((s, o) => s + (o.expected_rate || 0), 0) / filtered.length)
    : 0

  const tabItems = activeTab === 'response' ? responseItems
    : activeTab === 'production' ? productionItems
    : activeTab === 'inbound' ? inboundItems
    : filtered

  // 체크박스 토글
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    const respondableItems = responseItems.filter(o => o.status === 'confirmed' || o.status === 'sent')
    if (selectedIds.size === respondableItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(respondableItems.map(o => o.id)))
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">내 발주 현황</h1>
        <p className="text-xs text-gray-500 mt-0.5">발주 상태 확인 · 납기/원가 응답 · 생산 진행 업데이트</p>
      </div>

      {/* KPI */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <KpiCard label="전체 발주" value={filtered.length} sub={`${fmtNum(filtered.reduce((s, o) => s + o.po_qty, 0))}pcs`} icon={Package} color="bg-gray-700" />
        <KpiCard label="납기 응답 필요" value={responseItems.filter(o => o.status === 'confirmed').length} icon={Clock} color="bg-amber-500" />
        <KpiCard label="생산 진행중" value={productionItems.filter(o => o.status === 'in_production').length} icon={Factory} color="bg-purple-500" />
        <KpiCard label="평균 입고율" value={`${avgRate}%`} icon={Truck} color="bg-blue-500" />
        {delayedCount > 0 && (
          <KpiCard label="납기 지연" value={delayedCount} icon={AlertTriangle} color="bg-red-500" />
        )}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="품번/품명 검색..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-accent"
          />
        </div>
        <select value={fYear} onChange={e => setFYear(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <select value={fSeason} onChange={e => setFSeason(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">전체 시즌</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fBrand} onChange={e => setFBrand(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">전체 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = badgeCounts[tab.badge]
          return (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()) }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap',
                activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full',
                  activeTab === tab.key ? 'bg-brand-accent text-white' : 'bg-gray-200 text-gray-600'
                )}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && tabItems.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">해당 조건의 발주 내역이 없습니다.</p>
        </div>
      )}

      {/* ═══ 탭 1: 납기/원가 응답 ═══ */}
      {!loading && activeTab === 'response' && tabItems.length > 0 && (
        <div className="space-y-3">
          {/* 일괄 응답 바 */}
          {selectedIds.size > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-amber-800">{selectedIds.size}건 선택됨</span>
              <input type="date" value={bulkDue} onChange={e => setBulkDue(e.target.value)}
                className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent" placeholder="납기일" />
              <input type="number" value={bulkCost} onChange={e => setBulkCost(e.target.value)}
                placeholder="원가 (원)" className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 w-[100px] focus:outline-none focus:border-brand-accent" />
              <button onClick={handleBulkSubmit} disabled={bulkSubmitting || !bulkDue}
                className="flex items-center gap-1 text-xs font-medium bg-brand-accent text-white px-3 py-1.5 rounded-lg hover:bg-[#d81b60] disabled:opacity-50">
                {bulkSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                일괄 제출
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">취소</button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === responseItems.filter(o => o.status === 'confirmed' || o.status === 'sent').length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">품번</th>
                  <th className="px-3 py-2 text-left">품명</th>
                  <th className="px-3 py-2 text-center">컬러</th>
                  <th className="px-3 py-2 text-right">발주수량</th>
                  <th className="px-3 py-2 text-center">희망납기</th>
                  <th className="px-3 py-2 text-right">사전원가</th>
                  <th className="px-2 py-2 text-center bg-amber-50/80 border-l border-amber-200">납기가능일 *</th>
                  <th className="px-2 py-2 text-center bg-amber-50/80">확정원가</th>
                  <th className="px-2 py-2 text-center bg-amber-50/80 border-r border-amber-200">제출</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tabItems.map(o => {
                  const input = inlineInputs[o.id] || { due: '', cost: '' }
                  // confirmed(신규 응답) 또는 sent(재협의 요청) → 입력 가능
                  const canRespond = o.status === 'confirmed' || o.status === 'sent'
                  const isRenegotiation = o.status === 'sent' && !!o.md_comment
                  const isSubmitting = submittingIds.has(o.id)
                  const isSubmitted = submittedIds.has(o.id)
                  return (
                    <>
                      {/* MD 재협의 코멘트 표시 */}
                      {isRenegotiation && (
                        <tr key={`${o.id}-comment`} className="bg-red-50/50">
                          <td colSpan={12} className="px-4 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="font-medium text-red-700">재협의 요청</span>
                              <span className="text-red-600">— {o.md_comment}</span>
                              <span className="text-gray-400 ml-auto">{o.stylecd} {o.colorcd}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr key={o.id} className={cn(
                        'hover:bg-gray-50',
                        selectedIds.has(o.id) && 'bg-amber-50/50',
                        isRenegotiation && 'bg-red-50/20'
                      )}>
                        <td className="px-3 py-2">
                          {canRespond && (
                            <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} className="rounded border-gray-300" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 cursor-pointer" onClick={() => setSelectedOrder(o)}>{o.stylecd}</td>
                        <td className="px-3 py-2 text-gray-600 truncate max-w-[120px] cursor-pointer" onClick={() => setSelectedOrder(o)}>{o.stylenm}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{o.colorcd}</td>
                        <td className="px-3 py-2 text-right">{fmtNum(o.po_qty)}</td>
                        <td className="px-3 py-2 text-center text-xs">{fmtDate(o.confirmed_due)}</td>
                        <td className="px-3 py-2 text-right text-xs">{o.expected_cost ? fmtNum(o.expected_cost) + '원' : '—'}</td>
                        {/* 협력사 입력 영역 */}
                        <td className={cn('px-2 py-1.5 border-l', canRespond ? 'bg-amber-50/30 border-amber-100' : 'border-gray-100')}>
                          {canRespond ? (
                            <input
                              type="date"
                              value={input.due}
                              onChange={e => setInlineValue(o.id, 'due', e.target.value)}
                              className={cn('w-full text-xs border rounded px-1.5 py-1 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20',
                                isRenegotiation ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                              )}
                            />
                          ) : (
                            <span className="text-xs text-gray-500">{o.proposed_due ? fmtDate(o.proposed_due) : '—'}</span>
                          )}
                        </td>
                        <td className={cn('px-2 py-1.5', canRespond ? 'bg-amber-50/30' : '')}>
                          {canRespond ? (
                            <input
                              type="number"
                              value={input.cost}
                              onChange={e => setInlineValue(o.id, 'cost', e.target.value)}
                              placeholder="원"
                              className={cn('w-full text-xs border rounded px-1.5 py-1 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 w-[80px]',
                                isRenegotiation ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                              )}
                            />
                          ) : (
                            <span className="text-xs text-gray-500">{o.proposed_cost ? fmtNum(o.proposed_cost) + '원' : '—'}</span>
                          )}
                        </td>
                        <td className={cn('px-2 py-1.5 border-r', canRespond ? 'bg-amber-50/30 border-amber-100' : 'border-gray-100')}>
                          {canRespond ? (
                            <button
                              onClick={() => handleSingleSubmit(o)}
                              disabled={!input.due || isSubmitting}
                              className={cn(
                                'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap',
                                isSubmitted ? 'bg-green-100 text-green-700' :
                                input.due ? (isRenegotiation ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand-accent text-white hover:bg-[#d81b60]') :
                                'bg-gray-100 text-gray-400 cursor-not-allowed'
                              )}
                            >
                              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> :
                               isSubmitted ? <><CheckCircle2 className="w-3 h-3" /> 완료</> :
                               isRenegotiation ? <><Send className="w-3 h-3" /> 재제출</> :
                               <><Send className="w-3 h-3" /> 제출</>}
                            </button>
                          ) : (
                            <StatusBadge status={o.status} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center"><StatusBadge status={o.status} /></td>
                        <td className="px-3 py-2 cursor-pointer" onClick={() => setSelectedOrder(o)}><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                      </tr>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ 탭 2: 생산 진행 ═══ */}
      {!loading && activeTab === 'production' && tabItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">품번</th>
                <th className="px-3 py-2 text-left">품명</th>
                <th className="px-3 py-2 text-center">컬러</th>
                <th className="px-3 py-2 text-right">발주수량</th>
                <th className="px-3 py-2 text-center">납기</th>
                <th className="px-3 py-2 text-center">진행단계</th>
                <th className="px-3 py-2 text-center">상태</th>
                <th className="px-3 py-2 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tabItems.map(o => {
                const stage = getStageInfo(o)
                const isDelayed = o.confirmed_due && new Date() > new Date(o.confirmed_due) && o.status !== 'completed'
                return (
                  <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                    <td className="px-3 py-2 font-medium text-gray-900">{o.stylecd}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]">{o.stylenm}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{o.colorcd}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(o.po_qty)}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className={cn(isDelayed && 'text-red-600 font-medium')}>{fmtDate(o.confirmed_due)}</span>
                      {isDelayed && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <StageMini order={o} />
                        <span className="text-[10px] text-gray-500">{stage.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={o.status} /></td>
                    <td className="px-3 py-2"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ 탭 3: 입고 현황 ═══ */}
      {!loading && activeTab === 'inbound' && tabItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">품번</th>
                <th className="px-3 py-2 text-left">품명</th>
                <th className="px-3 py-2 text-center">컬러</th>
                <th className="px-3 py-2 text-right">발주수량</th>
                <th className="px-3 py-2 text-right">입고수량</th>
                <th className="px-3 py-2 text-center w-[120px]">입고율</th>
                <th className="px-3 py-2 text-right">잔여</th>
                <th className="px-3 py-2 text-center">상태</th>
                <th className="px-3 py-2 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tabItems.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                  <td className="px-3 py-2 font-medium text-gray-900">{o.stylecd}</td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]">{o.stylenm}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{o.colorcd}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(o.po_qty)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(o.expected_qty)}</td>
                  <td className="px-3 py-2"><RateBar rate={o.expected_rate || 0} /></td>
                  <td className="px-3 py-2 text-right">{fmtNum(o.remaining_qty)}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ 탭 4: 전체 현황 ═══ */}
      {!loading && activeTab === 'all' && tabItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">품번</th>
                <th className="px-3 py-2 text-left">품명</th>
                <th className="px-3 py-2 text-center">컬러</th>
                <th className="px-3 py-2 text-center">브랜드</th>
                <th className="px-3 py-2 text-center">시즌</th>
                <th className="px-3 py-2 text-center">발주유형</th>
                <th className="px-3 py-2 text-right">발주수량</th>
                <th className="px-3 py-2 text-center w-[100px]">입고율</th>
                <th className="px-3 py-2 text-center">진행</th>
                <th className="px-3 py-2 text-center">상태</th>
                <th className="px-3 py-2 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tabItems.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                  <td className="px-3 py-2 font-medium text-gray-900">{o.stylecd}</td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]">{o.stylenm}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{o.colorcd}</td>
                  <td className="px-3 py-2 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100">{o.brandcd}</span></td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{o.season}</td>
                  <td className="px-3 py-2 text-center">
                    {o.pono && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{o.pono}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtNum(o.po_qty)}</td>
                  <td className="px-3 py-2"><RateBar rate={o.expected_rate || 0} /></td>
                  <td className="px-3 py-2"><StageMini order={o} /></td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사이드 패널 */}
      {selectedOrder && (
        <DetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSave={(id, field, value) => {
            saveField(id, field, value)
            // 로컬 상태 업데이트
            setOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
            setSelectedOrder(prev => prev && prev.id === id ? { ...prev, [field]: value } : prev)
          }}
        />
      )}
    </div>
  )
}
