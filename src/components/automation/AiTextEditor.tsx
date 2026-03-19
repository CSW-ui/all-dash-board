'use client'

import { useState } from 'react'
import { useAiGenerate } from '@/hooks/useAiGenerate'
import { Sparkles, Copy, RefreshCw, Check, Loader2 } from 'lucide-react'

const CONTENT_TYPES = [
  { value: 'sns', label: 'SNS 카피' },
  { value: 'email', label: '이메일' },
  { value: 'product', label: '상품 설명' },
  { value: 'report', label: '보고서 요약' },
]

const TONES = ['공식적', '캐주얼', '설득력 있는', '친근한']
const LENGTHS = ['짧게', '보통', '길게']

interface AiTextEditorProps {
  defaultType?: string
}

export function AiTextEditor({ defaultType = 'sns' }: AiTextEditorProps) {
  const [prompt, setPrompt] = useState('')
  const [contentType, setContentType] = useState(defaultType)
  const [tone, setTone] = useState('캐주얼')
  const [length, setLength] = useState('보통')
  const [copied, setCopied] = useState(false)
  const { output, isGenerating, generate, reset } = useAiGenerate()

  const handleGenerate = () => {
    generate(prompt, contentType)
  }

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border bg-surface-subtle flex items-center gap-2">
        <Sparkles size={16} className="text-brand-accent" />
        <h3 className="text-sm font-semibold text-gray-800">AI 텍스트 생성</h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Content Type */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">콘텐츠 유형</label>
          <div className="flex gap-2 flex-wrap">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  contentType === ct.value
                    ? 'bg-brand-accent text-white border-brand-accent'
                    : 'bg-white text-gray-600 border-surface-border hover:border-brand-accent/50'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">프롬프트</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="어떤 내용을 작성할까요? 예) 봄 신상 출시 SNS 게시물, 할인 이벤트 이메일..."
            rows={3}
            className="w-full text-sm border border-surface-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-gray-700 placeholder-gray-400"
          />
        </div>

        {/* Options */}
        <div className="flex gap-6">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">톤</label>
            <div className="flex gap-1.5 flex-wrap">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    tone === t
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-surface-border hover:border-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">길이</label>
            <div className="flex gap-1.5">
              {LENGTHS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    length === l
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-surface-border hover:border-gray-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              AI로 생성하기
            </>
          )}
        </button>

        {/* Output */}
        {(output || isGenerating) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">생성된 내용</label>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copied ? '복사됨' : '복사'}
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <RefreshCw size={13} />
                  초기화
                </button>
              </div>
            </div>
            <div className="bg-surface-subtle rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap min-h-[120px] border border-surface-border leading-relaxed">
              {output}
              {isGenerating && <span className="animate-pulse text-brand-accent">|</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
