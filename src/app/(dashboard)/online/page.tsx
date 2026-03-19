'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Package, Upload, Download, Sparkles, Search, Filter, Truck,
  Image as ImageIcon, CheckCircle2, Clock, Paintbrush, Wrench,
  ChevronRight, CalendarDays, FileImage, Plus, X,
  ChevronLeft, ChevronRight as ChevronRightIcon, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { BRAND_NAMES, BRAND_COLORS } from '@/lib/constants'

// ── 타입 ──
type Product = {
  stylecd: string; stylenm: string; brandcd: string; yearcd: string;
  seasonnm: string; itemnm: string; sexnm: string; colorcd: string;
  colornm: string; chasu: string; tagprice: number; precost: number;
  orignnm: string; manufacturer: string; plangbnm: string;
  ordqty: number; sizes: string;
  manual: Record<string, unknown> | null;
  status: string; hasImages: boolean; imageCount: number;
}

type Counts = {
  total: number; draft: number; planning: number;
  sourcing: number; design: number; complete: number;
}

type LaunchItem = {
  stylecd: string; stylenm: string; brandcd: string;
  colornm: string; colorcd: string; itemnm: string;
  tagprice: number; ordqty: number; chasu: string;
  launch_date: string; launch_platforms: string[];
  status: string;
}

// ── 상수 ──
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '미등록', color: '#6b7280', bg: '#f3f4f6', icon: Clock },
  planning: { label: '기획입력', color: '#2563eb', bg: '#dbeafe', icon: Package },
  sourcing: { label: '소싱입력', color: '#d97706', bg: '#fef3c7', icon: Wrench },
  design: { label: '디자인입력', color: '#7c3aed', bg: '#ede9fe', icon: Paintbrush },
  complete: { label: '완성', color: '#059669', bg: '#d1fae5', icon: CheckCircle2 },
}

const PLATFORM_OPTIONS = ['무신사', '29CM', 'W컨셉', '카카오', '네이버', '자사몰', 'SSG', '하이버']

