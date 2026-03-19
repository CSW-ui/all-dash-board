'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
  STYLECD: string
  STYLENM: string
  BRANDCD: string
  YEARCD: string
  SEASONNM: string
  ITEMNM: string
}

interface Filters {
  brands: string[]
  years: string[]
  seasons: string[]
  items: string[]
}

interface SelectedProduct {
  product_code: string
  product_name: string
}

interface Props {
  value: SelectedProduct[]
  onChange: (products: SelectedProduct[]) => void
}

export function ProductSearchInput({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({ brands: [], years: [], seasons: [], items: [] })
  const [brand, setBrand] = useState('')
  const [year, setYear] = useState('26')
  const [season, setSeason] = useState('')
  const [item, setItem] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // 필터 목록 로드
  useEffect(() => {
    fetch('/api/products', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.brands)) setFilters(data)
      })
      .catch(() => {})
  }, [])

  // 검색
  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (brand)  params.set('brand', brand)
      if (year)   params.set('year', year)
      if (season) params.set('season', season)
      if (item)   params.set('item', item)
      if (q)      params.set('q', q)
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      if (!res.ok || data?.error) {
        setError(data?.error ?? `HTTP ${res.status}`)
        setResults([])
      } else {
        setResults(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      setError(String(e))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [brand, year, season, item, q])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(search, 300)
    return () => clearTimeout(t)
  }, [open, search])

  // 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addProduct(p: Product) {
    if (value.find(v => v.product_code === p.STYLECD)) return
    onChange([...value, { product_code: p.STYLECD, product_name: p.STYLENM }])
  }

  function removeProduct(code: string) {
    onChange(value.filter(v => v.product_code !== code))
  }

  return (
    <div ref={ref} className="space-y-2">
      {/* 선택된 상품 태그 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(p => (
            <span key={p.product_code} className="flex items-center gap-1.5 bg-brand-accent-light text-brand-accent text-xs font-medium px-2 py-1 rounded-full">
              <span className="font-mono">{p.product_code}</span>
              <span className="text-gray-600">{p.product_name}</span>
              <button type="button" onClick={() => removeProduct(p.product_code)} className="hover:text-red-500">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 검색 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-brand-accent hover:text-brand-accent-hover border border-dashed border-brand-accent/40 rounded-lg px-3 py-2 w-full hover:bg-brand-accent-light transition-colors"
      >
        <Plus size={12} />
        상품 검색해서 추가
        <ChevronDown size={12} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="border border-surface-border rounded-xl shadow-lg bg-white overflow-hidden">
          {/* 필터 */}
          <div className="px-3 py-3 bg-surface-subtle border-b border-surface-border space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">브랜드</label>
                <select
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full text-xs border border-surface-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-accent"
                >
                  <option value="">전체</option>
                  {filters.brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">연도</label>
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-full text-xs border border-surface-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-accent"
                >
                  <option value="">전체</option>
                  {filters.years.map(y => <option key={y} value={y}>20{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">시즌</label>
                <select
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  className="w-full text-xs border border-surface-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-accent"
                >
                  <option value="">전체</option>
                  {filters.seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">품목</label>
                <select
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  className="w-full text-xs border border-surface-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-accent"
                >
                  <option value="">전체</option>
                  {filters.items.map(it => <option key={it} value={it}>{it}</option>)}
                </select>
              </div>
            </div>

            {/* 텍스트 검색 */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="상품명 또는 코드 검색"
                className="w-full text-xs border border-surface-border rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-brand-accent"
              />
            </div>

            <button
              type="button"
              onClick={search}
              className="w-full text-xs font-medium bg-brand-accent text-white rounded-lg py-1.5 hover:bg-brand-accent-hover transition-colors"
            >
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>

          {/* 결과 목록 */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-xs text-gray-400">검색 중...</div>
            ) : error ? (
              <div className="px-3 py-4 text-xs text-red-600 bg-red-50 m-2 rounded-lg break-all">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400">검색 결과가 없습니다</div>
            ) : (
              results.map(p => {
                const already = value.some(v => v.product_code === p.STYLECD)
                return (
                  <button
                    key={p.STYLECD}
                    type="button"
                    onClick={() => addProduct(p)}
                    disabled={already}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-subtle transition-colors border-b border-surface-border last:border-b-0',
                      already && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <div className="text-left">
                      <span className="font-medium text-gray-800">{p.STYLENM}</span>
                      <span className="text-gray-400 ml-2 font-mono">{p.STYLECD}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="bg-surface-muted text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{p.BRANDCD}</span>
                      <span className="text-gray-400 text-[10px]">{p.SEASONNM}</span>
                      <span className="text-gray-400 text-[10px]">{p.ITEMNM}</span>
                      {already
                        ? <span className="text-emerald-500 text-[10px]">추가됨</span>
                        : <Plus size={11} className="text-brand-accent" />
                      }
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
