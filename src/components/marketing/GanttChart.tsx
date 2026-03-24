'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CampaignDetailPanel } from './CampaignDetailPanel'
import { CampaignFormModal } from './modals/CampaignFormModal'
import type { InfluencerSeedingRecord } from '@/types/marketing'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignProduct {
  id?: string
  product_code: string
  product_name: string
}

interface Brand {
  code: string
  name: string
}

interface Campaign {
  id: string
  title: string
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed'
  color: string
  ooh_cost: number
  notes?: string
  brand?: string
  campaign_products: CampaignProduct[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_W = 38       // px per week column
const ROW_H  = 44       // px per packed row
const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const STATUS_LABELS: Record<Campaign['status'], string> = {
  planned: '예정',
  active: '진행중',
  completed: '완료',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/** Weeks starting Jan 1 of given year, every 7 days */
function getYearWeeks(year: number): Date[] {
  const weeks: Date[] = []
  const end = new Date(year, 11, 31)
  let cur = new Date(year, 0, 1)
  while (cur <= end) {
    weeks.push(new Date(cur))
    cur = new Date(cur.getTime() + 7 * 86400000)
  }
  return weeks
}

/** Count how many week-starts fall in each month */
function getMonthSpans(weeks: Date[]) {
  const counts = new Array(12).fill(0)
  for (const w of weeks) counts[w.getMonth()]++
  return counts.map((count, m) => ({ label: MONTH_LABELS[m], count }))
}

/** Pack campaigns into rows so non-overlapping campaigns share a row */
function packRows(campaigns: Campaign[]): Campaign[][] {
  const sorted = [...campaigns].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )
  const rows: { campaign: Campaign; endDate: Date }[][] = []

  for (const c of sorted) {
    const start = new Date(c.start_date)
    const end   = new Date(c.end_date)
    let placed  = false

    for (const row of rows) {
      const lastEnd = row[row.length - 1].endDate
      if (start > lastEnd) {
        row.push({ campaign: c, endDate: end })
        placed = true
        break
      }
    }
    if (!placed) rows.push([{ campaign: c, endDate: end }])
  }

  return rows.map(r => r.map(x => x.campaign))
}

function toIMCCampaign(c: Campaign) {
  return {
    ...c,
    startDate: c.start_date,
    endDate: c.end_date,
    oohCost: c.ooh_cost ?? 0,
    products: (c.campaign_products ?? []).map(p => ({
      productCode: p.product_code,
      productName: p.product_name,
    })),
    seedingRecords: [] as InfluencerSeedingRecord[],
    metaAds: undefined,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GanttChart() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [loading, setLoading]       = useState(true)
  const [year, setYear]             = useState(() => new Date().getFullYear())
  const [selected, setSelected]     = useState<Campaign | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Campaign | null>(null)
  const [brands, setBrands]         = useState<Brand[]>([])
  const [filterBrand, setFilterBrand] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/campaigns')
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch {
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setBrands(data)
    }).catch(() => {})
  }, [])

  // Scroll to today on load / year change
  useEffect(() => {
    if (!scrollRef.current) return
    const today = new Date()
    if (today.getFullYear() !== year) return
    const viewStart = new Date(year, 0, 1)
    const totalDays = daysBetween(viewStart, new Date(year, 11, 31)) + 1
    const dayW = WEEK_W / 7
    const todayPx = daysBetween(viewStart, today) * dayW
    scrollRef.current.scrollLeft = Math.max(0, todayPx - 200)
  }, [year])

  // ── Derived ──────────────────────────────────────────────────────────────

  const viewStart  = new Date(year, 0, 1)
  const viewEnd    = new Date(year, 11, 31)
  const totalDays  = daysBetween(viewStart, viewEnd) + 1
  const DAY_W      = WEEK_W / 7

  const weeks      = getYearWeeks(year)
  const monthSpans = getMonthSpans(weeks)
  const totalWidth = weeks.length * WEEK_W

  const filteredCampaigns = (filterBrand
    ? campaigns.filter(c => c.brand === filterBrand)
    : campaigns
  ).filter(c => new Date(c.end_date) >= viewStart && new Date(c.start_date) <= viewEnd)

  const rows = packRows(filteredCampaigns)

  // Today marker position
  const todayOffset = (() => {
    const today = new Date()
    if (today.getFullYear() !== year) return null
    return daysBetween(viewStart, today) * DAY_W
  })()

  // ── Bar style ─────────────────────────────────────────────────────────────

