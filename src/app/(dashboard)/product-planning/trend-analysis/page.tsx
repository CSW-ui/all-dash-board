import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { RevenueLineChart } from '@/components/dashboard/RevenueLineChart'
import { productKpis, trendData } from '@/lib/mock-data'

const productMatrix = [
  { name: '2026 S/S 코트', category: '아우터', sales: 1240, margin: 62, trend: 'up' },
  { name: '린넨 셔츠', category: '상의', sales: 2180, margin: 71, trend: 'up' },
  { name: '와이드 팬츠', category: '하의', sales: 1890, margin: 68, trend: 'up' },
  { name: '미니 스커트', category: '하의', sales: 980, margin: 74, trend: 'down' },
  { name: '크롭 니트', category: '상의', sales: 1560, margin: 65, trend: 'neutral' },
]

export default function TrendAnalysisPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">트렌드 분석</h1>
        <p className="text-sm text-gray-500 mt-0.5">시장 트렌드 및 상품 성과 데이터 분석</p>
      </div>

      <KpiGrid metrics={productKpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueLineChart data={trendData} title="월별 판매 수량 트렌드" />

        {/* Product Matrix */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-gray-800">상품별 성과 매트릭스</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-subtle border-b border-surface-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">상품명</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">카테고리</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">판매량</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">마진율</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500">트렌드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {productMatrix.map((p) => (
                  <tr key={p.name} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800 text-xs">{p.name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{p.category}</td>
                    <td className="px-3 py-3 text-right text-xs text-gray-800">{p.sales.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-brand-accent">{p.margin}%</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
                        p.trend === 'down' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {p.trend === 'up' ? '↑ 상승' : p.trend === 'down' ? '↓ 하락' : '→ 유지'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '봄 시즌 린넨 소재 강세', desc: '린넨 소재 상품이 전월 대비 판매량 34% 급증. 2026 S/S 시즌 핵심 소재로 추가 확보 필요.', color: 'border-l-blue-400' },
          { title: '미니 스커트 수요 감소', desc: '미니 스커트 카테고리 판매량이 2개월 연속 하락. 맥시 스커트, 와이드 팬츠로 수요 이동 관측.', color: 'border-l-red-400' },
          { title: '아우터 조기 소진 예상', desc: '코트 재고가 현재 속도로 소진 시 3월 말 이전 품절 예상. 추가 발주 검토 필요.', color: 'border-l-amber-400' },
        ].map((insight) => (
          <div key={insight.title} className={`bg-white rounded-xl p-5 border border-surface-border border-l-4 ${insight.color} shadow-sm`}>
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">{insight.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{insight.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
