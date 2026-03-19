'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Paintbrush, Search, Filter, X, ClipboardPaste, Download, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react'
import { BRAND_NAMES } from '@/lib/constants'

type ProductItem = {
  stylecd: string; stylenm: string; brandcd: string; colorcd: string;
  colornm: string; itemnm: string; tagprice: number; ordqty: number;
  sizes: string; manual: Record<string, unknown> | null;
}

const FIT_OPTIONS = ['레귤러핏', '세미 오버핏', '오버핏', '슬림핏', '릴렉스핏']

export default function DesignPage() {
  const [items, setItems] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [brand, setBrand] = useState('all')
  const [year, setYear] = useState('2026')
  const [season, setSeason] = useState('')
  const [search, setSearch] = useState('')

  // 붙여넣기
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteField, setPasteField] = useState<string>('product_description')
  const [pasteResult, setPasteResult] = useState<{ matched: number; fail: number } | null>(null)

  // 인라인 편집 확장
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // AI 일괄 생성
  const [aiLoading, setAiLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ brand, year, season })
      const res = await fetch(`/api/online/products?${params}`)
      const data = await res.json()
      if (!data.error) {
        setItems(data.products || [])
        setSearched(true)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brand, year, season])

  // 검색 필터
  const filtered = items.filter(p => {
    if (!search) return true
    const terms = search.split(/[,\n\t\r;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return true
    const combined = (p.stylecd + p.colorcd).toLowerCase()
    return terms.some(q =>
      p.stylecd.toLowerCase().includes(q) || combined.includes(q) ||
      p.stylenm.toLowerCase().includes(q) || p.colornm.toLowerCase().includes(q)
    )
  })

  // 저장
  const saveField = async (stylecd: string, colorcd: string, brandcd: string, field: string, value: unknown) => {
    await fetch('/api/online/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stylecd, colorcd, brandcd, [field]: value }),
    })
  }

  // 붙여넣기 처리
  const handlePaste = async () => {
    if (!pasteText.trim()) return
    const lines = pasteText.split('\n').filter(l => l.trim())
    const updates: Record<string, unknown>[] = []

    for (const line of lines) {
      const cols = line.split('\t').map(s => s.trim())
      let stylecd = '', colorcd = '', value = ''

      if (cols.length >= 3) {
        stylecd = cols[0]; colorcd = cols[1]; value = cols[2]
      } else if (cols.length === 2) {
        const code = cols[0]; value = cols[1]
        const found = items.find(i => (i.stylecd + i.colorcd).toLowerCase() === code.toLowerCase())
        if (found) { stylecd = found.stylecd; colorcd = found.colorcd }
        else { stylecd = code.slice(0, -2); colorcd = code.slice(-2) }
      }

      if (stylecd && value) {
        const item = items.find(i => i.stylecd === stylecd && i.colorcd === colorcd)
        updates.push({
          stylecd, colorcd, brandcd: item?.brandcd || stylecd.substring(0, 2),
          [pasteField]: pasteField === 'selling_points' ? value.split('|').map(s => s.trim()) : value,
        })
      }
    }

    if (updates.length === 0) return
    try {
      const res = await fetch('/api/online/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      const data = await res.json()
      setPasteResult({ matched: data.successCount || 0, fail: data.failCount || 0 })
      setPasteText('')
      fetchData()
    } catch (err) { console.error(err) }
  }

  // AI 일괄 생성
  const handleAiBulk = async () => {
    if (selected.size === 0) return
    setAiLoading(true)
    try {
      const selProducts = filtered
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
        body: JSON.stringify({ products: selProducts }),
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
            }
          }).filter(Boolean)

        if (updates.length > 0) {
          await fetch('/api/online/product', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: updates }),
          })
        }
        alert(`AI 설명 생성 완료: ${data.results.filter((r: { success: boolean }) => r.success).length}건`)
        setSelected(new Set())
        fetchData()
      }
    } catch (err) { console.error(err) }
    finally { setAiLoading(false) }
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => `${p.stylecd}_${p.colorcd}`)))
  }

  const getManual = (p: ProductItem, key: string) => (p.manual as Record<string, string>)?.[key] || ''

  // 엑셀 여러 행 붙여넣기: 현재 행부터 아래로 분배
  const handleCellPaste = async (e: React.ClipboardEvent, rowIdx: number, field: string) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
    if (lines.length <= 1) return // 한 줄이면 기본 동작

    e.preventDefault() // 기본 붙여넣기 막기

    const updates: Record<string, unknown>[] = []
    for (let i = 0; i < lines.length; i++) {
      const targetIdx = rowIdx + i
      if (targetIdx >= filtered.length) break
      const p = filtered[targetIdx]
      const value = field === 'selling_points'
        ? lines[i].split('|').map(s => s.trim()).filter(Boolean)
        : lines[i]
      updates.push({
        stylecd: p.stylecd, colorcd: p.colorcd, brandcd: p.brandcd,
        [field]: value,
      })
    }

    if (updates.length > 0) {
      await fetch('/api/online/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      alert(`${updates.length}건 붙여넣기 완료`)
      fetchData()
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">디자인 상품정보 입력</h1>
          <p className="text-sm text-gray-500 mt-1">상품설명 · 셀링포인트 · 핏 · AI 자동생성</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaste(!showPaste)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${
              showPaste ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-gray-300 hover:bg-gray-50'
            }`}>
            <ClipboardPaste className="w-4 h-4" /> 붙여넣기
          </button>
        </div>
      </div>

      {/* 붙여넣기 패널 */}
      {showPaste && (
        <div className="bg-white rounded-xl border-2 border-violet-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">엑셀 붙여넣기</h3>
            <button onClick={() => { setShowPaste(false); setPasteResult(null) }}
              className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">입력할 항목:</span>
            <select value={pasteField} onChange={e => setPasteField(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="product_description">상품설명 (디자인팀)</option>
              <option value="product_description_online">상품설명 (온라인팀 문장형)</option>
              <option value="selling_points">셀링포인트 (|로 구분)</option>
              <option value="fit_type">핏</option>
              <option value="product_name_kr">제품명 (한글)</option>
              <option value="product_name_en">제품명 (영어)</option>
              <option value="designer_name">담당 디자이너</option>
            </select>
          </div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder={"품번\t컬러코드\t상품설명\nCO2601CR01\tBK\t레귤러 핏으로 착용되며..."}
            rows={5}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono resize-none" />
          <div className="flex items-center gap-3">
            <button onClick={handlePaste} disabled={!pasteText.trim()}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">적용</button>
            {pasteResult && (
              <span className="text-sm text-gray-600">
                {pasteResult.matched}건 적용{pasteResult.fail > 0 && `, ${pasteResult.fail}건 실패`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 필터 */}
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
          <option value="봄">봄</option><option value="여름">여름</option>
          <option value="가을">가을</option><option value="겨울">겨울</option>
        </select>
        <button onClick={fetchData}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">조회</button>

        <div className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 mt-0.5" />
          <textarea placeholder="품번, 상품명 검색 (여러개 붙여넣기 가능)"
            value={search} onChange={e => setSearch(e.target.value)}
            rows={search.includes('\n') ? 3 : 1}
            className="text-sm border-none focus:ring-0 bg-transparent w-full resize-none leading-5" />
          {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">{selected.size}개 선택</span>
            <button onClick={handleAiBulk} disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              <Sparkles className="w-4 h-4" /> {aiLoading ? 'AI 생성 중...' : 'AI 설명 일괄 생성'}
            </button>
          </div>
        )}
      </div>

      {/* 상품 리스트 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 상단 건수 */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            총 <b>{filtered.length}</b>/{items.length} 건
          </span>
          <span className="text-xs text-gray-500">
            입력완료 {filtered.filter(p => getManual(p, 'product_description')).length}건 ·
            미입력 {filtered.filter(p => !getManual(p, 'product_description')).length}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-2 py-2 w-8">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">스타일넘버</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">상품명</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">컬러</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">상태</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">제품명(한)</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">제품명(영)</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">핏</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">상품설명</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">셀링포인트</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600">디자이너</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">로딩 중...</td></tr>
              ) : !searched ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">브랜드/시즌을 선택하고 조회 버튼을 눌러주세요</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">상품이 없습니다</td></tr>
              ) : (
                filtered.map((p, i) => {
                  const key = `${p.stylecd}_${p.colorcd}`
                  const desc = getManual(p, 'product_description')
                  const sp = (p.manual as Record<string, string[]>)?.selling_points || []
                  const hasDesc = !!desc

                  return (
                    <tr key={`${key}_${i}`}
                      className={`border-b border-gray-200 hover:bg-gray-50 align-top ${expandedRow === key ? 'bg-violet-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selected.has(key)}
                          onChange={() => {
                            const next = new Set(selected)
                            next.has(key) ? next.delete(key) : next.add(key)
                            setSelected(next)
                          }} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-800">{p.stylecd}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-900">{p.stylenm}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{p.colornm || p.colorcd}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs ${hasDesc ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {hasDesc ? '입력완료' : '미입력'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {getManual(p, 'product_name_kr') || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {getManual(p, 'product_name_en') || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {getManual(p, 'fit_type') || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[250px] truncate cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {desc || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {sp.length > 0 ? `${sp.length}개` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer" onClick={() => setExpandedRow(key)}>
                        {getManual(p, 'designer_name') || <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 행 클릭 시 편집 패널 */}
        {expandedRow && (() => {
          const idx = filtered.findIndex(p => `${p.stylecd}_${p.colorcd}` === expandedRow)
          const p = filtered[idx]
          if (!p) return null
          const desc = getManual(p, 'product_description')
          const sp = (p.manual as Record<string, string[]>)?.selling_points || []
          return (
            <form key={expandedRow} className="border-t-2 border-violet-300 bg-violet-50/40 p-5"
              onSubmit={async (e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const spText = fd.get('selling_points') as string
                const sellingPoints = spText ? spText.split('\n').map(s => s.trim()).filter(Boolean) : []
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'product_name_kr', fd.get('product_name_kr') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'product_name_en', fd.get('product_name_en') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'fit_type', fd.get('fit_type') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'designer_name', fd.get('designer_name') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'product_description', fd.get('product_description') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'selling_points', sellingPoints)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'product_description_online', fd.get('product_description_online') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'size_spec', fd.get('size_spec') as string)
                await saveField(p.stylecd, p.colorcd, p.brandcd, 'detail_shot_code', fd.get('detail_shot_code') as string)
                alert('저장 완료')
                fetchData()
              }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm font-bold text-gray-900">{p.stylenm}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.stylecd}{p.colorcd} · {p.colornm} · {p.itemnm}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit"
                    className="px-4 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium">
                    저장
                  </button>
                  <button type="button" onClick={() => setExpandedRow(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">제품명 (한글)</label>
                  <input name="product_name_kr" type="text" defaultValue={getManual(p, 'product_name_kr')} placeholder="온라인용 제품명"
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">제품명 (영어)</label>
                  <input name="product_name_en" type="text" defaultValue={getManual(p, 'product_name_en')} placeholder="PRODUCT NAME"
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">핏</label>
                  <select name="fit_type" defaultValue={getManual(p, 'fit_type')}
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">선택</option>
                    {FIT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">담당 디자이너</label>
                  <input name="designer_name" type="text" defaultValue={getManual(p, 'designer_name')} placeholder="이름"
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">디테일 설명 (디자인팀)</label>
                  <textarea name="product_description" rows={5} defaultValue={desc}
                    placeholder="- 레귤러 핏&#10;- 가슴 심볼 로고 프린트&#10;- YKK 나일론 2WAY 지퍼"
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white resize-none leading-relaxed" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">셀링포인트 (줄바꿈 구분)</label>
                  <textarea name="selling_points" rows={5} defaultValue={sp.join('\n')}
                    placeholder="셀링포인트 1&#10;셀링포인트 2&#10;셀링포인트 3"
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white resize-none leading-relaxed" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">디테일 설명2 (온라인팀 문장형)</label>
                  <textarea name="product_description_online" rows={3} defaultValue={getManual(p, 'product_description_online')}
                    placeholder="레귤러 핏으로 착용되며..."
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white resize-none leading-relaxed" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block font-semibold">사이즈 스펙</label>
                    <input name="size_spec" type="text" defaultValue={getManual(p, 'size_spec')} placeholder="사이즈 정보"
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block font-semibold">디테일컷 코드</label>
                    <input name="detail_shot_code" type="text" defaultValue={getManual(p, 'detail_shot_code')} placeholder="BW-T02"
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white" />
                  </div>
                </div>
              </div>
            </form>
          )
        })()}
      </div>
    </div>
  )
}