  function getBarStyle(campaign: Campaign) {
    const start     = new Date(campaign.start_date)
    const end       = new Date(campaign.end_date)
    const leftDays  = Math.max(0, daysBetween(viewStart, start))
    const rightDays = Math.min(totalDays - 1, daysBetween(viewStart, end))
    if (rightDays < 0 || leftDays >= totalDays) return null
    return {
      left:       `${leftDays * DAY_W}px`,
      width:      `${Math.max((rightDays - leftDays + 1) * DAY_W, DAY_W * 2)}px`,
      background: campaign.color,
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm('캠페인을 삭제하시겠습니까?')) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    fetchCampaigns()
    if (selected?.id === id) setSelected(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-gray-800">캠페인 타임라인</h3>
          <div className="flex items-center gap-2">
            <select
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="text-xs border border-surface-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent bg-white"
            >
              <option value="">전체 브랜드</option>
              {brands.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>

            {/* Year nav */}
            <div className="flex items-center border border-surface-border rounded-lg overflow-hidden">
              <button
                onClick={() => setYear(y => y - 1)}
                className="px-2 py-1.5 hover:bg-surface-subtle text-gray-500 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-700 px-3 font-semibold">{year}년</span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="px-2 py-1.5 hover:bg-surface-subtle text-gray-500 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="flex items-center gap-1.5 text-xs font-medium bg-brand-accent text-white px-3 py-1.5 rounded-lg hover:bg-brand-accent-hover transition-colors"
            >
              <Plus size={13} /> 새 캠페인
            </button>
          </div>
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ width: `${totalWidth}px` }}>

            {/* Month header */}
            <div className="flex border-b border-surface-border bg-white sticky top-0 z-10">
              {monthSpans.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-center text-xs py-1.5 border-r border-surface-border last:border-r-0 font-semibold shrink-0',
                    m.count === 0 ? 'hidden' : '',
                    'text-gray-600'
                  )}
                  style={{ width: `${m.count * WEEK_W}px` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Week header */}
            <div className="flex border-b border-surface-border bg-surface-subtle">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] text-gray-400 py-1 border-r border-surface-border last:border-r-0 shrink-0 leading-none"
                  style={{ width: `${WEEK_W}px` }}
                >
                  {w.getDate()}
                </div>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                불러오는 중...
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-gray-400">
                  {filteredCampaigns.length === 0 && campaigns.length > 0
                    ? '해당 연도 / 브랜드에 캠페인이 없습니다.'
                    : '등록된 캠페인이 없습니다.'}
                </p>
                {campaigns.length === 0 && (
                  <button
                    onClick={() => { setEditTarget(null); setShowForm(true) }}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    첫 캠페인 등록하기
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                {/* Week grid lines */}
                <div className="absolute inset-0 flex pointer-events-none z-0">
                  {weeks.map((_, i) => (
                    <div
                      key={i}
                      className="shrink-0 border-r border-surface-border"
                      style={{ width: `${WEEK_W}px` }}
                    />
                  ))}
                </div>

                {/* Today vertical line */}
                {todayOffset !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-20 pointer-events-none"
                    style={{ left: `${todayOffset}px`, width: '1.5px', background: 'rgba(109,40,217,0.35)' }}
                  />
                )}

                {/* Packed rows */}
                {rows.map((rowCampaigns, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="relative border-b border-surface-border last:border-b-0"
                    style={{ height: `${ROW_H}px` }}
                  >
                    {rowCampaigns.map(campaign => {
                      const barStyle = getBarStyle(campaign)
                      if (!barStyle) return null
                      return (
                        <div
                          key={campaign.id}
                          className="absolute top-2 flex items-center rounded-md cursor-pointer group/bar hover:brightness-95 transition-all"
                          style={{ ...barStyle, height: `${ROW_H - 16}px` }}
                          onClick={() => setSelected(campaign)}
                          title={`${campaign.title}\n${campaign.start_date} ~ ${campaign.end_date}\n${STATUS_LABELS[campaign.status]}`}
                        >
                          {/* Title */}
                          <span className="truncate text-[11px] text-white font-medium px-2 flex-1 select-none">
                            {campaign.title}
                          </span>
                          {/* Hover actions */}
                          <span className="shrink-0 flex items-center gap-0.5 pr-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            <span
                              className="p-0.5 rounded hover:bg-black/25"
                              onClick={e => {
                                e.stopPropagation()
                                setEditTarget(campaign)
                                setShowForm(true)
                              }}
                            >
                              <Pencil size={9} className="text-white" />
                            </span>
                            <span
                              className="p-0.5 rounded hover:bg-black/25"
                              onClick={e => handleDelete(campaign.id, e)}
                            >
                              <Trash2 size={9} className="text-white" />
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {selected && (
        <CampaignDetailPanel
          campaign={toIMCCampaign(selected)}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowForm(true) }}
          onDelete={() => handleDelete(selected.id)}
        />
      )}

      {showForm && (
        <CampaignFormModal
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={fetchCampaigns}
          initial={editTarget ? {
            id:         editTarget.id,
            title:      editTarget.title,
            start_date: editTarget.start_date,
            end_date:   editTarget.end_date,
            status:     editTarget.status,
            color:      editTarget.color,
            ooh_cost:   String(editTarget.ooh_cost),
            notes:      editTarget.notes ?? '',
            products:   editTarget.campaign_products,
          } : undefined}
        />
      )}
    </>
  )
}
