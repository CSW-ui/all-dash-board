'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTargetData } from '@/hooks/useTargetData'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,  Bar,
} from 'recharts'
import { cn } from '@/lib/utils'
import { BRAND_COLORS_KR, brandNameToCode } from '@/lib/constants'
import { fmtW, fmtPct } from '@/lib/formatters'
import { getChannelGroup } from '@/lib/sales-types'

const normBrand = (s: string) => s.replace(/\s+/g, '').toLowerCase()
const BRAND_COLORS = BRAND_COLORS_KR

// 목표 데이터의 shoptypenm을 region 기준으로 필터
function matchTargetRegion(shoptypenm: string | undefined, region: Region): boolean {
  if (region === 'all') return true
  if (!shoptypenm) return true // shoptypenm 없으면 전체로 간주
  const group = getChannelGroup(shoptypenm)
  if (region === 'domestic') return group !== '해외'
  if (region === 'online') return group === '온라인'
  if (region === 'offline') return group === '오프라인'
  if (region === 'overseas') return group === '해외'
  return true
}

type Region = 'all' | 'domestic' | 'overseas' | 'online' | 'offline'

export default function DashboardPage() {
  const { targets, getMonthlyTotal } = useTargetData()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<Region>('all')

  const fetchData = useCallback(async (r: Region) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?region=${r}`)
      const j = await res.json()
      setData(j)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(region) }, [region, fetchData])

  const handleRegion = (r: Region) => {
    if (r === region) return
    setRegion(r)
  }

  // 지역 필터된 목표 합계
  const getFilteredMonthlyTarget = useCallback((yyyymm: string): number => {
    return targets
      .filter(t => t.yyyymm === yyyymm && matchTargetRegion(t.shoptypenm, region))
      .reduce((sum, t) => sum + t.target, 0)
  }, [targets, region])

  // 차트 데이터: 전년 / 목표 / 달성
  const chartData = useMemo(() => {
    if (!data?.monthly) return []
    return data.monthly.map((m: any) => {
      const uploaded = getFilteredMonthlyTarget(m.yyyymm)
      return {
        month: m.month,
        actual: m.actual || undefined,
        lastYear: m.lastYear || undefined,
        target: uploaded > 0 ? uploaded : undefined,
      }
    })
  }, [data, targets, region, getFilteredMonthlyTarget])

  // 브랜드별 금월 목표 vs 달성
  const brandMonthData = useMemo(() => {
    if (!data?.brandMonth || !data?.kpi) return []
    const curMonth = data.kpi.curMonth
    const yyyymm = `${data.kpi.curYear}${String(curMonth).padStart(2, '0')}`

    return (data.brandMonth as { brand: string; cmRev: number }[]).map(b => {
      const bCode = brandNameToCode(b.brand)
      const bNorm = normBrand(b.brand)
      const brandTarget = targets
        .filter(t => {
          if (t.yyyymm !== yyyymm) return false
          if (!matchTargetRegion(t.shoptypenm, region)) return false
          const tCode = brandNameToCode(t.brandnm)
          if (bCode && tCode && bCode === tCode) return true
          if (normBrand(t.brandnm) === bNorm) return true
          return false
        })
        .reduce((sum, t) => sum + t.target, 0)
      const pct = brandTarget > 0 ? Math.round((b.cmRev / brandTarget) * 100) : 0
      return { brand: b.brand, actual: b.cmRev, target: brandTarget || undefined, pct }
    })
  }, [data, targets, region])

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">비케이브 전체 사업 현황</p>
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
          <span className="text-[10px] text-gray-400">전일마감기준</span>
          <span className="w-px h-3 bg-gray-200" />
          <span className="text-[10px] text-gray-400">Snowflake</span>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </div>

      {/* 국내/해외 토글 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {([['all', '전체'], ['domestic', '국내'], ['online', '온라인'], ['offline', '오프라인'], ['overseas', '해외']] as [Region, string][]).map(([key, label]) => (
            <button key={key}
              onClick={() => handleRegion(key)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                region === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 월별 매출 추이 */}
        <div className="col-span-2 bg-white rounded-xl border border-surface-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              월별 매출 추이 <span className="text-xs font-normal text-gray-400 ml-1">({region === 'all' ? '전체' : region === 'domestic' ? '국내' : region === 'online' ? '온라인' : region === 'offline' ? '오프라인' : '해외'})</span>
            </h3>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-400 inline-block" style={{ borderTop: '2px dashed #9ca3af' }} />{data?.kpi?.curYear - 1}년 (전년)</span>
              {targets.length > 0 && <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ borderTop: '2px dashed #6366f1' }} />{data?.kpi?.curYear}년 목표</span>}
              <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-[#e91e63] inline-block rounded-sm opacity-85" />{data?.kpi?.curYear}년 달성</span>
            </div>
          </div>
          {loading ? <div className="h-52 bg-surface-subtle animate-pulse rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tickFormatter={v => fmtW(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} width={55} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtW(v), name]}
                  labelFormatter={(label: string) => label}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="actual" name="달성" fill="#e91e63" radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.85} />
                <Line type="monotone" dataKey="lastYear" name="전년" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2.5, fill: '#9ca3af' }} connectNulls />
                {targets.length > 0 && (
                  <Line type="monotone" dataKey="target" name="목표" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {/* 월별 상세 테이블 */}
          {!loading && chartData.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-t border-gray-100">
                    <th className="py-1.5 px-1 text-left text-gray-400 font-medium w-[52px]">월</th>
                    {chartData.map((d: any) => (
                      <th key={d.month} className="py-1.5 px-1 text-center text-gray-500 font-semibold">{d.month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.length > 0 && (
                    <tr className="border-t border-gray-50">
                      <td className="py-1 px-1 text-gray-400 font-medium">목표</td>
                      {chartData.map((d: any) => (
                        <td key={d.month} className="py-1 px-1 text-center text-violet-600">{d.target ? fmtW(d.target) : '—'}</td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t border-gray-50">
                    <td className="py-1 px-1 text-gray-400 font-medium">달성</td>
                    {chartData.map((d: any) => (
                      <td key={d.month} className="py-1 px-1 text-center font-semibold text-gray-800">{d.actual ? fmtW(d.actual) : '—'}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-gray-50">
                    <td className="py-1 px-1 text-gray-400 font-medium">전년</td>
                    {chartData.map((d: any) => (
                      <td key={d.month} className="py-1 px-1 text-center text-gray-500">{d.lastYear ? fmtW(d.lastYear) : '—'}</td>
                    ))}
                  </tr>
                  {targets.length > 0 && (
                    <tr className="border-t border-gray-50">
                      <td className="py-1 px-1 text-gray-400 font-medium">달성률</td>
                      {chartData.map((d: any) => {
                        const pct = d.target && d.actual ? Math.round((d.actual / d.target) * 100) : null
                        return (
                          <td key={d.month} className={cn('py-1 px-1 text-center font-semibold',
                            pct === null ? 'text-gray-300' : pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'
                          )}>
                            {pct !== null ? `${pct}%` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                  <tr className="border-t border-gray-50">
                    <td className="py-1 px-1 text-gray-400 font-medium">신장률</td>
                    {chartData.map((d: any) => {
                      const growth = d.lastYear && d.actual ? Math.round(((d.actual - d.lastYear) / d.lastYear) * 100) : null
                      return (
                        <td key={d.month} className={cn('py-1 px-1 text-center font-medium',
                          growth === null ? 'text-gray-300' : growth >= 0 ? 'text-emerald-600' : 'text-red-500'
                        )}>
                          {growth !== null ? `${growth >= 0 ? '+' : ''}${growth}%` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 브랜드별 금월 목표 vs 달성 */}
        <div className="col-span-1 bg-white rounded-xl border border-surface-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            브랜드별 {data?.kpi?.curMonth ?? ''}월 목표 달성현황
            <span className="text-xs font-normal text-gray-400 ml-1">({region === 'all' ? '전체' : region === 'domestic' ? '국내' : region === 'online' ? '온라인' : region === 'offline' ? '오프라인' : '해외'})</span>
          </h3>
          {loading ? <div className="h-64 bg-surface-subtle animate-pulse rounded-lg" /> : (
            <div className="space-y-4">
              {brandMonthData.map(b => {
                const pctClamped = Math.min(b.pct, 100)
                const pctColor = b.pct >= 90 ? 'bg-emerald-500' : b.pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                const pctTextColor = b.pct >= 90 ? 'text-emerald-600' : b.pct >= 70 ? 'text-amber-600' : 'text-red-500'

                return (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_COLORS[b.brand] ?? '#999' }} />
                        <span className="text-xs font-semibold text-gray-800">{b.brand}</span>
                      </div>
                      <span className={cn('text-sm font-bold', pctTextColor)}>
                        {b.target ? `${b.pct}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pctColor)}
                        style={{ width: b.target ? `${pctClamped}%` : '0%' }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-500">달성 {fmtW(b.actual)}</span>
                      <span className="text-[10px] text-gray-400">
                        {b.target ? `목표 ${fmtW(b.target)}` : '목표 미설정'}
                      </span>
                    </div>
                  </div>
                )
              })}
              {brandMonthData.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">데이터 없음</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 연도별 상품·판매 지표 */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          연도별 상품·판매 현황
          <span className="text-xs font-normal text-gray-400 ml-1">({region === 'all' ? '전체' : region === 'domestic' ? '국내' : region === 'online' ? '온라인' : region === 'offline' ? '오프라인' : '해외'})</span>
        </h3>
        {loading ? <div className="h-20 bg-surface-subtle animate-pulse rounded-lg" /> : (
          (() => {
            const yearly = data?.yearlyProduct ?? []
            if (yearly.length === 0) return <div className="text-center py-8 text-xs text-gray-400">데이터 없음</div>

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-3 text-left text-gray-500 font-semibold">연도</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">스타일수</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">판매수량</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">매출</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">운영매장</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">스타일당 매출</th>
                      <th className="py-2 px-3 text-right text-gray-500 font-semibold">매출 신장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearly.map((y: any, i: number) => {
                      const prev = i > 0 ? yearly[i - 1] : null
                      const revGrowth = prev?.revenue ? Math.round(((y.revenue - prev.revenue) / prev.revenue) * 100) : null
                      const perStyle = y.styles > 0 ? Math.round(y.revenue / y.styles) : 0

                      return (
                        <tr key={y.year} className={cn('border-b border-gray-100', i === yearly.length - 1 && 'bg-pink-50/30 font-semibold')}>
                          <td className="py-2.5 px-3 font-bold text-gray-900">{y.year}년</td>
                          <td className="py-2.5 px-3 text-right text-gray-800">{y.styles.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right text-gray-800">{y.qty.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right text-gray-900 font-bold">{fmtW(y.revenue)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-800">{y.shops.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{fmtW(perStyle)}</td>
                          <td className={cn('py-2.5 px-3 text-right font-medium',
                            revGrowth === null ? 'text-gray-300' : revGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'
                          )}>
                            {revGrowth !== null ? `${revGrowth >= 0 ? '+' : ''}${revGrowth}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}
