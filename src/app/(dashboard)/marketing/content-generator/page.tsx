import { AiTextEditor } from '@/components/automation/AiTextEditor'
import { Lightbulb } from 'lucide-react'

const tips = [
  '타겟 고객층과 캠페인 목표를 구체적으로 입력하면 더 정확한 결과를 얻을 수 있어요.',
  '상품명, 할인율, 혜택 등 핵심 정보를 포함해보세요.',
  '생성된 내용은 자유롭게 편집하여 브랜드 톤에 맞게 수정하세요.',
]

export default function ContentGeneratorPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI 콘텐츠 생성</h1>
        <p className="text-sm text-gray-500 mt-0.5">SNS 카피, 이메일, 광고 문구를 AI로 자동 생성</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AiTextEditor defaultType="sns" />
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-surface-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-800">사용 팁</h3>
            </div>
            <ul className="space-y-3">
              {tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600 leading-relaxed">
                  <span className="text-brand-accent font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-brand-accent-light rounded-xl p-5 border border-pink-100">
            <h3 className="text-sm font-semibold text-brand-accent-hover mb-2">Claude AI 연동</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              현재 데모 모드로 동작 중입니다. 실제 Claude API 연동 시 더욱 정교한 콘텐츠를 생성할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