export default function OnlineProductPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'schedule' | 'detail'>('schedule')
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, draft: 0, planning: 0, sourcing: 0, design: 0, complete: 0 })
  const [loading, setLoading] = useState(true)

  // 공통 필터
  const [brand, setBrand] = useState('all')
  const [year, setYear] = useState('2026')
  const [season, setSeason] = useState('')
  const [search, setSearch] = useState('')

  // 상세페이지 생성 필터
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadResult, setUploadResult] = useState<{ success: number; fail: number } | null>(null)

  // 발매일정 관련
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [editingLaunch, setEditingLaunch] = useState<{
    stylecd: string; colorcd: string; brandcd: string;
    launch_date: string; launch_platforms: string[];
  } | null>(null)
  const [bulkDate, setBulkDate] = useState('')
  const [bulkPlatforms, setBulkPlatforms] = useState<string[]>([])


  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ brand, year, season, status: statusFilter })
      const res = await fetch(`/api/online/products?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProducts(data.products || [])
      setCounts(data.counts || { total: 0, draft: 0, planning: 0, sourcing: 0, design: 0, complete: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [brand, year, season, statusFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // 검색 필터 (여러 코드 붙여넣기 지원: 쉼표, 줄바꿈, 탭 구분)
  // CO2601CR01 (상품코드만) 또는 CO2601CR01BK (상품코드+컬러코드) 모두 매칭
  const filtered = products.filter(p => {
    if (!search) return true
    const terms = search.split(/[,\n\t\r;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return true
    const combined = (p.stylecd + p.colorcd).toLowerCase() // CO2601CR01BK
    return terms.some(q =>
      p.stylecd.toLowerCase().includes(q) ||
      combined.includes(q) ||
      combined === q ||
      p.stylenm.toLowerCase().includes(q) ||
      p.colornm.toLowerCase().includes(q) ||
      p.itemnm.toLowerCase().includes(q)
    )
  })

  // ── 발매일정 데이터 ──
  const launchItems: LaunchItem[] = useMemo(() =>
    products.map(p => ({
      stylecd: p.stylecd,
      stylenm: p.stylenm,
      brandcd: p.brandcd,
      colornm: p.colornm,
      colorcd: p.colorcd,
      itemnm: p.itemnm,
      tagprice: p.tagprice,
      ordqty: p.ordqty,
      chasu: p.chasu,
      launch_date: (p.manual as Record<string, string>)?.launch_date || '',
      launch_platforms: ((p.manual as Record<string, string[]>)?.launch_platforms) || [],
      status: p.status,
    }))
  , [products])

  // 발매일 설정된 상품 / 미설정 상품
  const scheduledItems = launchItems.filter(l => l.launch_date)
  const unscheduledItems = launchItems.filter(l => !l.launch_date)

  // 발매일 저장
  const saveLaunchDate = async () => {
    if (!editingLaunch) return
    try {
      await fetch('/api/online/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stylecd: editingLaunch.stylecd,
          colorcd: editingLaunch.colorcd,
          brandcd: editingLaunch.brandcd,
          launch_date: editingLaunch.launch_date,
          launch_platforms: editingLaunch.launch_platforms,
          status: 'planning',
        }),
      })
      setEditingLaunch(null)
      fetchProducts()
    } catch (err) {
      console.error(err)
    }
  }

  // ── 캘린더 계산 ──
  const calendarDays = useMemo(() => {
    const { year: cy, month: cm } = calMonth
    const firstDay = new Date(cy, cm, 1).getDay()
    const daysInMonth = new Date(cy, cm + 1, 0).getDate()
    const days: { date: number; items: LaunchItem[] }[] = []

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, items: [] })
    }
    // 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const items = scheduledItems.filter(l => l.launch_date === dateStr)
      days.push({ date: d, items })
    }
    return days
  }, [calMonth, scheduledItems])

  const monthLabel = `${calMonth.year}년 ${calMonth.month + 1}월`
  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })
  const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })

  // ── 날짜별 그룹 (타임라인 뷰) ──
  const timeline = useMemo(() => {
    const grouped = new Map<string, LaunchItem[]>()
    scheduledItems.forEach(item => {
      const list = grouped.get(item.launch_date) || []
      list.push(item)
      grouped.set(item.launch_date, list)
    })
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [scheduledItems])

  // 일괄 발매일 적용
  const handleBulkLaunch = async () => {
    if (!bulkDate || selected.size === 0) return
    const items = filtered
      .filter(p => selected.has(`${p.stylecd}_${p.colorcd}`))
      .map(p => ({
        stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd,
        launch_date: bulkDate,
        launch_platforms: bulkPlatforms.length > 0 ? bulkPlatforms : undefined,
        status: 'planning',
      }))

    try {
      await fetch('/api/online/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      alert(`${items.length}개 상품에 발매일 적용 완료`)
      setSelected(new Set())
      setBulkDate('')
      setBulkPlatforms([])
      fetchProducts()
    } catch (err) {
      console.error(err)
    }
  }

  // ── 상세페이지 생성 함수들 ──
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => `${p.stylecd}_${p.colorcd}`)))
  }
  const toggleOne = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  const handleAiBulk = async () => {
    if (selected.size === 0) return
    setAiLoading(true)
    try {
      const selectedProducts = filtered
        .filter(p => selected.has(`${p.stylecd}_${p.colorcd}`))
        .map(p => ({
          stylenm: p.stylenm, itemnm: p.itemnm, colornm: p.colornm,
          tagprice: p.tagprice,
          material_mix: (p.manual as Record<string, string>)?.material_mix || '',
          brandcd: p.brandcd,
        }))

      const res = await fetch('/api/online/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: selectedProducts }),
      })
      const data = await res.json()

      if (data.results) {
        const prods = filtered.filter(p => selected.has(`${p.stylecd}_${p.colorcd}`))
        const updates = data.results
          .filter((r: { success: boolean }) => r.success)
          .map((r: { description: string; sellingPoints: string[]; seoTags: string[] }, i: number) => {
            const prod = prods[i]
            if (!prod) return null
            return {
              stylecd: prod.stylecd, colorcd: prod.colorcd, brandcd: prod.brandcd,
              product_description: r.description,
              selling_points: r.sellingPoints,
              seo_tags: r.seoTags,
              status: 'design',
            }
          })
          .filter(Boolean)

        if (updates.length > 0) {
          await fetch('/api/online/product', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: updates }),
          })
        }
        alert(`AI 설명 생성 완료: ${data.results.filter((r: { success: boolean }) => r.success).length}건 성공`)
        fetchProducts()
      }
    } catch (err) {
      console.error(err)
      alert('AI 생성 중 오류 발생')
    } finally {
      setAiLoading(false)
      setSelected(new Set())
    }
  }

  const downloadTemplate = () => {
    const rows = filtered.map(p => ({
      '상품코드': p.stylecd, '컬러코드': p.colorcd, '브랜드': p.brandcd,
      '상품명': p.stylenm, '컬러명': p.colornm,
      '혼용율': (p.manual as Record<string, string>)?.material_mix || '',
      '세탁방법': (p.manual as Record<string, string>)?.wash_care || '',
      '수납샘플입수일': '', '발매일': '', '발매플랫폼': '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '상품정보')
    XLSX.writeFile(wb, `상품정보_템플릿_${year}.xlsx`)
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      const items = rows.map(row => ({
        stylecd: row['상품코드'], colorcd: row['컬러코드'], brandcd: row['브랜드'],
        material_mix: row['혼용율'] || undefined, wash_care: row['세탁방법'] || undefined,
        sample_arrival_date: row['수납샘플입수일'] || undefined,
        launch_date: row['발매일'] || undefined,
        launch_platforms: row['발매플랫폼'] ? row['발매플랫폼'].split(',').map(s => s.trim()) : undefined,
      })).filter(item => item.stylecd && item.colorcd && item.brandcd)
      try {
        const res = await fetch('/api/online/product', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        const data = await res.json()
        setUploadResult({ success: data.successCount, fail: data.failCount })
        fetchProducts()
      } catch (err) { console.error(err) }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const completionRate = counts.total > 0 ? Math.round((counts.complete / counts.total) * 100) : 0

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">온라인 상품 관리</h1>
          <p className="text-sm text-gray-500 mt-1">발매 일정 관리 · 상세페이지 자동화 · AI 상품설명 생성</p>
        </div>
        <div className="flex gap-2">
          {tab === 'detail' && (
            <>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" /> 엑셀 템플릿
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Upload className="w-4 h-4" /> 엑셀 업로드
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
            </>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('schedule')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-all ${
            tab === 'schedule' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <CalendarDays className="w-4 h-4" /> 발매 일정
        </button>
        <button onClick={() => setTab('detail')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-all ${
            tab === 'detail' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <FileImage className="w-4 h-4" /> 상세페이지 생성
        </button>
      </div>

      {/* 공통 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={brand} onChange={e => setBrand(e.target.value)}
            className="text-sm border-none focus:ring-0 bg-transparent">
            <option value="all">전체 브랜드</option>
            {Object.entries(BRAND_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="2026">2026</option><option value="2025">2025</option>
        </select>
        <select value={season} onChange={e => setSeason(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">전체 시즌</option>
          <option value="상반기">상반기</option><option value="스탠다드">스탠다드</option>
          <option value="콜라보">콜라보</option><option value="하반기">하반기</option>
        </select>
        <div className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-gray-400 mt-0.5" />
          <textarea placeholder="상품코드 검색 (여러개 붙여넣기 가능)&#10;예: CO2601CR01, CO2601JK01"
            value={search} onChange={e => setSearch(e.target.value)}
            rows={search.includes('\n') || search.includes(',') ? 3 : 1}
            className="text-sm border-none focus:ring-0 bg-transparent w-full resize-none leading-5" />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {tab === 'detail' && selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">{selected.size}개 선택</span>
            <button onClick={handleAiBulk} disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'AI 생성 중...' : 'AI 설명 일괄 생성'}
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════ 발매 일정 탭 ═══════════════════ */}
      {tab === 'schedule' && (
        <div className="space-y-4">
          {/* 요약 + 일괄 발매일 지정 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-center">
                <p className="text-xl font-bold text-pink-600">{scheduledItems.length}</p>
                <p className="text-[10px] text-pink-500">등록</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-500">{unscheduledItems.length}</p>
                <p className="text-[10px] text-gray-400">미등록</p>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-lg px-4 py-2">
                <span className="text-sm text-pink-700 font-medium">{selected.size}개 선택</span>
                <input type="date" value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="text-sm border border-pink-300 rounded-lg px-2 py-1" />
                <button onClick={handleBulkLaunch} disabled={!bulkDate}
                  className="px-3 py-1 text-sm bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50">
                  일괄 적용
                </button>
              </div>
            )}
          </div>

          {/* 상품 테이블 (발매일 인라인 편집) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-3 text-left w-10">
                      <input type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-gray-300" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">브랜드</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">상품코드</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">상품명</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">품목</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">컬러</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">정가</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">발주수량</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">차수</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-pink-600 bg-pink-50">발매일</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">데이터 로딩 중...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">상품이 없습니다</td></tr>
                  ) : (
                    filtered.map((p, i) => {
                      const key = `${p.stylecd}_${p.colorcd}`
                      const launchDate = (p.manual as Record<string, string>)?.launch_date || ''

                      return (
                        <tr key={`${key}_${i}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selected.has(key)}
                              onChange={() => toggleOne(key)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS[p.brandcd] }} />
                              {BRAND_NAMES[p.brandcd]}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-800">{p.stylecd}</td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-900 max-w-[180px] truncate">{p.stylenm}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{p.itemnm}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{p.colornm || p.colorcd}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-800">{p.tagprice?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-800">{p.ordqty?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{p.chasu || '—'}</td>
                          <td className="px-3 py-2 bg-pink-50/50">
                            <input type="date" value={launchDate}
                              onChange={async (e) => {
                                await fetch('/api/online/product', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd,
                                    launch_date: e.target.value, status: 'planning',
                                  }),
                                })
                                fetchProducts()
                              }}
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 w-[130px] bg-white" />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>총 {filtered.length}개 상품</span>
              <span>
                발주 합계: {filtered.reduce((s, p) => s + p.ordqty, 0).toLocaleString()}pcs ·
                발주 금액: {(filtered.reduce((s, p) => s + p.ordqty * p.tagprice, 0) / 100000000).toFixed(1)}억원
              </span>
            </div>
          </div>

          {/* 캘린더 미니뷰 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-gray-900">{monthLabel} 발매 캘린더</h3>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-px mb-1">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day, idx) => {
                const isToday = day.date > 0 &&
                  calMonth.year === new Date().getFullYear() &&
                  calMonth.month === new Date().getMonth() &&
                  day.date === new Date().getDate()
                return (
                  <div key={idx} className={`min-h-[60px] p-1 border border-gray-100 rounded ${
                    day.date === 0 ? 'bg-gray-50' : ''
                  } ${isToday ? 'ring-1 ring-pink-500' : ''}`}>
                    {day.date > 0 && (
                      <>
                        <span className={`text-[10px] ${isToday ? 'text-pink-600 font-bold' : 'text-gray-500'}`}>{day.date}</span>
                        {day.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[9px] px-0.5 py-px rounded truncate"
                            style={{ backgroundColor: `${BRAND_COLORS[item.brandcd]}15`, color: BRAND_COLORS[item.brandcd] }}>
                            {item.stylenm}
                          </div>
                        ))}
                        {day.items.length > 2 && (
                          <span className="text-[9px] text-gray-400">+{day.items.length - 2}</span>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════ 상세페이지 생성 탭 ═══════════════════ */}
      {tab === 'detail' && (
        <DetailPageGenerator products={products} brand={brand} />
      )}
    </div>
  )
}

