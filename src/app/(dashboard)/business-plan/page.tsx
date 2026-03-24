'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Briefcase, Plus, Save, Trash2, RefreshCw, TrendingUp, TrendingDown,
  Store, Package, Receipt, Calculator, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react'
import { BRAND_NAMES, BRAND_COLORS } from '@/lib/constants'

// ── 타입 ──
type Plan = { id: string; year: number; version_name: string; status: string; description: string; created_at: string }
type StoreTarget = {
  id?: string; plan_id: string; brand: string; store_name: string; channel_type: string;
  m1: number; m2: number; m3: number; m4: number; m5: number; m6: number;
  m7: number; m8: number; m9: number; m10: number; m11: number; m12: number;
  annual_target?: number; prev_year_actual: number; memo: string;
}
type OrderPlan = {
  id?: string; plan_id: string; brand: string; season: string; item_category: string;
  plan_amount: number; plan_qty: number; avg_unit_price: number; cost_rate: number;
  cost_amount?: number; memo: string;
}
type SgaItem = {
  id?: string; plan_id: string; category: string; item_name: string;
  cost_type: string; monthly_amount: number; rate_of_sales: number; annual_amount: number; memo: string;
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const CHANNELS = ['백화점', '아울렛', '온라인', '대리점', '직영점']
const SEASONS = ['봄', '여름', '가을', '겨울', '상반기', '스탠다드']
const ITEMS = ['아우터', '상의', '하의', '원피스/스커트', '니트', '셔츠', '데님', '악세서리', '기타']
const SGA_CATEGORIES = ['인건비', '임대료', '마케팅비', '물류비', '수수료', '감가상각', '기타']
const TABS = [
  { key: 'stores', label: '매장별 목표매출', icon: Store },
  { key: 'orders', label: '발주계획', icon: Package },
  { key: 'sga', label: '판관비', icon: Receipt },
  { key: 'pnl', label: '손익 시뮬레이션', icon: Calculator },
]

// 금액 포맷 (만원 단위)
const fmtW = (v: number) => {
  if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (Math.abs(v) >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`
  return v.toLocaleString()
}

export default function BusinessPlanPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [stores, setStores] = useState<StoreTarget[]>([])
  const [orders, setOrders] = useState<OrderPlan[]>([])
  const [sga, setSga] = useState<SgaItem[]>([])
  const [tab, setTab] = useState('stores')
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [saving, setSaving] = useState(false)

  // ── 계획 목록 조회 ──
  const fetchPlans = useCallback(async () => {
    const res = await fetch(`/api/business-plan?year=${year}`)
    const data = await res.json()
    setPlans(data.plans || [])
  }, [year])

  // ── 계획 상세 로드 ──
  const loadPlan = useCallback(async (planId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/business-plan?id=${planId}`)
      const data = await res.json()
      setCurrentPlan(data.plan)
      setStores(data.stores || [])
      setOrders(data.orders || [])
      setSga(data.sga || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  // ── 새 계획 생성 ──
  const createPlan = async () => {
    const res = await fetch('/api/business-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, version_name: `${year}년 사업계획` }),
    })
    const data = await res.json()
    if (data.plan) {
      await fetchPlans()
      loadPlan(data.plan.id)
    }
  }

  // ── 저장 ──
  const saveData = async (type: string, items: unknown[]) => {
    setSaving(true)
    try {
      await fetch('/api/business-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, items }),
      })
      if (currentPlan) await loadPlan(currentPlan.id)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  // ── 매장 추가 ──
  const addStore = () => {
    if (!currentPlan) return
    setStores(prev => [...prev, {
      plan_id: currentPlan.id, brand: 'CO', store_name: '', channel_type: '백화점',
      m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0,
      m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0,
      prev_year_actual: 0, memo: '',
    }])
  }

  // ── 발주 추가 ──
  const addOrder = () => {
    if (!currentPlan) return
    setOrders(prev => [...prev, {
      plan_id: currentPlan.id, brand: 'CO', season: '봄', item_category: '아우터',
      plan_amount: 0, plan_qty: 0, avg_unit_price: 0, cost_rate: 40, memo: '',
    }])
  }

  // ── 판관비 추가 ──
  const addSga = () => {
    if (!currentPlan) return
    setSga(prev => [...prev, {
      plan_id: currentPlan.id, category: '기타', item_name: '',
      cost_type: '고정', monthly_amount: 0, rate_of_sales: 0, annual_amount: 0, memo: '',
    }])
  }

  // ── 손익 계산 ──
  const pnl = useMemo(() => {
    // 브랜드별 목표매출 합계
    const brandRevenue: Record<string, number> = {}
    stores.forEach(s => {
      const total = s.m1 + s.m2 + s.m3 + s.m4 + s.m5 + s.m6 + s.m7 + s.m8 + s.m9 + s.m10 + s.m11 + s.m12
      brandRevenue[s.brand] = (brandRevenue[s.brand] || 0) + total
    })
    const totalRevenue = Object.values(brandRevenue).reduce((a, b) => a + b, 0)

    // 매출원가 (발주계획 기반)
    let totalCOGS = 0
    orders.forEach(o => {
      totalCOGS += Math.round(o.plan_amount * o.cost_rate / 100)
    })

    // 매출총이익
    const grossProfit = totalRevenue - totalCOGS
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0

    // 판관비
    let totalFixedSga = 0
    let totalVariableSga = 0
    sga.forEach(s => {
      if (s.cost_type === '고정') {
        totalFixedSga += s.monthly_amount * 12
      } else {
        totalVariableSga += Math.round(totalRevenue * s.rate_of_sales / 100)
      }
    })
    const totalSga = totalFixedSga + totalVariableSga

    // 영업이익
    const operatingProfit = grossProfit - totalSga
    const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue * 100) : 0

    // 월별 매출
    const monthlyRevenue = MONTHS.map((_, i) => {
      let total = 0
      stores.forEach(s => { total += (s as Record<string, number>)[`m${i + 1}`] || 0 })
      return total
    })

    return {
      brandRevenue, totalRevenue, totalCOGS, grossProfit, grossMargin,
      totalFixedSga, totalVariableSga, totalSga, operatingProfit, operatingMargin,
      monthlyRevenue,
    }
  }, [stores, orders, sga])

  // ── 매장 삭제 ──
  const removeStore = (idx: number) => setStores(prev => prev.filter((_, i) => i !== idx))
  const removeOrder = (idx: number) => setOrders(prev => prev.filter((_, i) => i !== idx))
  const removeSga = (idx: number) => setSga(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사업계획</h1>
          <p className="text-sm text-gray-500 mt-1">매장목표 → 발주계획 → 판관비 → 손익 자동 시뮬레이션</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
          <button onClick={fetchPlans}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">조회</button>
          <button onClick={createPlan}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> 새 계획
          </button>
        </div>
      </div>

      {/* 계획 목록 */}
      {!currentPlan && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {plans.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">사업계획이 없습니다. 조회 버튼을 누르거나 새 계획을 생성하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map(p => (
                <button key={p.id} onClick={() => loadPlan(p.id)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{p.version_name}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        p.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>{p.status === 'confirmed' ? '확정' : p.status === 'draft' ? '작성중' : '보관'}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 계획 상세 */}
      {currentPlan && (
        <>
          {/* 상단 바 */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentPlan(null)} className="text-sm text-gray-500 hover:text-gray-700">← 목록</button>
              <span className="text-sm font-bold text-gray-900">{currentPlan.version_name}</span>
            </div>
            <div className="flex items-center gap-2">
              {saving && <span className="text-xs text-blue-500">저장 중...</span>}
            </div>
          </div>

          {/* 손익 요약 카드 */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: '목표매출', value: pnl.totalRevenue, color: '#2563eb' },
              { label: '매출원가', value: pnl.totalCOGS, color: '#dc2626' },
              { label: '매출총이익', value: pnl.grossProfit, color: '#059669', sub: `${pnl.grossMargin.toFixed(1)}%` },
              { label: '판관비', value: pnl.totalSga, color: '#d97706' },
              { label: '영업이익', value: pnl.operatingProfit, color: pnl.operatingProfit >= 0 ? '#059669' : '#dc2626', sub: `${pnl.operatingMargin.toFixed(1)}%` },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-[11px] text-gray-500">{c.label}</p>
                <p className="text-lg font-bold mt-1" style={{ color: c.color }}>{fmtW(c.value)}</p>
                {c.sub && <p className="text-xs text-gray-400 mt-0.5">이익률 {c.sub}</p>}
              </div>
            ))}
          </div>

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-all ${
                  tab === t.key ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* ── 매장별 목표매출 ── */}
            {tab === 'stores' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">매장별 월별 목표매출</span>
                  <div className="flex gap-2">
                    <button onClick={addStore}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Plus className="w-3 h-3" /> 매장 추가
                    </button>
                    <button onClick={() => saveData('stores', stores)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      <Save className="w-3 h-3" /> 저장
                    </button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">브랜드</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-28">매장명</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">채널</th>
                        {MONTHS.map(m => (
                          <th key={m} className="px-1 py-2 text-right font-semibold text-gray-600 w-20">{m}</th>
                        ))}
                        <th className="px-2 py-2 text-right font-semibold text-blue-600 bg-blue-50 w-24">연간합계</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-500 w-24">전년실적</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-500 w-16">성장률</th>
                        <th className="px-1 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((s, i) => {
                        const annual = s.m1+s.m2+s.m3+s.m4+s.m5+s.m6+s.m7+s.m8+s.m9+s.m10+s.m11+s.m12
                        const growth = s.prev_year_actual > 0 ? ((annual / s.prev_year_actual - 1) * 100) : 0
                        return (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1.5">
                              <select value={s.brand} onChange={e => {
                                const next = [...stores]; next[i] = { ...s, brand: e.target.value }; setStores(next)
                              }} className="text-xs border border-gray-200 rounded px-1 py-1 w-full bg-white">
                                {Object.entries(BRAND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={s.store_name} placeholder="매장명"
                                onChange={e => { const next = [...stores]; next[i] = { ...s, store_name: e.target.value }; setStores(next) }}
                                className="text-xs border border-gray-200 rounded px-2 py-1 w-full bg-white" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={s.channel_type} onChange={e => {
                                const next = [...stores]; next[i] = { ...s, channel_type: e.target.value }; setStores(next)
                              }} className="text-xs border border-gray-200 rounded px-1 py-1 w-full bg-white">
                                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            {MONTHS.map((_, mi) => {
                              const mKey = `m${mi + 1}` as keyof StoreTarget
                              return (
                                <td key={mi} className="px-1 py-1.5">
                                  <input type="number" value={s[mKey] as number || ''}
                                    onChange={e => {
                                      const next = [...stores]
                                      next[i] = { ...s, [mKey]: Number(e.target.value) || 0 }
                                      setStores(next)
                                    }}
                                    className="text-xs border border-gray-200 rounded px-1 py-1 w-full text-right bg-white" />
                                </td>
                              )
                            })}
                            <td className="px-2 py-1.5 text-right font-bold text-blue-600 bg-blue-50/50">
                              {fmtW(annual)}
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" value={s.prev_year_actual || ''}
                                onChange={e => { const next = [...stores]; next[i] = { ...s, prev_year_actual: Number(e.target.value) || 0 }; setStores(next) }}
                                className="text-xs border border-gray-200 rounded px-1 py-1 w-full text-right bg-white" />
                            </td>
                            <td className={`px-2 py-1.5 text-center text-xs font-medium ${growth > 0 ? 'text-emerald-600' : growth < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {s.prev_year_actual > 0 ? `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-1 py-1.5">
                              <button onClick={() => removeStore(i)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {stores.length > 0 && (
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={3} className="px-2 py-2 text-xs font-bold text-gray-700">합계</td>
                          {MONTHS.map((_, mi) => {
                            const mKey = `m${mi + 1}` as keyof StoreTarget
                            const total = stores.reduce((sum, s) => sum + ((s[mKey] as number) || 0), 0)
                            return <td key={mi} className="px-1 py-2 text-right text-xs font-bold text-gray-700">{fmtW(total)}</td>
                          })}
                          <td className="px-2 py-2 text-right text-xs font-bold text-blue-700 bg-blue-50">{fmtW(pnl.totalRevenue)}</td>
                          <td className="px-2 py-2 text-right text-xs font-bold text-gray-500">
                            {fmtW(stores.reduce((s, st) => s + (st.prev_year_actual || 0), 0))}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ── 발주계획 ── */}
            {tab === 'orders' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">브랜드/시즌별 발주계획</span>
                  <div className="flex gap-2">
                    <button onClick={addOrder}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Plus className="w-3 h-3" /> 항목 추가
                    </button>
                    <button onClick={() => saveData('orders', orders)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      <Save className="w-3 h-3" /> 저장
                    </button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">브랜드</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">시즌</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">품목</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">기획금액</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">기획수량</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">평균단가</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">원가율%</th>
                        <th className="px-2 py-2 text-right font-semibold text-red-600 bg-red-50">매출원가</th>
                        <th className="px-1 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <select value={o.brand} onChange={e => { const next = [...orders]; next[i] = { ...o, brand: e.target.value }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 bg-white">
                              {Object.entries(BRAND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={o.season} onChange={e => { const next = [...orders]; next[i] = { ...o, season: e.target.value }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 bg-white">
                              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={o.item_category} onChange={e => { const next = [...orders]; next[i] = { ...o, item_category: e.target.value }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 bg-white">
                              {ITEMS.map(it => <option key={it} value={it}>{it}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={o.plan_amount || ''} onChange={e => { const next = [...orders]; next[i] = { ...o, plan_amount: Number(e.target.value) || 0 }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 w-28 text-right bg-white" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={o.plan_qty || ''} onChange={e => { const next = [...orders]; next[i] = { ...o, plan_qty: Number(e.target.value) || 0 }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 w-20 text-right bg-white" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={o.avg_unit_price || ''} onChange={e => { const next = [...orders]; next[i] = { ...o, avg_unit_price: Number(e.target.value) || 0 }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 w-20 text-right bg-white" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={o.cost_rate || ''} step="0.1" onChange={e => { const next = [...orders]; next[i] = { ...o, cost_rate: Number(e.target.value) || 0 }; setOrders(next) }}
                              className="text-xs border border-gray-200 rounded px-1 py-1 w-16 text-right bg-white" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-red-600 bg-red-50/50">
                            {fmtW(Math.round(o.plan_amount * o.cost_rate / 100))}
                          </td>
                          <td className="px-1 py-1.5">
                            <button onClick={() => removeOrder(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {orders.length > 0 && (
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={3} className="px-2 py-2 text-xs font-bold text-gray-700">합계</td>
                          <td className="px-2 py-2 text-right text-xs font-bold">{fmtW(orders.reduce((s, o) => s + o.plan_amount, 0))}</td>
                          <td className="px-2 py-2 text-right text-xs font-bold">{orders.reduce((s, o) => s + o.plan_qty, 0).toLocaleString()}</td>
                          <td colSpan={2}></td>
                          <td className="px-2 py-2 text-right text-xs font-bold text-red-600 bg-red-50">{fmtW(pnl.totalCOGS)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ── 판관비 ── */}
            {tab === 'sga' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">판매관리비</span>
                  <div className="flex gap-2">
                    <button onClick={addSga}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Plus className="w-3 h-3" /> 항목 추가
                    </button>
                    <button onClick={() => saveData('sga', sga)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      <Save className="w-3 h-3" /> 저장
                    </button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">분류</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">항목명</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-600">유형</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">월 고정금액</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600">매출대비%</th>
                        <th className="px-2 py-2 text-right font-semibold text-amber-600 bg-amber-50">연간 합계</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600">메모</th>
                        <th className="px-1 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sga.map((s, i) => {
                        const annualCalc = s.cost_type === '고정'
                          ? s.monthly_amount * 12
                          : Math.round(pnl.totalRevenue * s.rate_of_sales / 100)
                        return (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1.5">
                              <select value={s.category} onChange={e => { const next = [...sga]; next[i] = { ...s, category: e.target.value }; setSga(next) }}
                                className="text-xs border border-gray-200 rounded px-1 py-1 bg-white">
                                {SGA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={s.item_name} placeholder="세부항목"
                                onChange={e => { const next = [...sga]; next[i] = { ...s, item_name: e.target.value }; setSga(next) }}
                                className="text-xs border border-gray-200 rounded px-2 py-1 w-full bg-white" />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <select value={s.cost_type} onChange={e => { const next = [...sga]; next[i] = { ...s, cost_type: e.target.value }; setSga(next) }}
                                className={`text-xs border rounded px-2 py-1 ${
                                  s.cost_type === '고정' ? 'border-gray-300 bg-gray-50' : 'border-blue-300 bg-blue-50 text-blue-700'
                                }`}>
                                <option value="고정">고정</option>
                                <option value="변동">변동</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" value={s.monthly_amount || ''} disabled={s.cost_type === '변동'}
                                onChange={e => { const next = [...sga]; next[i] = { ...s, monthly_amount: Number(e.target.value) || 0 }; setSga(next) }}
                                className={`text-xs border border-gray-200 rounded px-1 py-1 w-28 text-right ${s.cost_type === '변동' ? 'bg-gray-100 text-gray-400' : 'bg-white'}`} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" value={s.rate_of_sales || ''} step="0.1" disabled={s.cost_type === '고정'}
                                onChange={e => { const next = [...sga]; next[i] = { ...s, rate_of_sales: Number(e.target.value) || 0 }; setSga(next) }}
                                className={`text-xs border border-gray-200 rounded px-1 py-1 w-16 text-right ${s.cost_type === '고정' ? 'bg-gray-100 text-gray-400' : 'bg-white'}`} />
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium text-amber-600 bg-amber-50/50">
                              {fmtW(annualCalc)}
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={s.memo} onChange={e => { const next = [...sga]; next[i] = { ...s, memo: e.target.value }; setSga(next) }}
                                className="text-xs border border-gray-200 rounded px-2 py-1 w-full bg-white" placeholder="메모" />
                            </td>
                            <td className="px-1 py-1.5">
                              <button onClick={() => removeSga(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {sga.length > 0 && (
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={3} className="px-2 py-2 text-xs font-bold text-gray-700">합계</td>
                          <td className="px-2 py-2 text-right text-xs font-bold">{fmtW(pnl.totalFixedSga / 12)}/월</td>
                          <td></td>
                          <td className="px-2 py-2 text-right text-xs font-bold text-amber-600 bg-amber-50">{fmtW(pnl.totalSga)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ── 손익 시뮬레이션 ── */}
            {tab === 'pnl' && (
              <div className="p-6 space-y-6">
                <h3 className="text-sm font-semibold text-gray-800">손익계산서 (P&L)</h3>

                {/* P&L 테이블 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        { label: '매출액', value: pnl.totalRevenue, bold: true, indent: 0 },
                        { label: '매출원가', value: -pnl.totalCOGS, bold: false, indent: 1, color: 'text-red-600' },
                        { label: '매출총이익', value: pnl.grossProfit, bold: true, indent: 0, border: true, pct: pnl.grossMargin },
                        { label: '판매관리비', value: -pnl.totalSga, bold: false, indent: 1, color: 'text-amber-600' },
                        { label: '  고정비', value: -pnl.totalFixedSga, bold: false, indent: 2, color: 'text-gray-500', small: true },
                        { label: '  변동비', value: -pnl.totalVariableSga, bold: false, indent: 2, color: 'text-gray-500', small: true },
                        { label: '영업이익', value: pnl.operatingProfit, bold: true, indent: 0, border: true, pct: pnl.operatingMargin,
                          color: pnl.operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
                      ].map((row, i) => (
                        <tr key={i} className={`${row.border ? 'border-t-2 border-gray-300 bg-gray-50' : 'border-t border-gray-100'}`}>
                          <td className={`px-4 py-3 ${row.bold ? 'font-bold' : ''} ${row.small ? 'text-xs' : ''}`}
                            style={{ paddingLeft: `${16 + row.indent * 20}px` }}>
                            {row.label}
                          </td>
                          <td className={`px-4 py-3 text-right ${row.bold ? 'font-bold' : ''} ${row.color || 'text-gray-900'} ${row.small ? 'text-xs' : ''}`}>
                            {row.value < 0 ? `(${fmtW(Math.abs(row.value))})` : fmtW(row.value)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-400 w-20">
                            {row.pct !== undefined ? `${row.pct.toFixed(1)}%` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 브랜드별 매출 분포 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">브랜드별 목표매출</h4>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(pnl.brandRevenue).map(([brand, revenue]) => (
                      <div key={brand} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND_COLORS[brand] || '#6b7280' }} />
                          <span className="text-xs font-semibold text-gray-700">{BRAND_NAMES[brand]}</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{fmtW(revenue)}</p>
                        <p className="text-[10px] text-gray-400">
                          비중 {pnl.totalRevenue > 0 ? (revenue / pnl.totalRevenue * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 월별 매출 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">월별 목표매출</h4>
                  <div className="grid grid-cols-12 gap-2">
                    {pnl.monthlyRevenue.map((v, i) => {
                      const max = Math.max(...pnl.monthlyRevenue, 1)
                      const pct = (v / max) * 100
                      return (
                        <div key={i} className="text-center">
                          <div className="h-24 flex items-end justify-center mb-1">
                            <div className="w-8 rounded-t-md bg-blue-500" style={{ height: `${pct}%`, minHeight: v > 0 ? '4px' : '0' }} />
                          </div>
                          <p className="text-[10px] font-bold text-gray-700">{fmtW(v)}</p>
                          <p className="text-[10px] text-gray-400">{i + 1}월</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
