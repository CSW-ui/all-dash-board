'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Search, Filter, X, Sparkles, Loader2,
  ChevronLeft, ChevronRight, Copy, Check
} from 'lucide-react'
import { BRAND_NAMES } from '@/lib/constants'
import { AiDescriptionModal } from '@/components/design/AiDescriptionModal'

type ProductItem = {
  stylecd: string; stylenm: string; brandcd: string; colorcd: string;
  colornm: string; itemnm: string; tagprice: number; ordqty: number;
  sizes: string; manual: Record<string, unknown> | null;
}

const FIT_OPTIONS = ['레귤러핏', '세미 오버핏', '오버핏', '슬림핏', '릴렉스핏']
const PAGE_SIZE = 50

type StatusFilter = 'all' | 'empty' | 'done'
type CellRef = { row: number; col: number }

// 컬럼 정의
const COLUMNS = [
  { key: 'product_name_kr', label: '제품명(한)', w: 130, type: 'text', editable: true },
  { key: 'product_name_en', label: '제품명(영)', w: 130, type: 'text', editable: true },
  { key: 'fit_type', label: '핏', w: 100, type: 'select', editable: true },
  { key: 'material_mix', label: '혼용율', w: 140, type: 'text', editable: true },
  { key: 'product_description', label: '상품설명', w: 200, type: 'textarea', editable: true },
  { key: 'selling_points', label: '셀링포인트', w: 200, type: 'textarea', editable: true },
  { key: 'designer_name', label: '디자이너', w: 80, type: 'text', editable: true },
  // AI 자동 생성 컬럼
  { key: '_ai_material', label: '소재분석(AI)', w: 220, type: 'ai', editable: false },
  { key: '_ai_description', label: '상품설명(AI)', w: 250, type: 'ai', editable: false },
  { key: '_ai_selling', label: '셀링포인트(AI)', w: 250, type: 'ai', editable: false },
  { key: '_ai_care', label: '관리팁(AI)', w: 180, type: 'ai', editable: false },
] as const

type ColKey = typeof COLUMNS[number]['key']

// AI 결과 타입
type AiResult = {
  material_analysis: string
  description_rewrite: string
  selling_points_rewrite: string[]
  care_tip: string
}

