'use client'

import { useState } from 'react'
import { reportTemplates } from '@/lib/mock-data'
import { BarChart3, Package, Megaphone, GitBranch, TrendingUp, Users, CheckCircle, FileDown, Send, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, Package, Megaphone, GitBranch, TrendingUp, Users,
}

const STEPS = ['템플릿 선택', '파라미터 설정', '미리보기 & 내보내기']

const MOCK_PREVIEW = `# 영업 파이프라인 현황 보고서
**작성일:** 2026년 3월 12일  |  **기간:** 2026년 3월

---

## 핵심 요약

| 지표 | 현재 | 목표 | 달성률 |
|------|------|------|--------|
| 월 매출 | 1억 6,600만원 | 2억원 | 83% |
| 활성 딜 | 47건 | 50건 | 94% |
| 성사율 | 28.4% | 30% | 94.7% |

## 파이프라인 현황

- **잠재고객**: 2건 (총 6,300만원)
- **제안**: 2건 (총 2억 1,500만원)
- **협상**: 2건 (총 2억 9,400만원)
- **성사**: 2건 (총 9,900만원)

## 주요 딜

1. 럭셔리몰 - 2억 1,500만원 (협상 중)
2. Fashion Group - 1억 2,000만원 (제안)
3. ACME Corp - 7,800만원 (협상 중)

## 다음 달 전망

파이프라인 총액 기준 예상 매출: **약 1억 8,000만원**
현재 진행 속도 유지 시 목표 달성 가능성 **높음**`

export function ReportGenerator() {
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('2026-03')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise((r) => setTimeout(r, 1500))
    setIsGenerating(false)
    setGenerated(true)
    setStep(2)
  }

  const template = reportTemplates.find((t) => t.id === selectedTemplate)

  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
      {/* Step Indicator */}
      <div className="px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all',
                  i === step
                    ? 'bg-brand-accent text-white'
                    : i < step
                    ? 'bg-brand-accent-light text-brand-accent-hover cursor-pointer'
                    : 'bg-surface-muted text-gray-400'
                )}
              >
                {i < step ? <CheckCircle size={12} /> : <span>{i + 1}</span>}
                {s}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={14} className="text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* Step 1: Template Selection */}
        {step === 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-4">생성할 보고서 유형을 선택하세요</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reportTemplates.map((t) => {
                const Icon = ICON_MAP[t.icon] ?? BarChart3
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      'text-left p-4 rounded-xl border-2 transition-all',
                      selectedTemplate === t.id
                        ? 'border-brand-accent bg-brand-accent-light'
                        : 'border-surface-border hover:border-brand-accent/40 bg-white'
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                      style={{ background: `${t.color}20` }}
                    >
                      <Icon size={16} style={{ color: t.color }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{t.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                disabled={!selectedTemplate}
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 단계 <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Parameters */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">보고서 기간 및 옵션을 설정하세요</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">보고 기간</label>
                <input
                  type="month"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full text-sm border border-surface-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-gray-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">대상 부서</label>
                <select className="w-full text-sm border border-surface-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-gray-700 bg-white">
                  <option>전체</option>
                  <option>상품기획</option>
                  <option>영업</option>
                  <option>마케팅</option>
                </select>
              </div>
            </div>
            {template && (
              <div className="bg-surface-subtle rounded-lg p-4 border border-surface-border">
                <p className="text-xs font-medium text-gray-600 mb-1">선택된 템플릿</p>
                <p className="text-sm font-semibold text-gray-900">{template.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-surface-border transition-colors">
                이전
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {isGenerating ? '생성 중...' : '보고서 생성'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Export */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-surface-subtle rounded-lg p-5 border border-surface-border max-h-80 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {MOCK_PREVIEW}
              </pre>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-brand-accent text-brand-accent hover:bg-brand-accent-light transition-colors">
                <FileDown size={15} />
                PDF 내보내기
              </button>
              <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-surface-border text-gray-600 hover:bg-surface-subtle transition-colors">
                <Send size={15} />
                Notion에 저장
              </button>
              <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-surface-border text-gray-600 hover:bg-surface-subtle transition-colors">
                <Send size={15} />
                Slack 공유
              </button>
              <button
                onClick={() => { setStep(0); setSelectedTemplate(null); setGenerated(false) }}
                className="ml-auto text-sm text-gray-400 hover:text-gray-600 px-4 py-2 rounded-lg transition-colors"
              >
                새 보고서 생성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
