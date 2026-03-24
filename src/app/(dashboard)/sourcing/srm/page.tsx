'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search, Download, Upload, X, ChevronDown, ChevronRight,
  AlertTriangle, Check, XCircle, Clock, Factory, Truck, Package,
  BarChart3, UserPlus, Send, MessageSquare, Eye, Loader2, Plus,
  ClipboardList, CheckCircle2, ArrowRightCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { BRAND_NAMES } from '@/lib/constants'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ── 타입 ──────────────────────────────────────────────
type SrmStatus = 'draft' | 'sent' | 'responded' | 'confirmed' | 'in_production' | 'completed'

type SrmItem = {
  id: string
  stylecd: string
  chasu: string
  colorcd: string
  colornm: string
  stylenm: string
  brandcd: string
  sourcing_md: string
  vendor: string
  country: string
  pono: string
  whnm: string
  season: string
  delivery: string
  confirmed_due: string
  order_date: string
  order_type: string
  item_category: string
  item_name: string
  po_qty: number
  color_qty: number
  is_closed: boolean
  remark: string
  status: SrmStatus
  sent_at: string
  vendor_response: { proposed_due?: string; proposed_cost?: number; comment?: string } | null
  vendor_responded_at: string
  confirmed_at: string
  confirmed_by: string
  md_comment: string
  last_vendor_update_at: string
  // 원단
  fabric_vendor: string
  fabric_spec: string
  bt_confirm: string
  bulk_confirm: string
  ksk_result: string
  gb_result: string
  // 사양
  artwork_confirm: string
  qc1_receive: string; qc1_confirm: string
  qc2_receive: string; qc2_confirm: string
  qc3_receive: string; qc3_confirm: string
  app_confirm: string
  pp1_receive: string; pp1_confirm: string
  pp2_receive: string; pp2_confirm: string
  pp_confirm: string
  matching_chart: string
  yardage_confirm: string
  // 생산
  fabric_order: string
  fabric_ship: string
  fabric_inbound: string
  cutting_start: string
  sewing_start: string
  sewing_complete: string
  finish_date: string
  shipping_date: string
  // 입고
  inbound_1_date: string; inbound_1_qty: number
  inbound_2_date: string; inbound_2_qty: number
  inbound_3_date: string; inbound_3_qty: number
  inbound_4_date: string; inbound_4_qty: number
  inbound_5_date: string; inbound_5_qty: number
  expected_qty: number
  expected_rate: number
  remaining_qty: number
  // 원가
  erp_status: string
  input_close: string
  sale_close: string
  expected_cost: number
  confirmed_cost: number
  confirmed_price: number
  material_mix: string
  wash_code: string
  created_at: string
  updated_at: string
}

type StatusStats = Record<SrmStatus, number>

// ── 상수 ──────────────────────────────────────────────
const TABS = [
  { key: 'orders', label: '발주 관리', icon: ClipboardList },
  { key: 'responses', label: '협력사 응답', icon: MessageSquare },
  { key: 'monitoring', label: '생산 모니터링', icon: Factory },
  { key: 'inbound', label: '입고 관리', icon: Package },
  { key: 'performance', label: '성과 분석', icon: BarChart3 },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_CONFIG: Record<SrmStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '초안', color: '#6b7280', bg: '#f3f4f6' },
  sent: { label: '발송완료', color: '#d97706', bg: '#fef3c7' },
  responded: { label: '응답완료', color: '#2563eb', bg: '#dbeafe' },
  confirmed: { label: '발주확정', color: '#4f46e5', bg: '#e0e7ff' },
  in_production: { label: '생산중', color: '#7c3aed', bg: '#ede9fe' },
  completed: { label: '완료', color: '#059669', bg: '#d1fae5' },
}

const PRODUCTION_STAGES = [
  { key: 'fabric_order', label: '원단발주' },
  { key: 'fabric_ship', label: '원단출고' },
  { key: 'fabric_inbound', label: '원단입고' },
  { key: 'cutting_start', label: '재단' },
  { key: 'sewing_start', label: '봉제' },
  { key: 'sewing_complete', label: '봉제완료' },
  { key: 'finish_date', label: '완성' },
  { key: 'shipping_date', label: '선적' },
] as const

const DONUT_COLORS = ['#6b7280', '#d97706', '#2563eb', '#4f46e5', '#7c3aed', '#059669']

