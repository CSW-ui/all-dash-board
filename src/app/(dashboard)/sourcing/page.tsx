'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Truck, Search, Filter, AlertTriangle, Upload, Download, X, ClipboardPaste
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { BRAND_NAMES } from '@/lib/constants'

type SourcingItem = {
  stylecd: string; colorcd: string; brandcd: string;
  stylenm: string; colornm: string; itemnm: string;
  orignnm: string; prodnm: string;
  chasuCnt: number; firstDelidt: string; lastDelidt: string;
  tagprice: number; precost: number;
  orderQty: number; receivedQty: number; receiveRate: number;
  firstInboundDate: string; lastInboundDate: string;
  confirmedDueDate: string; photoSampleDate: string; sampleDeliveryDate: string; delayDays: number;
  delivery: string; sourcingMd: string; vendor: string; country: string;
  materialMix: string; washCode: string; remark: string; isClosed: boolean;
  progress: number; stage: string; hasManual: boolean;
}

type Summary = {
  total: number; waiting: number; inProgress: number;
  received: number; sampleReady: number; delayed: number;
}

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  '대기': { color: '#6b7280', bg: '#f3f4f6' },
  '원단입고': { color: '#d97706', bg: '#fef3c7' },
  '재단완료': { color: '#2563eb', bg: '#dbeafe' },
  '봉제완료': { color: '#7c3aed', bg: '#ede9fe' },
  '완성': { color: '#0891b2', bg: '#cffafe' },
  '선적': { color: '#ea580c', bg: '#ffedd5' },
  '입고완료': { color: '#059669', bg: '#d1fae5' },
}

