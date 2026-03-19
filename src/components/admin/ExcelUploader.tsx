'use client'

import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertCircle, Trash2, FileSpreadsheet, Download } from 'lucide-react'
import { useTargetData, MonthlyTarget } from '@/hooks/useTargetData'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

// 엑셀 컬럼명 후보 (대소문자 무관하게 매핑)
// 실제 파일 기준: 년월, 브랜드명, 매출액(원)
const COL_YYYYMM  = ['년월', 'yyyymm', '연월', 'yearmonth', 'year_month']
const COL_BRAND   = ['브랜드명', 'brandnm', 'brand', '브랜드', 'brand_name']
const COL_CHANNEL = ['매장형태', '채널', 'channel', 'shoptypenm', '채널그룹', '채널명', 'channel_type',
  'shoptypecd', 'shoptype', '매장유형', '유통채널']
const COL_SHOPCD  = ['매장코드', 'shopcd', 'shop_cd', '매장CD', '점코드']
const COL_TARGET  = ['매출액(원)', '매출액', 'target', '목표', '목표매출', 'target_amt', 'forecast_amt', '목표금액', '매출금액']

// 매장코드 → 매장형태 변환 (코드로 들어온 경우 자동 매핑)
const SHOPTYPE_CODE_MAP: Record<string, string> = {
  '0': '백화점', '7': '아울렛', 'S': '쇼핑몰', 's': '쇼핑몰',
  'F': '면세점', 'f': '면세점', '1': '직영점', '2': '대리점',
  '5': '오프라인 사입', '6': '오프라인 위탁', '9': '팝업',
  'M': '온라인(무신사)', 'm': '온라인(무신사)',
  '4': '온라인(위탁몰)', '3': '온라인(자사몰)',
  'U': '온라인B2B', 'u': '온라인B2B', 'B': '본사매장', 'b': '본사매장',
  'C': '해외 사입', 'c': '해외 사입', 'D': '해외 위탁', 'd': '해외 위탁',
}
function resolveChannel(raw: string): string {
  const trimmed = raw.trim()
  // 1자리 코드(0,1,2 등)만 변환. 매장코드(C3001 등)는 그대로 유지
  if (trimmed.length <= 1) return SHOPTYPE_CODE_MAP[trimmed] ?? trimmed
  return trimmed
}

function findCol(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().replace(/\s/g, ''))
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase().replace(/\s/g, ''))
    if (idx !== -1) return headers[idx]
  }
  return null
}

interface ParseResult {
  data: MonthlyTarget[]
  warnings: string[]
  filename: string
}