// ═══════════════════ 상세페이지 생성 컴포넌트 ═══════════════════
type MatchedProduct = {
  stylecd: string; colorcd: string; brandcd: string;
  stylenm: string; colornm: string; itemnm: string;
  tagprice: number; sizes: string;
  images: File[];
  imageUrls: string[]; // 미리보기용 blob URL
}

function DetailPageGenerator({ products, brand }: { products: Product[]; brand: string }) {
  const [dragOver, setDragOver] = useState(false)
  const [matched, setMatched] = useState<MatchedProduct[]>([])
  const [unmatched, setUnmatched] = useState<{ file: File; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  // 파일명에서 품번+컬러 파싱
  // 패턴1: CO2601SH01BL (폴더명 스타일, 10자리 품번 + 2자리 컬러)
  // 패턴2: CO2602ST01E_C_1.jpg (파일명 스타일)
  const parseCode = (filename: string): { stylecd: string; colorcd: string } | null => {
    const name = filename.replace(/\.[^.]+$/, '') // 확장자 제거

    // 패턴: CO2601SH01BL 또는 CO2601SH01BL_C_1
    const match = name.match(/^([A-Z]{2}\d{4}[A-Z]{2}\d{2}[A-Z0-9]*)([A-Z]{2})(?:_|$)/)
    if (match) {
      return { stylecd: match[1], colorcd: match[2] }
    }

    // 폴더명 그대로인 경우 (마지막 2자리가 컬러)
    const simple = name.match(/^([A-Z]{2}\d{4}[A-Z0-9]+?)([A-Z]{2})$/)
    if (simple) {
      // products에서 매칭 확인
      const found = products.find(p =>
        p.stylecd === simple[1] && p.colorcd === simple[2]
      )
      if (found) return { stylecd: simple[1], colorcd: simple[2] }
    }

    // products 리스트에서 파일명이 stylecd+colorcd로 시작하는지 확인
    for (const p of products) {
      const combined = p.stylecd + p.colorcd
      if (name.toUpperCase().startsWith(combined.toUpperCase())) {
        return { stylecd: p.stylecd, colorcd: p.colorcd }
      }
    }

    return null
  }

  // 이미지 파일 처리
  const processFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const groupMap = new Map<string, File[]>()
    const unmatchedFiles: { file: File; name: string }[] = []

    for (const file of fileArr) {
      // webkitRelativePath에서 폴더명 추출 시도
      const pathParts = file.webkitRelativePath?.split('/') || []
      let parsed = null

      if (pathParts.length >= 2) {
        // 폴더명으로 매칭 시도
        parsed = parseCode(pathParts[pathParts.length - 2])
      }
      if (!parsed) {
        // 파일명으로 매칭 시도
        parsed = parseCode(file.name)
      }

      if (parsed) {
        const key = `${parsed.stylecd}_${parsed.colorcd}`
        const list = groupMap.get(key) || []
        list.push(file)
        groupMap.set(key, list)
      } else {
        unmatchedFiles.push({ file, name: file.name })
      }
    }

    // products와 매칭
    const matchedList: MatchedProduct[] = []
    groupMap.forEach((files, key) => {
      const [stylecd, colorcd] = key.split('_')
      const product = products.find(p => p.stylecd === stylecd && p.colorcd === colorcd)
      matchedList.push({
        stylecd,
        colorcd,
        brandcd: product?.brandcd || stylecd.substring(0, 2),
        stylenm: product?.stylenm || stylecd,
        colornm: product?.colornm || colorcd,
        itemnm: product?.itemnm || '',
        tagprice: product?.tagprice || 0,
        sizes: product?.sizes || '',
        images: files,
        imageUrls: files.map(f => URL.createObjectURL(f)),
      })
    })

    setMatched(prev => {
      // 기존에 있는 것에 추가
      const existing = new Map(prev.map(m => [`${m.stylecd}_${m.colorcd}`, m]))
      matchedList.forEach(m => {
        const key = `${m.stylecd}_${m.colorcd}`
        if (existing.has(key)) {
          const ex = existing.get(key)!
          ex.images = [...ex.images, ...m.images]
          ex.imageUrls = [...ex.imageUrls, ...m.imageUrls]
        } else {
          existing.set(key, m)
        }
      })
      return Array.from(existing.values())
    })
    setUnmatched(prev => [...prev, ...unmatchedFiles])
  }

  // 드래그앤드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
    e.target.value = ''
  }

  // Supabase에 일괄 업로드 + 저장
  const handleBulkUpload = async () => {
    if (matched.length === 0) return
    setUploading(true)
    try {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase-browser')
      const supabase = createSupabaseBrowserClient()

      for (const item of matched) {
        const urls: string[] = []
        for (const file of item.images) {
          const path = `product-images/${item.brandcd}/${item.stylecd}/${item.colorcd}/thumb_${Date.now()}_${file.name}`
          const { error } = await supabase.storage.from('product-images').upload(path, file)
          if (!error) {
            const { data } = supabase.storage.from('product-images').getPublicUrl(path)
            urls.push(data.publicUrl)
          }
        }

        // Supabase에 이미지 URL 저장
        if (urls.length > 0) {
          await fetch('/api/online/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stylecd: item.stylecd, colorcd: item.colorcd, brandcd: item.brandcd,
              thumbnail_urls: urls,
              status: 'design',
            }),
          })
        }
      }
      setUploadDone(true)
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  // 상품 제거
  const removeMatched = (idx: number) => {
    setMatched(prev => {
      const item = prev[idx]
      item.imageUrls.forEach(u => URL.revokeObjectURL(u))
      return prev.filter((_, i) => i !== idx)
    })
  }

  return (
    <div className="space-y-4">
      {/* 드래그앤드롭 영역 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => imgInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-pink-500' : 'text-gray-300'}`} />
        <p className="text-sm font-medium text-gray-700 mb-1">이미지 파일을 드래그하거나 클릭하여 선택</p>
        <p className="text-xs text-gray-400">
          파일명 규칙: <span className="font-mono bg-gray-100 px-1 rounded">CO2601SH01BL_C_1.jpg</span> (품번+컬러코드)
          <br />여러 상품 이미지를 한번에 업로드하면 자동으로 매칭됩니다
        </p>
        <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={handleFileSelect} />
      </div>

      {/* 매칭 결과 요약 */}
      {(matched.length > 0 || unmatched.length > 0) && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 font-medium">{matched.length}개 상품 매칭</span>
            <span className="text-xs text-emerald-500">({matched.reduce((s, m) => s + m.images.length, 0)}장)</span>
          </div>
          {unmatched.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700">{unmatched.length}개 매칭 실패</span>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setMatched([]); setUnmatched([]); setUploadDone(false) }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">초기화</button>
            <button onClick={handleBulkUpload} disabled={uploading || uploadDone}
              className="px-4 py-2 text-sm bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50">
              {uploading ? '업로드 중...' : uploadDone ? '업로드 완료' : `${matched.length}개 상품 일괄 업로드`}
            </button>
          </div>
        </div>
      )}

      {/* 매칭된 상품 미리보기 그리드 */}
      {matched.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {matched.map((item, idx) => (
            <div key={`${item.stylecd}_${item.colorcd}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
              {/* 대표 이미지 */}
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {item.imageUrls[0] && (
                  <img src={item.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeMatched(idx)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3.5 h-3.5" />
                </button>
                {item.images.length > 1 && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full">
                    +{item.images.length - 1}장
                  </span>
                )}
              </div>
              {/* 상품 정보 */}
              <div className="p-3">
                <p className="text-[10px] text-gray-400 font-mono">{item.stylecd} · {item.colorcd}</p>
                <p className="text-sm font-medium text-gray-900 truncate">{item.stylenm}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{item.colornm}</span>
                  <span className="text-xs font-medium">{item.tagprice?.toLocaleString()}원</span>
                </div>
                {/* 이미지 썸네일 */}
                {item.imageUrls.length > 1 && (
                  <div className="flex gap-1 mt-2 overflow-x-auto">
                    {item.imageUrls.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 매칭 실패 파일 */}
      {unmatched.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-700 mb-2">매칭 실패 ({unmatched.length}개)</h3>
          <p className="text-xs text-amber-600 mb-2">파일명에서 상품코드를 인식하지 못했습니다. 파일명 규칙: 품번+컬러코드</p>
          <div className="flex flex-wrap gap-1">
            {unmatched.map((u, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded">{u.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {matched.length === 0 && unmatched.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          이미지를 업로드하면 파일명에서 상품코드를 자동 인식하여<br />
          상품별로 그룹핑하고 상세페이지를 생성합니다
        </div>
      )}
    </div>
  )
}