export default function SourcingPage() {
  const [items, setItems] = useState<SourcingItem[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, waiting: 0, inProgress: 0, received: 0, sampleReady: 0, delayed: 0 })
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [brand, setBrand] = useState('all')
  const [year, setYear] = useState('2026')
  const [season, setSeason] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadResult, setUploadResult] = useState<{ success: number; fail: number } | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteField, setPasteField] = useState<'material_mix' | 'wash_code' | 'confirmed_due_date' | 'sample_arrival_date' | 'remark'>('material_mix')
  const [pasteResult, setPasteResult] = useState<{ matched: number; notFound: number } | null>(null)

  // 붙여넣기 처리: 엑셀에서 "품번 \t 컬러코드 \t 값" 또는 "품번+컬러코드 \t 값" 형태
  const handlePaste = async () => {
    if (!pasteText.trim()) return
    const lines = pasteText.split('\n').filter(l => l.trim())
    const updates: Record<string, unknown>[] = []

    for (const line of lines) {
      const cols = line.split('\t').map(s => s.trim())
      let stylecd = '', colorcd = '', value = ''

      if (cols.length >= 3) {
        // 품번 \t 컬러코드 \t 값
        stylecd = cols[0]; colorcd = cols[1]; value = cols[2]
      } else if (cols.length === 2) {
        // 품번+컬러코드(합쳐진) \t 값
        const code = cols[0]
        value = cols[1]
        // 상품 리스트에서 매칭 시도
        const found = items.find(i => (i.stylecd + i.colorcd).toLowerCase() === code.toLowerCase())
        if (found) {
          stylecd = found.stylecd; colorcd = found.colorcd
        } else {
          // 마지막 2자리를 컬러코드로 추정
          stylecd = code.slice(0, -2); colorcd = code.slice(-2)
        }
      }

      if (stylecd && value) {
        // 브랜드 찾기
        const item = items.find(i => i.stylecd === stylecd && i.colorcd === colorcd)
        const brandcd = item?.brandcd || stylecd.substring(0, 2)

        updates.push({
          stylecd, colorcd, brandcd,
          [pasteField]: value,
        })
      }
    }

    if (updates.length === 0) return

    try {
      const res = await fetch('/api/online/sourcing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      const data = await res.json()
      setPasteResult({ matched: data.success, notFound: data.fail })
      setPasteText('')
      fetchData()
    } catch (err) { console.error(err) }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ brand, year, season })
      const res = await fetch(`/api/online/sourcing?${params}`)
      const data = await res.json()
      if (!data.error) {
        setItems(data.items || [])
        setSummary(data.summary || { total: 0, waiting: 0, inProgress: 0, received: 0, sampleReady: 0, delayed: 0 })
        setSearched(true)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brand, year, season])

  // 검색 + 단계 필터
  const filtered = items.filter(si => {
    if (stageFilter) {
      if (stageFilter === 'delayed' && si.delayDays <= 0) return false
      if (stageFilter === 'sample' && !si.photoSampleDate) return false
      if (stageFilter === 'progress' && ['대기', '입고완료'].includes(si.stage)) return false
      if (!['delayed', 'sample', 'progress', ''].includes(stageFilter) && si.stage !== stageFilter) return false
    }
    if (!search) return true
    const terms = search.split(/[,\n\t\r;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return true
    const combined = (si.stylecd + si.colorcd).toLowerCase()
    return terms.some(q =>
      si.stylecd.toLowerCase().includes(q) || combined.includes(q) ||
      si.stylenm.toLowerCase().includes(q) ||
      (si.vendor || '').toLowerCase().includes(q) ||
      (si.sourcingMd || '').toLowerCase().includes(q)
    )
  })

  // 엑셀 다운로드
  const handleDownload = () => {
    const rows = filtered.map(si => ({
      '브랜드': BRAND_NAMES[si.brandcd] || si.brandcd,
      '품번': si.stylecd, '컬러': si.colorcd, '컬러명': si.colornm,
      '품명': si.stylenm, '품목': si.itemnm,
      '딜리버리': si.delivery, '소싱MD': si.sourcingMd,
      '협력사': si.vendor, '생산국': si.country,
      '발주수량': si.orderQty, '입고량': si.receivedQty,
      '입고율': `${si.receiveRate}%`,
      '확정납기': si.confirmedDueDate, '샘플입수일': si.photoSampleDate,
      '진행단계': si.stage, '진행률': `${si.progress}%`,
      '지연일': si.delayDays, '혼용률': si.materialMix, '세탁코드': si.washCode,
      '특이사항': si.remark,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '소싱현황')
    XLSX.writeFile(wb, `소싱현황_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 엑셀 업로드 (소싱팀이 납기/샘플/진행상태 업데이트)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      const uploadItems = rows.map(row => ({
        stylecd: row['품번'], colorcd: row['컬러'],
        brandcd: Object.entries(BRAND_NAMES).find(([, v]) => v === row['브랜드'])?.[0] || row['브랜드'],
        confirmed_due_date: row['확정납기'] || undefined,
        photo_sample_date: row['샘플입수일'] || undefined,
        delivery: row['딜리버리'] || undefined,
        sourcing_md: row['소싱MD'] || undefined,
        vendor: row['협력사'] || undefined,
        country: row['생산국'] || undefined,
        material_mix: row['혼용률'] || undefined,
        wash_code: row['세탁코드'] || undefined,
        remark: row['특이사항'] || undefined,
      })).filter(item => item.stylecd && item.colorcd && item.brandcd)

      try {
        const res = await fetch('/api/online/sourcing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: uploadItems }),
        })
        const data = await res.json()
        setUploadResult({ success: data.success, fail: data.fail })
        fetchData()
      } catch (err) { console.error(err) }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">소싱 현황</h1>
          <p className="text-sm text-gray-500 mt-1">
            발주/입고: Snowflake 자동 · 납기/샘플/진행상태: 소싱팀 입력
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaste(!showPaste)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${
              showPaste ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
            }`}>
            <ClipboardPaste className="w-4 h-4" /> 붙여넣기
          </button>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Upload className="w-4 h-4" /> 엑셀 업로드
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-green-800">업로드 완료: {uploadResult.success}건 성공, {uploadResult.fail}건 실패</span>
          <button onClick={() => setUploadResult(null)} className="text-green-600 text-sm">닫기</button>
        </div>
      )}

      {/* 붙여넣기 패널 */}
      {showPaste && (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">엑셀 붙여넣기</h3>
            <button onClick={() => { setShowPaste(false); setPasteResult(null) }}
              className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">입력할 항목:</span>
            <select value={pasteField} onChange={e => setPasteField(e.target.value as typeof pasteField)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="material_mix">혼용률</option>
              <option value="wash_code">세탁코드</option>
              <option value="confirmed_due_date">예상납기</option>
              <option value="sample_arrival_date">샘플전달예정</option>
              <option value="remark">지연사유</option>
            </select>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1">
              엑셀에서 <b>품번 · 컬러코드 · 값</b> 3열을 복사하거나, <b>품번+컬러코드 · 값</b> 2열을 복사해서 붙여넣기
            </p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder={"CO2601CR01\tBK\t겉감,면,100%\nCO2601CR01\tCH\t겉감,면,55%,폴리에스터,45%"}
              rows={5}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePaste} disabled={!pasteText.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              적용
            </button>
            {pasteResult && (
              <span className="text-sm text-gray-600">
                {pasteResult.matched}건 적용 완료{pasteResult.notFound > 0 && `, ${pasteResult.notFound}건 실패`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { key: '', label: '전체', value: summary.total, color: '#374151', bg: '#f3f4f6' },
          { key: '대기', label: '대기', value: summary.waiting, color: '#6b7280', bg: '#f9fafb' },
          { key: 'progress', label: '진행중', value: summary.inProgress, color: '#2563eb', bg: '#dbeafe' },
          { key: '입고완료', label: '입고완료', value: summary.received, color: '#059669', bg: '#d1fae5' },
          { key: 'sample', label: '샘플 확보', value: summary.sampleReady, color: '#7c3aed', bg: '#ede9fe' },
          { key: 'delayed', label: '지연', value: summary.delayed, color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <button key={c.label}
            onClick={() => setStageFilter(stageFilter === c.key ? '' : c.key)}
            className={`p-3 rounded-lg text-center border-2 transition-all ${
              stageFilter === c.key ? 'border-gray-900 shadow-md' : 'border-transparent'
            }`}
            style={{ backgroundColor: c.bg }}>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[10px]" style={{ color: c.color }}>{c.label}</p>
          </button>
        ))}
      </div>

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
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <select value={season} onChange={e => setSeason(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">전체 시즌</option>
          <option value="봄">봄</option>
          <option value="여름">여름</option>
          <option value="가을">가을</option>
          <option value="겨울">겨울</option>
        </select>
        <button onClick={fetchData}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">
          조회
        </button>
        <div className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 mt-0.5" />
          <textarea placeholder="품번, 품명, 협력사, 담당MD 검색 (여러개 붙여넣기 가능)"
            value={search} onChange={e => setSearch(e.target.value)}
            rows={search.includes('\n') || search.includes(',') ? 3 : 1}
            className="text-sm border-none focus:ring-0 bg-transparent w-full resize-none leading-5" />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">브랜드</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">품번</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">품명</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">컬러</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">협력사</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600">차수</th>
                <th className="px-2 py-2.5 text-right font-semibold text-gray-600">발주</th>
                <th className="px-2 py-2.5 text-right font-semibold text-gray-600">입고</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600">입고율</th>
                <th className="px-2 py-2.5 text-center font-semibold text-orange-600 bg-orange-50">예상납기</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600">최초입고</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600">완전입고</th>
                <th className="px-2 py-2.5 text-center font-semibold text-gray-600">지연</th>
                <th className="px-2 py-2.5 text-left font-semibold text-gray-600">지연사유</th>
                <th className="px-2 py-2.5 text-center font-semibold text-violet-600 bg-violet-50">샘플전달예정</th>
                <th className="px-2 py-2.5 text-left font-semibold text-blue-600 bg-blue-50">혼용률</th>
                <th className="px-2 py-2.5 text-left font-semibold text-blue-600 bg-blue-50">세탁코드</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={16} className="text-center py-12 text-gray-400">
                  {!searched ? '브랜드/시즌을 선택하고 조회 버튼을 눌러주세요' : items.length === 0 ? '해당 조건의 상품이 없습니다' : '검색 결과가 없습니다'}
                </td></tr>
              ) : (
                filtered.map((si, i) => {
                  // 지연일 계산: 예상납기 vs 최초입고 (또는 오늘)
                  let delayDays = 0
                  let delayColor = ''
                  if (si.confirmedDueDate) {
                    const due = new Date(si.confirmedDueDate)
                    const actual = si.firstInboundDate ? new Date(si.firstInboundDate) : new Date()
                    delayDays = Math.round((actual.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
                    if (si.receiveRate === 0 && !si.firstInboundDate) {
                      // 아직 입고 안됨 — 오늘 기준 지연 체크
                      delayColor = delayDays > 0 ? 'text-red-600' : 'text-gray-400'
                    } else {
                      delayColor = delayDays > 0 ? 'text-red-600' : delayDays < 0 ? 'text-emerald-600' : 'text-gray-400'
                    }
                  }

                  return (
                    <tr key={`${si.stylecd}_${si.colorcd}_${i}`}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${delayDays > 0 ? 'bg-red-50/30' : ''}`}>
                      <td className="px-2 py-2 text-gray-600">{BRAND_NAMES[si.brandcd] || si.brandcd}</td>
                      <td className="px-2 py-2 font-mono text-gray-800">{si.stylecd}</td>
                      <td className="px-2 py-2 text-gray-900 max-w-[140px] truncate">{si.stylenm}</td>
                      <td className="px-2 py-2 text-gray-600">{si.colornm || si.colorcd}</td>
                      <td className="px-2 py-2 text-gray-600 max-w-[100px] truncate">{si.vendor || '—'}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{si.chasuCnt}차</td>
                      <td className="px-2 py-2 text-right text-gray-800">{si.orderQty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right text-gray-800">{si.receivedQty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-medium ${si.receiveRate >= 100 ? 'text-emerald-600' : si.receiveRate > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {si.receiveRate}%
                        </span>
                      </td>
                      {/* 예상납기 (소싱팀 입력) */}
                      <td className="px-2 py-2 bg-orange-50/50">
                        <input type="date" value={si.confirmedDueDate}
                          onChange={async (e) => {
                            await fetch('/api/online/sourcing', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ items: [{
                                stylecd: si.stylecd, colorcd: si.colorcd, brandcd: si.brandcd,
                                confirmed_due_date: e.target.value,
                              }] }),
                            })
                            fetchData()
                          }}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[120px] bg-white" />
                      </td>
                      {/* 최초입고 (Snowflake 자동) */}
                      <td className="px-2 py-2 text-center text-xs text-gray-700">
                        {si.firstInboundDate || <span className="text-gray-300">—</span>}
                      </td>
                      {/* 완전입고 (입고율 100% 시 마지막 입고일) */}
                      <td className="px-2 py-2 text-center text-xs">
                        {si.receiveRate >= 100 ? (
                          <span className="text-emerald-600 font-medium">{si.lastInboundDate}</span>
                        ) : si.receivedQty > 0 ? (
                          <span className="text-blue-500">{si.receiveRate}% 진행</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* 지연일수 (예상납기 vs 최초입고/오늘) */}
                      <td className="px-2 py-2 text-center">
                        {si.confirmedDueDate ? (
                          <span className={`text-xs font-medium ${delayColor}`}>
                            {delayDays > 0 ? (
                              <span className="inline-flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" />+{delayDays}일
                              </span>
                            ) : delayDays < 0 ? (
                              `${delayDays}일`
                            ) : '정시'}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* 지연사유 (소싱팀 입력) */}
                      <td className="px-2 py-2">
                        <input type="text" defaultValue={si.remark}
                          placeholder={delayDays > 0 ? '사유 입력' : ''}
                          onBlur={async (e) => {
                            if (e.target.value !== si.remark) {
                              await fetch('/api/online/sourcing', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ items: [{
                                  stylecd: si.stylecd, colorcd: si.colorcd, brandcd: si.brandcd,
                                  remark: e.target.value,
                                }] }),
                              })
                              fetchData()
                            }
                          }}
                          className={`text-xs border rounded px-1 py-0.5 w-full bg-white ${
                            delayDays > 0 && !si.remark ? 'border-red-300' : 'border-gray-200'
                          }`} />
                      </td>
                      {/* 샘플전달예정 */}
                      <td className="px-2 py-2 bg-violet-50/50">
                        <input type="date" value={si.sampleDeliveryDate || ''}
                          onChange={async (e) => {
                            await fetch('/api/online/sourcing', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ items: [{
                                stylecd: si.stylecd, colorcd: si.colorcd, brandcd: si.brandcd,
                                sample_arrival_date: e.target.value,
                              }] }),
                            })
                            fetchData()
                          }}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[120px] bg-white" />
                      </td>
                      {/* 혼용률 */}
                      <td className="px-2 py-2 bg-blue-50/30">
                        <input type="text" defaultValue={si.materialMix} placeholder="겉감,면,100%"
                          onBlur={async (e) => {
                            if (e.target.value !== si.materialMix) {
                              await fetch('/api/online/sourcing', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ items: [{
                                  stylecd: si.stylecd, colorcd: si.colorcd, brandcd: si.brandcd,
                                  material_mix: e.target.value,
                                }] }),
                              })
                              fetchData()
                            }
                          }}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[140px] bg-white" />
                      </td>
                      {/* 세탁코드 */}
                      <td className="px-2 py-2 bg-blue-50/30">
                        <input type="text" defaultValue={si.washCode} placeholder="BK-T02"
                          onBlur={async (e) => {
                            if (e.target.value !== si.washCode) {
                              await fetch('/api/online/sourcing', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ items: [{
                                  stylecd: si.stylecd, colorcd: si.colorcd, brandcd: si.brandcd,
                                  wash_code: e.target.value,
                                }] }),
                              })
                              fetchData()
                            }
                          }}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[80px] bg-white" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>총 {filtered.length}개 품번</span>
          <span>
            발주: {filtered.reduce((s, p) => s + (p.orderQty || 0), 0).toLocaleString()}pcs ·
            입고: {filtered.reduce((s, p) => s + (p.receivedQty || 0), 0).toLocaleString()}pcs
          </span>
        </div>
      </div>
    </div>
  )
}