export function ExcelUploader() {
  const { targets, lastUpdated, saveTargets, clearTargets } = useTargetData()
  const [dragOver, setDragOver] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback((file: File) => {
    setError(null)
    setParseResult(null)
    setSaved(false)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: true })

        if (rows.length === 0) {
          setError('시트에 데이터가 없습니다.')
          return
        }

        const headers = Object.keys(rows[0])
        const colYYYYMM  = findCol(headers, COL_YYYYMM)
        const colBrand   = findCol(headers, COL_BRAND)
        const colChannel = findCol(headers, COL_CHANNEL)
        const colShopCd  = findCol(headers, COL_SHOPCD)
        const colTarget  = findCol(headers, COL_TARGET)

        const warnings: string[] = []
        if (!colYYYYMM) warnings.push('년월(YYYYMM) 컬럼을 찾지 못했습니다. 첫 번째 컬럼을 사용합니다.')
        if (!colBrand)  warnings.push('브랜드 컬럼을 찾지 못했습니다. 두 번째 컬럼을 사용합니다.')
        if (!colTarget) warnings.push('목표 컬럼을 찾지 못했습니다. 세 번째 컬럼을 사용합니다.')
        if (colChannel) warnings.push(`채널 컬럼 감지: "${colChannel}" → 채널별 목표 적용`)
        if (colShopCd) warnings.push(`매장코드 컬럼 감지: "${colShopCd}" → 점당 목표 적용`)

        const ym = colYYYYMM ?? headers[0]
        const br = colBrand  ?? headers[1]
        const tg = colTarget ?? (colChannel ? headers[3] : headers[2])

        const parsed: MonthlyTarget[] = []
        for (const row of rows) {
          const yyyymm = String(row[ym] ?? '').replace(/[^0-9]/g, '').slice(0, 6)
          const brandnm = String(row[br] ?? '').trim()
          const target = Number(row[tg] ?? 0)
          const channelRaw = colChannel ? String(row[colChannel] ?? '').trim() : ''
          const channel = channelRaw ? resolveChannel(channelRaw) : ''
          const shopcd = colShopCd ? String(row[colShopCd] ?? '').trim() : ''
          if (yyyymm.length === 6 && brandnm && !isNaN(target)) {
            parsed.push({
              yyyymm, brandnm, target,
              ...(channel ? { shoptypenm: channel } : {}),
              ...(shopcd ? { shopcd } : {}),
            })
          }
        }

        if (parsed.length === 0) {
          setError('유효한 데이터 행이 없습니다. 컬럼명을 확인해주세요.')
          return
        }

        setParseResult({ data: parsed, warnings, filename: file.name })
      } catch (err) {
        setError('파일 파싱 중 오류가 발생했습니다: ' + String(err))
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }

  const handleSave = () => {
    if (!parseResult) return
    saveTargets(parseResult.data, parseResult.filename)
    setSaved(true)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['YYYYMM', 'BRANDNM', '매장형태', 'TARGET'],
      ['202601', '커버낫', '백화점', 5000000000],
      ['202601', '커버낫', '아울렛', 3000000000],
      ['202601', '커버낫', '', 22000000000],  // 매장형태 비우면 브랜드 전체 목표
      ['202601', '리(LEE)', '', 15000000000],
      ['202601', '와키윌리', '', 11000000000],
      ['202601', '커버낫 키즈', '', 3000000000],
      ['202601', 'LEE KIDS', '', 2000000000],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '월별목표매출')
    XLSX.writeFile(wb, 'bcave_월별목표매출_템플릿.xlsx')
  }

  return (
    <div className="space-y-5">
      {/* Template Download */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-5 py-3.5">
        <div>
          <p className="text-sm font-medium text-blue-900">엑셀 템플릿</p>
          <p className="text-xs text-blue-600 mt-0.5">YYYYMM · BRANDNM · TARGET 컬럼 형식으로 업로드하세요</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Download size={13} />
          템플릿 다운로드
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          dragOver
            ? 'border-brand-accent bg-brand-accent-light'
            : 'border-surface-border hover:border-brand-accent/50 hover:bg-surface-subtle'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <FileSpreadsheet size={36} className={cn('mx-auto mb-3', dragOver ? 'text-brand-accent' : 'text-gray-300')} />
        <p className="text-sm font-medium text-gray-700">엑셀 파일을 여기에 드래그하거나 클릭하여 업로드</p>
        <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv 지원</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Parse Result Preview */}
      {parseResult && (
        <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                파싱 완료: {parseResult.filename}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {parseResult.data.length}개 행 · {new Set(parseResult.data.map(d => d.yyyymm)).size}개 월 · {new Set(parseResult.data.map(d => d.brandnm)).size}개 브랜드
              </p>
            </div>
            {saved ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle size={13} /> 저장됨
              </span>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 text-sm font-medium bg-brand-accent text-white px-4 py-2 rounded-lg hover:bg-brand-accent-hover transition-colors"
              >
                <Upload size={14} />
                대시보드에 적용
              </button>
            )}
          </div>

          {parseResult.warnings.length > 0 && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              {parseResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">YYYYMM</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">브랜드</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">매장코드</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">채널</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500">목표금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {parseResult.data.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2 text-gray-700">{row.yyyymm}</td>
                    <td className="px-4 py-2 text-gray-700">{row.brandnm}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono">{row.shopcd || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{row.shoptypenm || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      {(row.target / 100000000).toFixed(1)}억
                    </td>
                  </tr>
                ))}
                {parseResult.data.length > 20 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-center text-gray-400">
                      ... 외 {parseResult.data.length - 20}개 행
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current Saved Data */}
      {targets.length > 0 && (
        <div className="bg-white border border-surface-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">현재 적용된 목표 데이터</p>
              {lastUpdated && (
                <p className="text-xs text-gray-400 mt-0.5">
                  업데이트: {format(new Date(lastUpdated), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                </p>
              )}
            </div>
            <button
              onClick={clearTargets}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              초기화
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from(new Set(targets.map((t) => t.yyyymm))).sort().slice(0, 6).map((ym) => {
              const total = targets.filter((t) => t.yyyymm === ym).reduce((s, t) => s + t.target, 0)
              return (
                <div key={ym} className="bg-surface-subtle rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-500">{ym.slice(0,4)}년 {ym.slice(4)}월</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{(total / 100000000).toFixed(0)}억</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