export default function DesignPage() {
  const [items, setItems] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [brand, setBrand] = useState('all')
  const [year, setYear] = useState('2026')
  const [season, setSeason] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(0)

  // 셀 편집
  const [editCell, setEditCell] = useState<CellRef | null>(null)
  const [editValue, setEditValue] = useState('')

  // AI 상태: key = "stylecd_colorcd"
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>({})
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  // AI 일괄
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAiModal, setShowAiModal] = useState(false)

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ brand, year, season })
      const res = await fetch(`/api/online/products?${params}`)
      const data = await res.json()
      if (!data.error) {
        setItems(data.products || [])
        setSearched(true)
        setEditCell(null)
        setPage(0)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brand, year, season])

  const getManual = (p: ProductItem, key: string): string => {
    if (key === 'selling_points') {
      const arr = (p.manual as Record<string, string[]>)?.[key] || []
      return arr.join('\n')
    }
    return (p.manual as Record<string, string>)?.[key] || ''
  }

  // 필터
  const filtered = items.filter(p => {
    const hasDesc = !!(p.manual as Record<string, string>)?.product_description
    if (statusFilter === 'empty' && hasDesc) return false
    if (statusFilter === 'done' && !hasDesc) return false
    if (!search) return true
    const terms = search.split(/[,\n\t\r;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return true
    const combined = (p.stylecd + p.colorcd).toLowerCase()
    return terms.some(q =>
      p.stylecd.toLowerCase().includes(q) || combined.includes(q) ||
      p.stylenm.toLowerCase().includes(q) || p.colornm.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const doneCount = items.filter(p => !!(p.manual as Record<string, string>)?.product_description).length
  const progressPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0

  // AI 호출
  const triggerAi = useCallback(async (p: ProductItem) => {
    const key = `${p.stylecd}_${p.colorcd}`
    const desc = getManual(p, 'product_description')
    const sp = (p.manual as Record<string, string[]>)?.selling_points || []
    const mix = getManual(p, 'material_mix')

    if (!desc && sp.length === 0 && !mix) return

    setAiLoading(prev => new Set(prev).add(key))

    try {
      const res = await fetch('/api/online/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_description: desc,
          selling_points: sp,
          material_mix: mix,
          stylenm: p.stylenm,
          itemnm: p.itemnm,
          brandcd: p.brandcd,
          tagprice: p.tagprice,
          fit_type: getManual(p, 'fit_type'),
        }),
      })
      const data = await res.json()
      if (!data.error) {
        setAiResults(prev => ({ ...prev, [key]: data }))
      }
    } catch (err) { console.error(err) }
    finally {
      setAiLoading(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  // 셀 편집 시작
  const startEdit = (row: number, col: number) => {
    if (!COLUMNS[col].editable) return
    if (editCell) commitEdit(false)
    const p = paged[row]
    if (!p) return
    setEditCell({ row, col })
    setEditValue(getManual(p, COLUMNS[col].key))
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // 셀 편집 확정
  const commitEdit = useCallback(async (shouldTriggerAi = true) => {
    if (!editCell) return
    const p = paged[editCell.row]
    if (!p) return

    const col = COLUMNS[editCell.col]
    const oldValue = getManual(p, col.key)

    if (editValue !== oldValue) {
      // 로컬 업데이트
      const globalIdx = items.findIndex(i => i.stylecd === p.stylecd && i.colorcd === p.colorcd)
      if (globalIdx >= 0) {
        const updated = [...items]
        const manual = { ...(updated[globalIdx].manual || {}) } as Record<string, unknown>
        if (col.key === 'selling_points') {
          manual[col.key] = editValue.split('\n').map(s => s.trim()).filter(Boolean)
        } else {
          manual[col.key] = editValue
        }
        updated[globalIdx] = { ...updated[globalIdx], manual }
        setItems(updated)

        // 서버 저장
        const saveValue = col.key === 'selling_points'
          ? editValue.split('\n').map(s => s.trim()).filter(Boolean)
          : editValue

        fetch('/api/online/product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd,
            [col.key]: saveValue,
          }),
        }).catch(console.error)

        // AI 트리거: 상품설명, 셀링포인트, 혼용율 변경 시 자동 실행
        if (shouldTriggerAi && ['product_description', 'selling_points', 'material_mix'].includes(col.key)) {
          const updatedProduct = updated[globalIdx]
          setTimeout(() => triggerAi(updatedProduct), 100)
        }
      }
    }

    setEditCell(null)
  }, [editCell, editValue, paged, items, triggerAi])

  // 키보드
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editCell) return
    if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      const dir = e.shiftKey ? -1 : 1
      let nextCol = editCell.col + dir
      // 편집 불가 컬럼 건너뛰기
      while (nextCol >= 0 && nextCol < COLUMNS.length && !COLUMNS[nextCol].editable) nextCol += dir
      if (nextCol >= 0 && nextCol < COLUMNS.length) {
        setTimeout(() => startEdit(editCell.row, nextCol), 0)
      } else if (dir > 0 && editCell.row < paged.length - 1) {
        setTimeout(() => startEdit(editCell.row + 1, 0), 0)
      }
    } else if (e.key === 'Enter' && !e.shiftKey && COLUMNS[editCell.col].type !== 'textarea') {
      e.preventDefault()
      commitEdit()
      if (editCell.row < paged.length - 1) {
        setTimeout(() => startEdit(editCell.row + 1, editCell.col), 0)
      }
    } else if (e.key === 'Escape') {
      setEditCell(null)
    }
  }

  // 붙여넣기
  const handleTablePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!editCell) return
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
    if (lines.length <= 1) return

    e.preventDefault()
    const updates: Record<string, unknown>[] = []
    const updatedItems = [...items]

    for (let i = 0; i < lines.length; i++) {
      const rowIdx = editCell.row + i
      if (rowIdx >= paged.length) break
      const p = paged[rowIdx]
      const cols = lines[i].split('\t')

      for (let c = 0; c < cols.length; c++) {
        const targetCol = editCell.col + c
        if (targetCol >= COLUMNS.length || !COLUMNS[targetCol].editable) break
        const targetKey = COLUMNS[targetCol].key
        const val = cols[c].trim()
        const saveVal = targetKey === 'selling_points'
          ? val.split('|').map(s => s.trim()).filter(Boolean) : val

        const globalIdx = updatedItems.findIndex(it => it.stylecd === p.stylecd && it.colorcd === p.colorcd)
        if (globalIdx >= 0) {
          const manual = { ...(updatedItems[globalIdx].manual || {}) } as Record<string, unknown>
          manual[targetKey] = saveVal
          updatedItems[globalIdx] = { ...updatedItems[globalIdx], manual }
        }
        if (c === 0) {
          updates.push({ stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd, [targetKey]: saveVal })
        } else {
          const last = updates[updates.length - 1]
          if (last) (last as Record<string, unknown>)[targetKey] = saveVal
        }
      }
    }

    setItems(updatedItems)
    setEditCell(null)

    if (updates.length > 0) {
      await fetch('/api/online/product', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
    }
  }, [editCell, paged, items])

  // 복사
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  // AI 일괄 저장
  const handleAiSave = async (updates: Record<string, unknown>[]) => {
    await fetch('/api/online/product', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updates }),
    })
    fetchData()
  }

  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set())
    else setSelected(new Set(paged.map(p => `${p.stylecd}_${p.colorcd}`)))
  }

  // 편집 가능 셀 렌더링
  const renderEditableCell = (rowIdx: number, colIdx: number) => {
    const col = COLUMNS[colIdx]
    const p = paged[rowIdx]
    if (!p) return null
    const isEditing = editCell?.row === rowIdx && editCell?.col === colIdx
    const value = getManual(p, col.key)

    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue} onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit()} onKeyDown={handleKeyDown}
            className="w-full h-full text-xs border-2 border-violet-400 rounded px-1.5 py-1 bg-white focus:outline-none">
            <option value="">선택</option>
            {FIT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )
      }
      if (col.type === 'textarea') {
        return (
          <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue} onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit()} onKeyDown={handleKeyDown} onPaste={handleTablePaste}
            rows={4}
            className="w-full text-xs border-2 border-violet-400 rounded px-1.5 py-1 bg-white focus:outline-none resize-none leading-relaxed" />
        )
      }
      return (
        <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text"
          value={editValue} onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit()} onKeyDown={handleKeyDown} onPaste={handleTablePaste}
          className="w-full h-full text-xs border-2 border-violet-400 rounded px-1.5 py-1 bg-white focus:outline-none" />
      )
    }

    const displayValue = col.key === 'selling_points'
      ? (value.split('\n').filter(Boolean).length > 0 ? `${value.split('\n').filter(Boolean).length}개` : '')
      : value

    return (
      <div onClick={() => startEdit(rowIdx, colIdx)}
        className={`w-full h-full px-1.5 py-1.5 cursor-cell text-xs truncate rounded hover:bg-violet-50 ${!displayValue ? 'text-gray-300' : 'text-gray-800'}`}
        title={value}>
        {displayValue || '—'}
      </div>
    )
  }

  // AI 컬럼 렌더링
  const renderAiCell = (rowIdx: number, colKey: string) => {
    const p = paged[rowIdx]
    if (!p) return null
    const key = `${p.stylecd}_${p.colorcd}`
    const isLoading = aiLoading.has(key)
    const ai = aiResults[key]

    if (isLoading) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-1.5 text-[10px] text-violet-500">
          <Loader2 className="w-3 h-3 animate-spin" /> 생성중...
        </div>
      )
    }

    if (!ai) {
      return <div className="px-1.5 py-1.5 text-[10px] text-gray-300">—</div>
    }

    let text = ''
    let copyKey = ''
    if (colKey === '_ai_material') { text = ai.material_analysis; copyKey = `${key}_mat` }
    else if (colKey === '_ai_description') { text = ai.description_rewrite; copyKey = `${key}_desc` }
    else if (colKey === '_ai_selling') { text = ai.selling_points_rewrite.join('\n'); copyKey = `${key}_sp` }
    else if (colKey === '_ai_care') { text = ai.care_tip; copyKey = `${key}_care` }

    if (!text) return <div className="px-1.5 py-1.5 text-[10px] text-gray-300">—</div>

    return (
      <div className="group relative px-1.5 py-1.5">
        <div className="text-[11px] text-gray-700 leading-relaxed line-clamp-3 whitespace-pre-wrap" title={text}>
          {text}
        </div>
        <button
          onClick={() => handleCopy(text, copyKey)}
          className="absolute top-1 right-1 p-0.5 rounded bg-white/80 border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
          title="복사">
          {copied === copyKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 animate-fade-in h-[calc(100vh-64px)] flex flex-col">
      {/* 헤더 */}
      <div className="shrink-0 space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">디자인 상품정보 입력</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              셀 클릭 → 편집 · Tab 이동 · 상품설명/셀링포인트/혼용율 입력 시 AI 자동 생성
            </p>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              <Sparkles className="w-3.5 h-3.5" /> AI 일괄생성 ({selected.size})
            </button>
          )}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select value={brand} onChange={e => setBrand(e.target.value)}
              className="text-xs border-none focus:ring-0 bg-transparent">
              <option value="all">전체 브랜드</option>
              {Object.entries(BRAND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="2026">2026</option><option value="2025">2025</option>
          </select>
          <select value={season} onChange={e => setSeason(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">전체 시즌</option>
            <option value="봄">봄</option><option value="여름">여름</option>
            <option value="가을">가을</option><option value="겨울">겨울</option>
          </select>
          <button onClick={fetchData}
            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">조회</button>

          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 px-2 py-1.5 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input placeholder="품번, 상품명 검색" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="text-xs border-none focus:ring-0 bg-transparent w-full" />
            {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-gray-400" /></button>}
          </div>

          {/* 상태 필터 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {([['all', '전체'], ['empty', '미입력'], ['done', '완료']] as [StatusFilter, string][]).map(([key, label]) => (
              <button key={key}
                onClick={() => { setStatusFilter(key); setPage(0) }}
                className={`px-2.5 py-1 text-[10px] rounded-md font-medium transition-colors ${
                  statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {searched && items.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[10px] text-gray-500">{doneCount}/{items.length} ({progressPct}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="text-xs border-collapse" style={{ minWidth: '2000px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-1 py-2 w-8 sticky left-0 bg-gray-50 z-20 border-r border-gray-200">
                  <input type="checkbox"
                    checked={selected.size === paged.length && paged.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 w-[100px] sticky left-8 bg-gray-50 z-20 border-r border-gray-200">품번</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 w-[150px]">상품명</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 w-[70px]">컬러</th>
                {COLUMNS.map(col => (
                  <th key={col.key}
                    className={`px-2 py-2 text-left font-semibold ${col.type === 'ai' ? 'text-violet-600 bg-violet-50/50' : 'text-gray-600'}`}
                    style={{ width: col.w, minWidth: col.w }}>
                    {col.type === 'ai' && <Sparkles className="w-3 h-3 inline mr-1" />}
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4 + COLUMNS.length} className="text-center py-16 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />로딩 중...
                </td></tr>
              ) : !searched ? (
                <tr><td colSpan={4 + COLUMNS.length} className="text-center py-16 text-gray-400">
                  조회 버튼을 눌러주세요
                </td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={4 + COLUMNS.length} className="text-center py-16 text-gray-400">
                  상품이 없습니다
                </td></tr>
              ) : (
                paged.map((p, rowIdx) => {
                  const key = `${p.stylecd}_${p.colorcd}`
                  const hasDesc = !!(p.manual as Record<string, string>)?.product_description

                  return (
                    <tr key={`${key}_${rowIdx}`} className="border-b border-gray-100 hover:bg-gray-50/30">
                      <td className="px-1 py-0.5 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <input type="checkbox" checked={selected.has(key)}
                          onChange={() => {
                            const next = new Set(selected)
                            next.has(key) ? next.delete(key) : next.add(key)
                            setSelected(next)
                          }} className="rounded border-gray-300" />
                      </td>
                      <td className="px-2 py-0.5 font-mono text-[10px] text-gray-600 sticky left-8 bg-white z-10 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasDesc ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          {p.stylecd}<span className="text-gray-400">{p.colorcd}</span>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 text-xs text-gray-900 truncate" style={{ maxWidth: 150 }} title={p.stylenm}>
                        {p.stylenm}
                      </td>
                      <td className="px-2 py-0.5 text-xs text-gray-500 truncate">{p.colornm || p.colorcd}</td>
                      {COLUMNS.map((col, colIdx) => (
                        <td key={col.key}
                          className={`px-0.5 py-0.5 ${col.type === 'ai' ? 'bg-violet-50/30' : ''}`}
                          style={{ width: col.w, minWidth: col.w }}>
                          {col.editable
                            ? renderEditableCell(rowIdx, colIdx)
                            : renderAiCell(rowIdx, col.key)
                          }
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 하단 */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            {selected.size > 0 && <span className="text-[10px] text-violet-600 font-medium">{selected.size}개 선택</span>}
            <span className="text-[10px] text-gray-400">← → 스크롤로 AI 생성 결과 확인</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}건
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <span className="text-[10px] text-gray-500 min-w-[40px] text-center">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI 일괄 모달 */}
      {showAiModal && (
        <AiDescriptionModal
          products={filtered
            .filter(p => selected.has(`${p.stylecd}_${p.colorcd}`))
            .map(p => ({
              stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd,
              stylenm: p.stylenm, itemnm: p.itemnm, colornm: p.colornm,
              tagprice: p.tagprice,
              material_mix: (p.manual as Record<string, string>)?.material_mix || '',
              product_description: (p.manual as Record<string, string>)?.product_description || '',
              selling_points: (p.manual as Record<string, string[]>)?.selling_points || [],
              fit_type: (p.manual as Record<string, string>)?.fit_type || '',
            }))}
          onClose={() => setShowAiModal(false)}
          onSave={handleAiSave}
        />
      )}
    </div>
  )
}
