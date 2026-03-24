'use client'

import { useState } from 'react'
import {
  X, Copy, Check, RefreshCw, Loader2, Sparkles, Save,
  GraduationCap, Globe, FlaskConical, ShieldCheck, ChevronLeft, ChevronRight,
} from 'lucide-react'

type ProductInfo = {
  stylecd: string
  colorcd: string
  brandcd: string
  stylenm: string
  itemnm: string
  colornm: string
  tagprice: number
  material_mix?: string
  product_description?: string
  selling_points?: string[]
  fit_type?: string
}

type AiResult = {
  materialAnalysis: string
  descriptionManager: string
  sellingPointsManager: string[]
  descriptionOnline: string
  sellingPointsOnline: string[]
  seoTags: string[]
  careTip: string
  success: boolean
  raw?: string
  error?: string
}

interface AiDescriptionModalProps {
  products: ProductInfo[]
  onClose: () => void
  onSave: (updates: Record<string, unknown>[]) => Promise<void>
}

export function AiDescriptionModal({ products, onClose, onSave }: AiDescriptionModalProps) {
  const [results, setResults] = useState<(AiResult | null)[]>(products.map(() => null))
  const [loading, setLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<'manager' | 'online'>('manager')
  const [copied, setCopied] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 편집 상태
  const [edits, setEdits] = useState<Record<number, Partial<AiResult>>>({})

  const current = products[currentIdx]
  const currentResult = results[currentIdx]
  const currentEdit = edits[currentIdx] || {}

  // 편집값 우선, 없으면 AI 결과값
  const getValue = (field: keyof AiResult) => {
    if (currentEdit[field] !== undefined) return currentEdit[field]
    if (currentResult) return currentResult[field]
    return ''
  }

  const updateEdit = (field: string, value: unknown) => {
    setEdits(prev => ({
      ...prev,
      [currentIdx]: { ...prev[currentIdx], [field]: value },
    }))
    setSaved(false)
  }

  // AI 생성 실행
  const handleGenerate = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const payload = products.map(p => ({
        stylenm: p.stylenm,
        itemnm: p.itemnm,
        colornm: p.colornm,
        tagprice: p.tagprice,
        material_mix: p.material_mix || '',
        brandcd: p.brandcd,
        product_description: p.product_description || '',
        selling_points: p.selling_points || [],
        fit_type: p.fit_type || '',
      }))

      const res = await fetch('/api/online/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: payload, mode: 'detail' }),
      })
      const data = await res.json()

      if (data.results) {
        setResults(data.results)
        setEdits({})
      }
    } catch (err) {
      console.error('AI 생성 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  // 개별 상품 재생성
  const handleRegenerate = async () => {
    setLoading(true)
    try {
      const p = products[currentIdx]
      const res = await fetch('/api/online/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{
            stylenm: p.stylenm, itemnm: p.itemnm, colornm: p.colornm,
            tagprice: p.tagprice, material_mix: p.material_mix || '',
            brandcd: p.brandcd, product_description: p.product_description || '',
            selling_points: p.selling_points || [], fit_type: p.fit_type || '',
          }],
          mode: 'detail',
        }),
      })
      const data = await res.json()
      if (data.results?.[0]) {
        setResults(prev => {
          const next = [...prev]
          next[currentIdx] = data.results[0]
          return next
        })
        setEdits(prev => {
          const next = { ...prev }
          delete next[currentIdx]
          return next
        })
      }
    } catch (err) {
      console.error('재생성 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  // 전체 저장
  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = products.map((p, i) => {
        const r = results[i]
        const e = edits[i] || {}
        if (!r?.success) return null

        return {
          stylecd: p.stylecd,
          colorcd: p.colorcd,
          brandcd: p.brandcd,
          product_description_manager: e.descriptionManager ?? r.descriptionManager,
          product_description_online: e.descriptionOnline ?? r.descriptionOnline,
          selling_points: e.sellingPointsOnline ?? r.sellingPointsOnline,
          selling_points_manager: e.sellingPointsManager ?? r.sellingPointsManager,
          material_analysis: e.materialAnalysis ?? r.materialAnalysis,
          seo_tags: e.seoTags ?? r.seoTags,
          care_tip: e.careTip ?? r.careTip,
        }
      }).filter(Boolean)

      if (updates.length > 0) {
        await onSave(updates as Record<string, unknown>[])
        setSaved(true)
      }
    } catch (err) {
      console.error('저장 오류:', err)
    } finally {
      setSaving(false)
    }
  }

  // 복사
  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const successCount = results.filter(r => r?.success).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">AI 상세설명 생성</h2>
              <p className="text-xs text-gray-500">{products.length}개 상품 · 소재 특성 분석 + 매니저 교육용 + 온라인 상세페이지</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 생성 전 */}
          {!currentResult && !loading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-50 flex items-center justify-center">
                <FlaskConical className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">소재 분석 기반 AI 상품설명</h3>
              <p className="text-sm text-gray-500 mb-1">선택한 {products.length}개 상품의 소재 특성을 분석하고</p>
              <p className="text-sm text-gray-500 mb-6">매니저 교육용 · 온라인 상세페이지용 설명을 자동 생성합니다</p>

              {/* 선택된 상품 미리보기 */}
              <div className="max-w-md mx-auto mb-6 space-y-1.5">
                {products.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-mono text-gray-400">{p.stylecd}</span>
                    <span className="truncate">{p.stylenm}</span>
                    {p.material_mix && <span className="ml-auto text-violet-500 shrink-0">{p.material_mix}</span>}
                  </div>
                ))}
                {products.length > 5 && (
                  <p className="text-xs text-gray-400">외 {products.length - 5}건</p>
                )}
              </div>

              <button onClick={handleGenerate}
                className="px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 font-medium text-sm inline-flex items-center gap-2 transition-colors">
                <Sparkles className="w-4 h-4" />
                AI 생성 시작
              </button>
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-600 font-medium">소재 특성을 분석하고 설명을 생성하는 중...</p>
              <p className="text-xs text-gray-400 mt-1">상품 수에 따라 10~30초 소요됩니다</p>
            </div>
          )}

          {/* 생성 결과 */}
          {currentResult && !loading && (
            <div className="space-y-5">
              {/* 상품 탐색 */}
              {products.length > 1 && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                    disabled={currentIdx === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <span className="text-xs text-gray-500">{currentIdx + 1} / {products.length}</span>
                    <p className="text-sm font-semibold text-gray-800">{current.stylenm}</p>
                    <p className="text-xs text-gray-400">{current.stylecd}{current.colorcd} · {current.colornm}</p>
                  </div>
                  <button onClick={() => setCurrentIdx(Math.min(products.length - 1, currentIdx + 1))}
                    disabled={currentIdx === products.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* 에러 표시 */}
              {!currentResult.success && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  생성 실패: {currentResult.error || '알 수 없는 오류'}
                </div>
              )}

              {currentResult.success && (
                <>
                  {/* 소재 특성 분석 */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FlaskConical className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">소재 특성 분석</span>
                      <CopyButton text={getValue('materialAnalysis') as string} id="material" copied={copied} onCopy={handleCopy} />
                    </div>
                    <textarea
                      value={getValue('materialAnalysis') as string}
                      onChange={e => updateEdit('materialAnalysis', e.target.value)}
                      rows={3}
                      className="w-full text-sm text-amber-900 bg-transparent border-none resize-none focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* 탭: 매니저 교육용 / 온라인 상세페이지 */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    <button onClick={() => setActiveTab('manager')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'manager'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      <GraduationCap className="w-4 h-4" />
                      매니저 교육용
                    </button>
                    <button onClick={() => setActiveTab('online')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'online'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      <Globe className="w-4 h-4" />
                      온라인 상세페이지
                    </button>
                  </div>

                  {/* 매니저 교육용 */}
                  {activeTab === 'manager' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-semibold text-gray-600">상세 설명 (매니저 교육용)</label>
                          <CopyButton text={getValue('descriptionManager') as string} id="descMgr" copied={copied} onCopy={handleCopy} />
                        </div>
                        <textarea
                          value={getValue('descriptionManager') as string}
                          onChange={e => updateEdit('descriptionManager', e.target.value)}
                          rows={6}
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-700 leading-relaxed"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-semibold text-gray-600">셀링포인트 (매니저용)</label>
                          <CopyButton
                            text={(getValue('sellingPointsManager') as string[])?.join('\n') || ''}
                            id="spMgr" copied={copied} onCopy={handleCopy}
                          />
                        </div>
                        <textarea
                          value={(getValue('sellingPointsManager') as string[])?.join('\n') || ''}
                          onChange={e => updateEdit('sellingPointsManager', e.target.value.split('\n').filter(Boolean))}
                          rows={4}
                          placeholder="줄바꿈으로 구분"
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-700 leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* 온라인 상세페이지 */}
                  {activeTab === 'online' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-semibold text-gray-600">상세 설명 (온라인 상세페이지)</label>
                          <CopyButton text={getValue('descriptionOnline') as string} id="descOnline" copied={copied} onCopy={handleCopy} />
                        </div>
                        <textarea
                          value={getValue('descriptionOnline') as string}
                          onChange={e => updateEdit('descriptionOnline', e.target.value)}
                          rows={6}
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 text-gray-700 leading-relaxed"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-semibold text-gray-600">셀링포인트 (온라인용)</label>
                          <CopyButton
                            text={(getValue('sellingPointsOnline') as string[])?.join('\n') || ''}
                            id="spOnline" copied={copied} onCopy={handleCopy}
                          />
                        </div>
                        <textarea
                          value={(getValue('sellingPointsOnline') as string[])?.join('\n') || ''}
                          onChange={e => updateEdit('sellingPointsOnline', e.target.value.split('\n').filter(Boolean))}
                          rows={4}
                          placeholder="줄바꿈으로 구분"
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 text-gray-700 leading-relaxed"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-2 block">SEO 키워드</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(getValue('seoTags') as string[])?.map((tag, i) => (
                              <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-2 block">관리 팁</label>
                          <p className="text-sm text-gray-600">{getValue('careTip') as string}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        {currentResult && !loading && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <button onClick={handleRegenerate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white text-gray-600 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                현재 상품 재생성
              </button>
              <span className="text-xs text-gray-400">
                {successCount}/{products.length}건 생성 완료
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 저장 완료
                </span>
              )}
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 font-medium text-sm transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? '저장 중...' : '전체 저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 복사 버튼 미니 컴포넌트
function CopyButton({ text, id, copied, onCopy }: {
  text: string; id: string; copied: string | null;
  onCopy: (text: string, key: string) => void
}) {
  return (
    <button onClick={() => onCopy(text, id)}
      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-auto transition-colors">
      {copied === id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied === id ? '복사됨' : '복사'}
    </button>
  )
}
