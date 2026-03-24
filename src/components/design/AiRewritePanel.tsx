'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Copy, Check, RotateCcw } from 'lucide-react'

type RewriteResult = {
  material_analysis: string
  description_rewrite: string
  selling_points_rewrite: string[]
  care_tip: string
}

type Props = {
  stylenm: string
  itemnm: string
  brandcd: string
  tagprice: number
  fitType: string
  materialMix: string
  description: string
  sellingPoints: string[]
  onApply: (fields: {
    product_description_online: string
    selling_points_online: string[]
    material_analysis: string
    care_tip: string
  }) => void
}

export function AiRewritePanel({
  stylenm, itemnm, brandcd, tagprice, fitType,
  materialMix, description, sellingPoints, onApply,
}: Props) {
  const [result, setResult] = useState<RewriteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editSp, setEditSp] = useState<string[]>([])

  const hasInput = description || sellingPoints.length > 0 || materialMix

  const handleRewrite = async () => {
    if (!hasInput) return
    setLoading(true)
    try {
      const res = await fetch('/api/online/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_description: description,
          selling_points: sellingPoints,
          material_mix: materialMix,
          stylenm, itemnm, brandcd, tagprice, fit_type: fitType,
        }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      setResult(data)
      setEditDesc(data.description_rewrite)
      setEditSp(data.selling_points_rewrite)
    } catch (err) {
      console.error(err)
      alert('AI 변환 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleApply = () => {
    onApply({
      product_description_online: editDesc,
      selling_points_online: editSp,
      material_analysis: result?.material_analysis || '',
      care_tip: result?.care_tip || '',
    })
  }

  // 미입력 상태
  if (!hasInput) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs p-4">
        <div className="text-center space-y-2">
          <Sparkles className="w-6 h-6 mx-auto text-gray-300" />
          <p>좌측에 상품설명, 셀링포인트 또는<br />혼용율을 입력하면 AI 변환이 가능합니다</p>
        </div>
      </div>
    )
  }

  // 변환 전
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-3">
        <Sparkles className="w-8 h-8 text-violet-400" />
        <p className="text-xs text-gray-500 text-center">
          디자이너 입력을 소비자 신뢰감 강화 버전으로<br />변환합니다
        </p>
        <button
          onClick={handleRewrite}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI 변환
        </button>
      </div>
    )
  }

  // 변환 결과
  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-violet-600 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI 신뢰감 강화 버전
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRewrite}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-violet-600 hover:bg-violet-50 rounded-md"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            재생성
          </button>
        </div>
      </div>

      {/* 소재 분석 */}
      {result.material_analysis && (
        <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-blue-700">소재 특성 분석</span>
            <button onClick={() => handleCopy(result.material_analysis, 'mat')}
              className="text-blue-400 hover:text-blue-600">
              {copied === 'mat' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-wrap">{result.material_analysis}</p>
        </div>
      )}

      {/* 상품설명 리라이트 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-500">상품설명 (소비자 신뢰 ver.)</span>
          <button onClick={() => handleCopy(editDesc, 'desc')}
            className="text-gray-400 hover:text-gray-600">
            {copied === 'desc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <textarea
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          rows={5}
          className="w-full text-xs border border-violet-200 rounded-lg px-3 py-2 bg-violet-50/50 resize-none leading-relaxed focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
        />
      </div>

      {/* 셀링포인트 리라이트 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-500">셀링포인트 (소비자 신뢰 ver.)</span>
          <button onClick={() => handleCopy(editSp.join('\n'), 'sp')}
            className="text-gray-400 hover:text-gray-600">
            {copied === 'sp' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        {editSp.map((sp, i) => (
          <div key={i} className="flex items-start gap-1.5 mb-1">
            <span className="text-[10px] text-violet-400 mt-2 shrink-0">•</span>
            <input
              value={sp}
              onChange={e => {
                const next = [...editSp]
                next[i] = e.target.value
                setEditSp(next)
              }}
              className="flex-1 text-xs border border-violet-200 rounded-md px-2 py-1.5 bg-violet-50/50 focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
            />
          </div>
        ))}
      </div>

      {/* 관리 팁 */}
      {result.care_tip && (
        <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-amber-700">세탁/관리 팁</span>
            <button onClick={() => handleCopy(result.care_tip, 'care')}
              className="text-amber-400 hover:text-amber-600">
              {copied === 'care' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">{result.care_tip}</p>
        </div>
      )}

      {/* 적용 버튼 */}
      <button
        onClick={handleApply}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
      >
        <Check className="w-4 h-4" /> 온라인용 설명에 적용
      </button>
    </div>
  )
}
