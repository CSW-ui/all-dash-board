'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTargetData } from '@/hooks/useTargetData'
import Link from 'next/link'
import { TrendingUp, Users, Target, BarChart3, Upload, Package, ClipboardList, Truck, Archive } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { BRAND_COLORS_KR } from '@/lib/constants'
import { fmtW, fmtPct } from '@/lib/formatters'

const BRAND_COLORS = BRAND_COLORS_KR

const quickLinks = [
  { label: '매출 대시보드', href: '/sales', icon: BarChart3, color: 'bg-pink-50 text-pink-600 border-pink-100' },
  { label: '기획현황판', href: '/planning', icon: ClipboardList, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { label: '이월재고', href: '/planning/carryover', icon: Archive, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  { label: '보충출고', href: '/sales/replenishment', icon: Truck, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
]

export default function DashboardPage() {
  const { targets, getMonthlyTotal } = useTargetData()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(j => setData(j))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const kpiCards = useMemo(() => {
    if (!data?.kpi) return []
    const k = data.kpi
    return [
      {
        title: `${k.curMonth}월 매출`,
        value: fmtW(k.cmRev),
        delta: k.yoyRevPct,
        label: 'vs 전년동월',
        icon: TrendingUp,
        color: 'text-pink-500',
      },
      {
        title: `${k.curMonth}월 판매수량`,
        value: k.cmQty.toLocaleString(),
        delta: k.yoyQtyPct,
        label: 'vs 전년동월',
        icon: Users,
        color: 'text-violet-500',
      },
      {
        title: '활성 매장수',
        value: k.cmShops.toLocaleString(),
        delta: k.shopChgPct,
        label: 'vs 지난달',
        icon: Target,
        color: 'text-emerald-500',
      },
      {
        title: `${k.curMonth - 1 || 12}월 vs ${k.curMonth}월`,
        value: fmtPct(k.momRevPct),
        delta: k.momRevPct,
        label: '매출 성장률',
        icon: BarChart3,
        color: 'text-blue-500',
      },
    ]
  }, [data])

  // 차트 데이터에 목표선 오버레이
  const chartData = useMemo(() => {
    if (!data?.monthly) return []
    return data.monthly.map((m: any) => {
      const uploaded = getMonthlyTotal(m.yyyymm)
      return {
        month: m.month,
        actual: m.actual,
        target: uploaded > 0 ? uploaded : undefined,
      }
    })
  }, [data, targets, getMonthlyTotal])

  const brandData = data?.brands ?? []

  return (
    <div className="space-y-5 p-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">비케이브 전체 사업 현황 · Snowflake 실시간 데이터</p>
        </div>
        <div className="flex items-center gap-3">
          {targets.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              목표 데이터 적용됨
            </span>
          ) : (
            <Link href="/admin"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-accent border border-surface-border hover:border-brand-accent/50 px-3 py-1.5 rounded-full transition-all">
              <Upload size={12} /> 목표매출 업로드
            </Link>
          )}
          <span className="text-xs text-gray-400">Snowflake 연결됨</span>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="flex gap-2 flex-wrap">
        {quickLinks.map(link => (
          <Link key={link.href} href={link.href}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${link.color}`}>
            <link.icon size={12} />
            {link.label}
          </Link>
        ))}
      </div>

      {/* KPI */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-surface-subtle animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map(k => (
            <div key={k.title} className="bg-white rounded-xl border border-surface-border shadow-sm p-4 flex justify-between">
              <div>
                <p className="text-xs text-gray-400">{k.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
                <p className="text-xs mt-1">
                  <span className={cn('font-medium', k.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {fmtPct(k.delta)}
                  </span>
                  <span className="text-gray-400 ml-1">{k.label}</span>
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50', k.color)}>
                <k.icon size={20} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 차트 영역 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 월별 매출 추이 */}
        <div className="col-span-2 bg-white rounded-xl border border-surface-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            월별 매출 실적{targets.length > 0 ? ' vs 목표 (엑셀 적용)' : ''}
          </h3>
          {loading ? <div className="h-64 bg-surface-subtle animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tickFormatter={v => fmtW(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} width={55} />
                <Tooltip formatter={(v: number) => fmtW(v)} />
                <Line type="monotone" dataKey="actual" name="실적" stroke="#e91e63" strokeWidth={2.5} dot={{ r: 3.5, fill: '#e91e63' }} />
                {targets.length > 0 && (
                  <Line type="monotone" dataKey="target" name="목표" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 브랜드별 실적 */}
        <div className="col-span-1 bg-white rounded-xl border border-surface-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            브랜드별 {data?.kpi?.curYear ?? ''} 실적
          </h3>
          {loading ? <div className="h-64 bg-surface-subtle animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={brandData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                <XAxis dataKey="brand" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <YAxis yAxisId="rev" tickFormatter={v => fmtW(v)} tick={{ fontSize: 9, fill: '#9ca3af' }} width={50} />
                <YAxis yAxisId="qty" orientation="right" tick={{ fontSize: 9, fill: '#9ca3af' }} width={40} />
                <Tooltip formatter={(v: number, name: string) => name === '매출' ? fmtW(v) : v.toLocaleString()} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="rev" dataKey="revenue" name="매출" radius={[4, 4, 0, 0]}
                  fill="#e91e63" />
                <Bar yAxisId="qty" dataKey="qty" name="판매수량" radius={[4, 4, 0, 0]}
                  fill="#c4b5fd" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 발주/입고 현황 요약 */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Package size={14} className="text-gray-400" />
            브랜드별 상세
          </h3>
          <Link href="/sales" className="text-xs text-brand-accent hover:underline">매출 대시보드 →</Link>
        </div>
        {loading ? <div className="h-20 bg-surface-subtle animate-pulse rounded-lg" /> : (
          <div className="grid grid-cols-5 gap-3">
            {brandData.map((b: any) => (
              <div key={b.brand} className="border border-surface-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_COLORS[b.brand] ?? '#999' }} />
                  <span className="text-xs font-semibold text-gray-800">{b.brand}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{fmtW(b.revenue)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">판매 {b.qty.toLocaleString()}건</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