// ── 헬퍼 ──────────────────────────────────────────────
const fmtNum = (n: number | null | undefined) =>
  n != null ? n.toLocaleString('ko-KR') : '—'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return ''
  return d.slice(0, 10)
}

const getProductionStage = (item: SrmItem): string => {
  if (item.status === 'completed' || item.is_closed) return '완료'
  if (item.shipping_date) return '선적'
  if (item.finish_date) return '완성'
  if (item.sewing_complete) return '봉제완료'
  if (item.sewing_start) return '봉제'
  if (item.cutting_start) return '재단'
  if (item.fabric_inbound) return '원단입고'
  if (item.fabric_order) return '원단발주'
  return '대기'
}

const isDelayed = (item: SrmItem): boolean => {
  if (!item.confirmed_due || item.is_closed) return false
  const due = new Date(item.confirmed_due)
  const now = new Date()
  return now > due
}

// 상태 뱃지
function StatusBadge({ status }: { status: SrmStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

// 생산 단계 프로그레스 바
function ProductionProgress({ item }: { item: SrmItem }) {
  const isComplete = item.status === 'completed' || item.is_closed
  const stageIdx = PRODUCTION_STAGES.findIndex(
    s => !(item as Record<string, unknown>)[s.key]
  )
  const completed = isComplete ? PRODUCTION_STAGES.length : (stageIdx === -1 ? PRODUCTION_STAGES.length : stageIdx)
  return (
    <div className="flex items-center gap-0.5">
      {PRODUCTION_STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              i < completed ? (isComplete ? 'bg-green-500' : 'bg-purple-500') : 'bg-gray-200'
            )}
            title={s.label}
          />
          {i < PRODUCTION_STAGES.length - 1 && (
            <div className={cn('w-3 h-0.5', i < completed - 1 ? (isComplete ? 'bg-green-300' : 'bg-purple-300') : 'bg-gray-200')} />
          )}
        </div>
      ))}
      <span className={cn('ml-1.5 text-[10px]', isComplete ? 'text-green-600 font-medium' : 'text-gray-500')}>
        {isComplete ? '완료' : completed === 0 ? '대기' : PRODUCTION_STAGES[Math.min(completed, PRODUCTION_STAGES.length) - 1].label}
      </span>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function SrmPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('orders')
  const [items, setItems] = useState<SrmItem[]>([])
  const [statusStats, setStatusStats] = useState<StatusStats>({
    draft: 0, sent: 0, responded: 0, confirmed: 0, in_production: 0, completed: 0,
  })
  const [loading, setLoading] = useState(false)

  // 필터
  const [fBrand, setFBrand] = useState('')
  const [fMd, setFMd] = useState('')
  const [fVendor, setFVendor] = useState('')
  const [fSeason, setFSeason] = useState('')
  const [fPono, setFPono] = useState('')
  const [fErpStatus, setFErpStatus] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fSearch, setFSearch] = useState('')

  // 연도 필터
  const [fYear, setFYear] = useState('2026')

  // 업로드
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadResult, setUploadResult] = useState<{ success: number; fail: number } | null>(null)

  // ── 데이터 조회 (Snowflake 직접) ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('year', fYear)
      if (fBrand) params.set('brand', fBrand)
      if (fMd) params.set('sourcing_md', fMd)
      if (fVendor) params.set('vendor', fVendor)
      if (fSeason) params.set('season', fSeason)
      if (fPono) params.set('pono', fPono)
      if (fErpStatus) params.set('erp_status', fErpStatus)
      if (fStatus) params.set('status', fStatus)
      if (fSearch) params.set('search', fSearch)

      const res = await fetch(`/api/srm?${params}`)
      const json = await res.json()
      if (!json.error) {
        setItems(json.data || [])
        setStatusStats(json.statusStats || {
          draft: 0, sent: 0, responded: 0, confirmed: 0, in_production: 0, completed: 0,
        })
        if (json.uniqueSets) {
          setUniqueVals({
            mds: json.uniqueSets.mds || [],
            vendors: json.uniqueSets.vendors || [],
            seasons: json.uniqueSets.seasons || [],
            ponos: json.uniqueSets.ponos || [],
            erpStatuses: json.uniqueSets.erpStatuses || [],
          })
        }
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [fYear, fBrand, fMd, fVendor, fSeason, fPono, fErpStatus, fStatus, fSearch])

  useEffect(() => { fetchData() }, [fetchData])

  // 유니크 값 목록
  // 필터 옵션 (API에서 전체 기준으로 내려옴)
  const [uniqueVals, setUniqueVals] = useState<{
    mds: string[]; vendors: string[]; seasons: string[]; ponos: string[]; erpStatuses: string[]
  }>({ mds: [], vendors: [], seasons: [], ponos: [], erpStatuses: [] })

  // 상태 변경
  const changeStatus = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await fetch(`/api/srm/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      fetchData()
    } catch (err) { console.error(err) }
  }

  // 필드 수정 (인라인)
  const patchField = async (id: string, field: string, value: string | number) => {
    try {
      await fetch(`/api/srm/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    } catch (err) { console.error(err) }
  }

  // 엑셀 업로드
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      try {
        const res = await fetch('/api/srm/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
        const data = await res.json()
        setUploadResult({ success: data.upserted || 0, fail: 0 })
        fetchData()
      } catch { setUploadResult({ success: 0, fail: rows.length }) }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // 엑셀 다운로드
  const handleDownload = () => {
    const rows = items.map(i => ({
      '품번': i.stylecd, '차수': i.chasu, '컬러': i.colorcd,
      '품명': i.stylenm, '상태': STATUS_CONFIG[i.status]?.label || i.status,
      '소싱MD': i.sourcing_md, '협력사': i.vendor,
      '시즌': i.season, '확정납기': fmtDate(i.confirmed_due),
      '발주수량': i.po_qty,
      '진행단계': getProductionStage(i),
      '비고': i.remark,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SRM생산현황')
    XLSX.writeFile(wb, `SRM_생산현황_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── 렌더링 ──────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SRM 생산관리</h1>
          <p className="text-sm text-gray-500 mt-1">Snowflake 실시간 발주·입고 데이터 기반</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> 다운로드
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-[#d81b60]">
            <Upload className="w-4 h-4" /> 엑셀 업로드
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-green-800">
            업로드 완료: {uploadResult.success}건 성공{uploadResult.fail > 0 && `, ${uploadResult.fail}건 실패`}
          </span>
          <button onClick={() => setUploadResult(null)} className="text-green-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 상태 요약 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(Object.entries(STATUS_CONFIG) as [SrmStatus, typeof STATUS_CONFIG[SrmStatus]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFStatus(fStatus === key ? '' : key)}
            className={cn(
              'rounded-lg p-3 text-center transition-all border',
              fStatus === key ? 'ring-2 ring-brand-accent border-brand-accent' : 'border-transparent'
            )}
            style={{ backgroundColor: cfg.bg }}
          >
            <p className="text-lg font-bold" style={{ color: cfg.color }}>
              {statusStats[key] || 0}
            </p>
            <p className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
          </button>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}>
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === 'responses' && statusStats.responded > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full">
                  {statusStats.responded}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 필터 바 */}
      {(activeTab === 'orders' || activeTab === 'monitoring' || activeTab === 'inbound') && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="품번/품명/협력사 검색..."
              value={fSearch} onChange={e => setFSearch(e.target.value)}
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-accent"
            />
          </div>
          <select value={fYear} onChange={e => setFYear(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <select value={fBrand} onChange={e => setFBrand(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 브랜드</option>
            {Object.entries(BRAND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={fMd} onChange={e => setFMd(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 MD</option>
            {uniqueVals.mds.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fVendor} onChange={e => setFVendor(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 협력사</option>
            {uniqueVals.vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fSeason} onChange={e => setFSeason(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 시즌</option>
            {uniqueVals.seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fPono} onChange={e => setFPono(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 발주유형</option>
            {uniqueVals.ponos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fErpStatus} onChange={e => setFErpStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">전체 진행상태</option>
            {uniqueVals.erpStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ═══ Tab 1: 발주 관리 ═══ */}
      {!loading && activeTab === 'orders' && (
        <OrdersTab
          items={items}
          changeStatus={changeStatus}
          patchField={patchField}
          fetchData={fetchData}
        />
      )}

      {/* ═══ Tab 2: 협력사 응답 ═══ */}
      {!loading && activeTab === 'responses' && (
        <ResponsesTab
          items={items.filter(i => i.status === 'responded')}
          changeStatus={changeStatus}
        />
      )}

      {/* ═══ Tab 3: 생산 모니터링 ═══ */}
      {!loading && activeTab === 'monitoring' && (
        <MonitoringTab items={items.filter(i => ['confirmed', 'in_production'].includes(i.status))} />
      )}

      {/* ═══ Tab 4: 입고 관리 ═══ */}
      {!loading && activeTab === 'inbound' && (
        <InboundTab
          items={items.filter(i => ['in_production', 'completed'].includes(i.status))}
          changeStatus={changeStatus}
        />
      )}

      {/* ═══ Tab 5: 성과 분석 ═══ */}
      {!loading && activeTab === 'performance' && (
        <PerformanceTab items={items} statusStats={statusStats} />
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 1: 발주 관리
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function OrdersTab({ items, changeStatus, patchField, fetchData }: {
  items: SrmItem[]
  changeStatus: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>
  patchField: (id: string, field: string, value: string | number) => Promise<void>
  fetchData: () => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [newOrder, setNewOrder] = useState({
    stylecd: '', chasu: '01', colorcd: '', brandcd: 'CO', stylenm: '',
    vendor: '', season: '', po_qty: '', confirmed_due: '', sourcing_md: '',
    expected_cost: '', order_type: 'M', item_category: '', item_name: '',
  })
  const [saving, setSaving] = useState(false)

  // 발주 건 직접 등록
  const handleCreateOrder = async () => {
    if (!newOrder.stylecd || !newOrder.colorcd || !newOrder.brandcd) return
    setSaving(true)
    try {
      const res = await fetch('/api/srm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...newOrder,
          po_qty: newOrder.po_qty ? parseInt(newOrder.po_qty) : 0,
          expected_cost: newOrder.expected_cost ? parseFloat(newOrder.expected_cost) : null,
          status: 'draft',
        }]),
      })
      if (res.ok) {
        setShowForm(false)
        setNewOrder({
          stylecd: '', chasu: '01', colorcd: '', brandcd: 'CO', stylenm: '',
          vendor: '', season: '', po_qty: '', confirmed_due: '', sourcing_md: '',
          expected_cost: '', order_type: 'M', item_category: '', item_name: '',
        })
        fetchData()
      }
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const undecidedItems = items.filter(i => i.erp_status === '발주미정')
  const draftItems = items.filter(i => i.status === 'draft' && i.erp_status !== '발주미정')
  const sentItems = items.filter(i => i.status === 'sent')

  return (
    <div className="space-y-4">
      {/* 신규 등록 버튼 */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
      >
        <Plus className="w-4 h-4" /> 발주 건 직접 등록
      </button>

      {/* 신규 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">신규 발주 등록</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'stylecd', label: '품번*', type: 'text' },
              { key: 'colorcd', label: '컬러코드*', type: 'text' },
              { key: 'chasu', label: '차수', type: 'text' },
              { key: 'stylenm', label: '품명', type: 'text' },
              { key: 'vendor', label: '협력사', type: 'text' },
              { key: 'season', label: '시즌', type: 'text' },
              { key: 'po_qty', label: '발주수량', type: 'number' },
              { key: 'confirmed_due', label: '납기희망일', type: 'date' },
              { key: 'expected_cost', label: '가원가', type: 'number' },
              { key: 'sourcing_md', label: '소싱MD', type: 'text' },
              { key: 'item_category', label: '복종', type: 'text' },
              { key: 'item_name', label: '아이템', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-gray-500 block mb-0.5">{f.label}</label>
                <input
                  type={f.type}
                  value={(newOrder as Record<string, string>)[f.key]}
                  onChange={e => setNewOrder({ ...newOrder, [f.key]: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">브랜드*</label>
              <select value={newOrder.brandcd} onChange={e => setNewOrder({ ...newOrder, brandcd: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                {Object.entries(BRAND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">오더타입</label>
              <select value={newOrder.order_type} onChange={e => setNewOrder({ ...newOrder, order_type: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="M">메인</option>
                <option value="R">리오더</option>
                <option value="S">스팟</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateOrder} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-[#d81b60] disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 등록
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">취소</button>
          </div>
        </div>
      )}

      {/* 미발주 (ERP 발주미정) */}
      {undecidedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> 미발주 — 발주미정 ({undecidedItems.length})
            <span className="text-[10px] font-normal text-gray-400 ml-1">ERP 진행상태: 발주미정</span>
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50/50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">품번</th>
                  <th className="px-3 py-2 text-left">품명</th>
                  <th className="px-3 py-2 text-left">컬러코드</th>
                  <th className="px-3 py-2 text-left">컬러명</th>
                  <th className="px-3 py-2 text-left">브랜드</th>
                  <th className="px-3 py-2 text-center">발주유형</th>
                  <th className="px-3 py-2 text-left">협력사</th>
                  <th className="px-3 py-2 text-left">시즌</th>
                  <th className="px-3 py-2 text-right">발주수량</th>
                  <th className="px-3 py-2 text-left">발주일</th>
                  <th className="px-3 py-2 text-left">생산국</th>
                  <th className="px-3 py-2 text-center">진행상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {undecidedItems.map(item => (
                  <tr key={item.id} className="hover:bg-red-50/30">
                    <td className="px-3 py-2 font-medium text-gray-900">{item.stylecd}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{item.stylenm}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colorcd}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colornm || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100">{item.brandcd}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.pono && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.pono}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.vendor || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.season || '—'}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(item.po_qty)}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtDate(item.order_date)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.country || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-red-600 bg-red-50">
                        발주미정
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 초안 (발송 전) */}
      {draftItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> 발송 대기 ({draftItems.length})
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">품번</th>
                  <th className="px-3 py-2 text-left">품명</th>
                  <th className="px-3 py-2 text-left">컬러코드</th>
                  <th className="px-3 py-2 text-left">컬러명</th>
                  <th className="px-3 py-2 text-left">브랜드</th>
                  <th className="px-3 py-2 text-center">발주유형</th>
                  <th className="px-3 py-2 text-left">협력사</th>
                  <th className="px-3 py-2 text-right">발주수량</th>
                  <th className="px-3 py-2 text-right">입고수량</th>
                  <th className="px-3 py-2 text-center">입고율</th>
                  <th className="px-3 py-2 text-left">납기희망</th>
                  <th className="px-3 py-2 text-left">가원가</th>
                  <th className="px-3 py-2 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draftItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{item.stylecd}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{item.stylenm}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colorcd}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colornm || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100">{item.brandcd}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.pono && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.pono}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.vendor || '—'}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(item.po_qty)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(item.expected_qty)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        (item.expected_rate || 0) >= 100 ? 'bg-green-50 text-green-700' :
                        (item.expected_rate || 0) > 0 ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-50 text-gray-400'
                      )}>
                        {item.expected_rate || 0}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fmtDate(item.confirmed_due)}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtNum(item.expected_cost)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => changeStatus(item.id, 'send')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100"
                      >
                        <Send className="w-3 h-3" /> 발송완료
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 발송 완료 (응답 대기 중) */}
      {sentItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-500" /> 발송완료 — 응답 대기 ({sentItems.length})
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">품번</th>
                  <th className="px-3 py-2 text-left">품명</th>
                  <th className="px-3 py-2 text-left">컬러코드</th>
                  <th className="px-3 py-2 text-left">컬러명</th>
                  <th className="px-3 py-2 text-center">발주유형</th>
                  <th className="px-3 py-2 text-left">협력사</th>
                  <th className="px-3 py-2 text-right">발주수량</th>
                  <th className="px-3 py-2 text-right">입고수량</th>
                  <th className="px-3 py-2 text-center">입고율</th>
                  <th className="px-3 py-2 text-left">납기희망</th>
                  <th className="px-3 py-2 text-left">발송일</th>
                  <th className="px-3 py-2 text-center">경과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sentItems.map(item => {
                  const daysSent = item.sent_at
                    ? Math.round((Date.now() - new Date(item.sent_at).getTime()) / 86400000)
                    : 0
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{item.stylecd}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{item.stylenm}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{item.colorcd}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colornm || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {item.pono && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.pono}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{item.vendor || '—'}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(item.po_qty)}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(item.expected_qty)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          (item.expected_rate || 0) >= 100 ? 'bg-green-50 text-green-700' :
                          (item.expected_rate || 0) > 0 ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-50 text-gray-400'
                        )}>
                          {item.expected_rate || 0}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{fmtDate(item.confirmed_due)}</td>
                      <td className="px-3 py-2 text-gray-600">{fmtDate(item.sent_at)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          daysSent > 3 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                        )}>
                          {daysSent}일
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {undecidedItems.length === 0 && draftItems.length === 0 && sentItems.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">발주 대기 중인 건이 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">모든 건이 발주 확정 이후 단계에 있습니다.</p>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 2: 협력사 응답
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ResponsesTab({ items, changeStatus }: {
  items: SrmItem[]
  changeStatus: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>
}) {
  const [commentId, setCommentId] = useState<string | null>(null)
  const [mdComment, setMdComment] = useState('')

  const handleConfirm = (id: string) => changeStatus(id, 'confirm')
  const handleRenegotiate = (id: string) => {
    if (!mdComment.trim()) return
    changeStatus(id, 'renegotiate', { md_comment: mdComment })
    setCommentId(null)
    setMdComment('')
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">확인 대기 중인 응답이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">협력사가 납기/원가를 응답한 건입니다. 확정하거나 재협의를 요청하세요.</p>

      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            {/* 왼쪽: 발주 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-900">{item.stylecd}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100">{item.brandcd}</span>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{item.stylenm}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>협력사: <strong className="text-gray-700">{item.vendor}</strong></span>
                <span>발주수량: <strong className="text-gray-700">{fmtNum(item.po_qty)}</strong></span>
                <span>MD 희망납기: <strong className="text-gray-700">{fmtDate(item.confirmed_due)}</strong></span>
                <span>가원가: <strong className="text-gray-700">{fmtNum(item.expected_cost)}</strong></span>
              </div>
            </div>

            {/* 오른쪽: 협력사 응답 */}
            <div className="bg-blue-50 rounded-lg p-3 min-w-[200px]">
              <p className="text-[10px] text-blue-600 font-semibold mb-1">협력사 응답</p>
              <div className="space-y-1 text-xs">
                <p>납기제안: <strong className="text-blue-800">{item.vendor_response?.proposed_due || '—'}</strong></p>
                <p>원가제안: <strong className="text-blue-800">{item.vendor_response?.proposed_cost ? fmtNum(item.vendor_response.proposed_cost) + '원' : '—'}</strong></p>
                {item.vendor_response?.comment && (
                  <p className="text-blue-700 mt-1">"{item.vendor_response.comment}"</p>
                )}
                <p className="text-[10px] text-blue-400 mt-1">응답일: {fmtDate(item.vendor_responded_at)}</p>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => handleConfirm(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Check className="w-3 h-3" /> 확정
            </button>
            {commentId === item.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text" placeholder="재협의 사유 입력..."
                  value={mdComment} onChange={e => setMdComment(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent"
                  autoFocus
                />
                <button onClick={() => handleRenegotiate(item.id)}
                  className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">전송</button>
                <button onClick={() => { setCommentId(null); setMdComment('') }}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button
                onClick={() => setCommentId(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
              >
                <MessageSquare className="w-3 h-3" /> 재협의
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: 생산 모니터링 (읽기 전용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MonitoringTab({ items }: { items: SrmItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [delayOnly, setDelayOnly] = useState(false)

  const filtered = delayOnly ? items.filter(isDelayed) : items

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Factory className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">생산 중인 건이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">협력사가 입력한 생산 진행 현황 (읽기 전용)</p>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={delayOnly} onChange={e => setDelayOnly(e.target.checked)}
            className="rounded border-gray-300" />
          <AlertTriangle className="w-3 h-3 text-red-500" /> 지연 건만
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left">품번</th>
              <th className="px-3 py-2 text-left">품명</th>
              <th className="px-3 py-2 text-left">컬러코드</th>
                  <th className="px-3 py-2 text-left">컬러명</th>
              <th className="px-3 py-2 text-center">발주유형</th>
              <th className="px-3 py-2 text-left">생산국</th>
              <th className="px-3 py-2 text-left">협력사</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-left">생산 진행</th>
              <th className="px-3 py-2 text-right">발주수량</th>
              <th className="px-3 py-2 text-left">확정납기</th>
              <th className="px-3 py-2 text-left">입고창고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => (
              <>
                <tr key={item.id}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className={cn('hover:bg-gray-50 cursor-pointer', isDelayed(item) && 'bg-red-50/50')}
                >
                  <td className="px-3 py-2 text-gray-400">
                    {expandedId === item.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {item.stylecd}
                    {isDelayed(item) && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
                  </td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{item.stylenm}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{item.colorcd}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colornm || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {item.pono && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        item.pono === '메인' ? 'bg-blue-50 text-blue-700' :
                        item.pono === '글로벌' ? 'bg-purple-50 text-purple-700' :
                        item.pono === '대만' ? 'bg-orange-50 text-orange-700' :
                        item.pono === '중국' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {item.pono}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{item.country || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{item.vendor}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-2"><ProductionProgress item={item} /></td>
                  <td className="px-3 py-2 text-right">{fmtNum(item.po_qty)}</td>
                  <td className="px-3 py-2 text-gray-600">{fmtDate(item.confirmed_due)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.whnm || '—'}</td>
                </tr>
                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`}>
                    <td colSpan={14} className="bg-gray-50 px-4 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">원단</p>
                          <p>업체: {item.fabric_vendor || '—'}</p>
                          <p>스펙: {item.fabric_spec || '—'}</p>
                          <p>BT: {fmtDate(item.bt_confirm) || '—'}</p>
                          <p>BULK: {fmtDate(item.bulk_confirm) || '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">생산 일정</p>
                          {PRODUCTION_STAGES.map(s => (
                            <p key={s.key}>{s.label}: {fmtDate((item as unknown as Record<string, string>)[s.key]) || '—'}</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">사양</p>
                          <p>아트워크: {fmtDate(item.artwork_confirm) || '—'}</p>
                          <p>PP확인: {fmtDate(item.pp_confirm) || '—'}</p>
                          <p>매칭차트: {fmtDate(item.matching_chart) || '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">원가/사양</p>
                          <p>확정원가: {fmtNum(item.confirmed_cost)}</p>
                          <p>혼용율: {item.material_mix || '—'}</p>
                          <p>세탁: {item.wash_code || '—'}</p>
                          <p>비고: {item.remark || '—'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 4: 입고 관리
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function InboundTab({ items, changeStatus }: {
  items: SrmItem[]
  changeStatus: (id: string, action: string) => Promise<void>
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">입고 대상 건이 없습니다.</p>
      </div>
    )
  }

  // 월별 입고 집계
  const monthMap = useMemo(() => {
    const m: Record<string, { month: string; qty: number; count: number }> = {}
    items.forEach(i => {
      for (let n = 1; n <= 5; n++) {
        const dateKey = `inbound_${n}_date` as keyof SrmItem
        const qtyKey = `inbound_${n}_qty` as keyof SrmItem
        const d = i[dateKey] as string
        const q = (i[qtyKey] as number) || 0
        if (d && q) {
          const month = String(d).slice(0, 7)
          if (!m[month]) m[month] = { month, qty: 0, count: 0 }
          m[month].qty += q
          m[month].count += 1
        }
      }
    })
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month))
  }, [items])

  return (
    <div className="space-y-4">
      {/* 월별 입고 요약 차트 */}
      {monthMap.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">월별 입고 계획</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthMap}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" name="입고수량" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 입고 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">품번</th>
              <th className="px-3 py-2 text-left">컬러코드</th>
                  <th className="px-3 py-2 text-left">컬러명</th>
              <th className="px-3 py-2 text-center">발주유형</th>
              <th className="px-3 py-2 text-left">생산국</th>
              <th className="px-3 py-2 text-left">협력사</th>
              <th className="px-3 py-2 text-left">입고창고</th>
              <th className="px-3 py-2 text-left">확정납기</th>
              <th className="px-3 py-2 text-right">발주</th>
              <th className="px-3 py-2 text-center">1차</th>
              <th className="px-3 py-2 text-center">2차</th>
              <th className="px-3 py-2 text-center">3차</th>
              <th className="px-3 py-2 text-right">입고합계</th>
              <th className="px-3 py-2 text-right">잔여</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-center">마감</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => {
              const totalInbound = (item.inbound_1_qty || 0) + (item.inbound_2_qty || 0) +
                (item.inbound_3_qty || 0) + (item.inbound_4_qty || 0) + (item.inbound_5_qty || 0)
              const remaining = (item.po_qty || 0) - totalInbound
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{item.stylecd}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{item.colorcd}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.colornm || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {item.pono && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        item.pono === '메인' ? 'bg-blue-50 text-blue-700' :
                        item.pono === '글로벌' ? 'bg-purple-50 text-purple-700' :
                        item.pono === '대만' ? 'bg-orange-50 text-orange-700' :
                        item.pono === '중국' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {item.pono}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{item.country || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{item.vendor}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.whnm || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{fmtDate(item.confirmed_due)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(item.po_qty)}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    {item.inbound_1_date && <><span className="text-gray-500">{fmtDate(item.inbound_1_date)}</span><br/></>}
                    {fmtNum(item.inbound_1_qty)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {item.inbound_2_date && <><span className="text-gray-500">{fmtDate(item.inbound_2_date)}</span><br/></>}
                    {item.inbound_2_qty ? fmtNum(item.inbound_2_qty) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {item.inbound_3_date && <><span className="text-gray-500">{fmtDate(item.inbound_3_date)}</span><br/></>}
                    {item.inbound_3_qty ? fmtNum(item.inbound_3_qty) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtNum(totalInbound)}</td>
                  <td className={cn('px-3 py-2 text-right', remaining > 0 ? 'text-red-600' : 'text-green-600')}>
                    {fmtNum(remaining)}
                  </td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-2 text-center">
                    {item.status !== 'completed' && remaining <= 0 && (
                      <button
                        onClick={() => changeStatus(item.id, 'close')}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                      >
                        마감
                      </button>
                    )}
                    {item.status === 'completed' && (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 5: 성과 분석
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PerformanceTab({ items, statusStats }: {
  items: SrmItem[]
  statusStats: StatusStats
}) {
  // 상태 분포 도넛
  const statusDonut = useMemo(() => {
    return (Object.entries(STATUS_CONFIG) as [SrmStatus, typeof STATUS_CONFIG[SrmStatus]][])
      .map(([key, cfg]) => ({
        name: cfg.label,
        value: statusStats[key] || 0,
        color: cfg.color,
      }))
      .filter(d => d.value > 0)
  }, [statusStats])

  // 협력사별 성과
  const vendorPerf = useMemo(() => {
    const map: Record<string, {
      vendor: string; total: number; completed: number; delayed: number
      avgResponseDays: number; responseDaysSum: number; responseCount: number
    }> = {}
    items.forEach(i => {
      const v = i.vendor || '미지정'
      if (!map[v]) map[v] = { vendor: v, total: 0, completed: 0, delayed: 0, avgResponseDays: 0, responseDaysSum: 0, responseCount: 0 }
      map[v].total += 1
      if (i.status === 'completed') map[v].completed += 1
      if (isDelayed(i)) map[v].delayed += 1
      // 응답 속도 계산
      if (i.sent_at && i.vendor_responded_at) {
        const days = Math.round((new Date(i.vendor_responded_at).getTime() - new Date(i.sent_at).getTime()) / 86400000)
        map[v].responseDaysSum += days
        map[v].responseCount += 1
      }
    })
    return Object.values(map)
      .map(v => ({
        ...v,
        avgResponseDays: v.responseCount > 0 ? Math.round(v.responseDaysSum / v.responseCount * 10) / 10 : 0,
        completionRate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
        delayRate: v.total > 0 ? Math.round((v.delayed / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [items])

  // KPI
  const totalOrders = items.length
  const totalCompleted = items.filter(i => i.status === 'completed').length
  const totalDelayed = items.filter(isDelayed).length
  const avgCompletion = totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '총 발주', value: fmtNum(totalOrders), sub: '건' },
          { label: '완료율', value: `${avgCompletion}%`, sub: `${totalCompleted}건 완료` },
          { label: '지연', value: fmtNum(totalDelayed), sub: '건', alert: totalDelayed > 0 },
          { label: '생산중', value: fmtNum(statusStats.in_production + statusStats.confirmed), sub: '건' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={cn('text-2xl font-bold mt-1', kpi.alert ? 'text-red-600' : 'text-gray-900')}>
              {kpi.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 상태 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">상태별 분포</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDonut} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={50} outerRadius={80} paddingAngle={3}>
                {statusDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 협력사별 발주 건수 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">협력사별 발주</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vendorPerf.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="vendor" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="total" name="발주" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              <Bar dataKey="completed" name="완료" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 협력사 성과 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <p className="text-sm font-semibold text-gray-700 px-4 pt-4 pb-2">협력사 성과 상세</p>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">협력사</th>
              <th className="px-3 py-2 text-right">총 발주</th>
              <th className="px-3 py-2 text-right">완료</th>
              <th className="px-3 py-2 text-right">완료율</th>
              <th className="px-3 py-2 text-right">지연</th>
              <th className="px-3 py-2 text-right">지연율</th>
              <th className="px-3 py-2 text-right">평균 응답일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendorPerf.map(v => (
              <tr key={v.vendor} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{v.vendor}</td>
                <td className="px-3 py-2 text-right">{v.total}</td>
                <td className="px-3 py-2 text-right text-green-600">{v.completed}</td>
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px]',
                    v.completionRate >= 80 ? 'bg-green-50 text-green-700' :
                    v.completionRate >= 50 ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  )}>
                    {v.completionRate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-red-600">{v.delayed}</td>
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px]',
                    v.delayRate <= 10 ? 'bg-green-50 text-green-700' :
                    v.delayRate <= 30 ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  )}>
                    {v.delayRate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {v.avgResponseDays > 0 ? `${v.avgResponseDays}일` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
