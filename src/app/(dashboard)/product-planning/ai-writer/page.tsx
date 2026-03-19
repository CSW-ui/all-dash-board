import { AiTextEditor } from '@/components/automation/AiTextEditor'
import { Lightbulb } from 'lucide-react'

const useCases = [
  { title: '상품 설명 작성', desc: '신상품 상세 페이지 설명 문구 자동 생성' },
  { title: '기획서 초안', desc: '신상품 기획안 초안을 빠르게 작성' },
  { title: '시장 분석 요약', desc: '트렌드 데이터 기반 인사이트 요약 작성' },
]

export default function AiWriterPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI 텍스트 작성</h1>
        <p className="text-sm text-gray-500 mt-0.5">상품 설명, 기획서, 제안서를 AI로 자동 작성</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AiTextEditor defaultType="product" />
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-surface-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-800">활용 사례</h3>
            </div>
            <div className="space-y-3">
              {useCases.map((uc) => (
                <div key={uc.title} className="p-3 bg-surface-subtle rounded-lg">
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{uc.title}</p>
                  <p className="text-xs text-gray-500">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
