import { NextResponse } from 'next/server'

const BASE           = 'https://business.kakao.com/api/v1'
const ACCESS_TOKEN   = process.env.KAKAO_ACCESS_TOKEN
const AD_ACCOUNT_ID  = process.env.KAKAO_AD_ACCOUNT_ID

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type':  'application/json; charset=UTF-8',
  }
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  if (s === 'ON' || s === 'ACTIVE' || s === 'RUNNING') return 'active'
  if (s === 'OFF' || s === 'PAUSED' || s === 'SUSPENDED') return 'paused'
  return 'completed'
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')  // YYYYMMDD for Kakao
}

export async function GET() {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    return NextResponse.json({ connected: false, channel: 'Kakao', campaigns: [], monthly: [] })
  }

  try {
    // 캠페인 목록
    const campRes  = await fetch(
      `${BASE}/adaccounts/${AD_ACCOUNT_ID}/campaigns?config_status=ALL&limit=100`,
      { headers: headers() }
    )
    const campData = await campRes.json()
    if (campData.code && campData.code !== 0) throw new Error(campData.message)

    const campaigns: Record<string, unknown>[] = campData.campaign_list ?? campData.data ?? []

    // 최근 30일 통계
    const today = new Date()
    const ago30 = new Date(today.getTime() - 30 * 86400000)
    const since = dateStr(ago30)
    const until = dateStr(today)

    const statsRes  = await fetch(
      `${BASE}/adaccounts/${AD_ACCOUNT_ID}/reports/campaigns?` +
      `start_date=${since}&end_date=${until}&time_unit=PERIOD&metrics=IMPRESSION,CLICK,SPEND,CONVERSION,CONVERSION_VALUE,ROAS&limit=100`,
      { headers: headers() }
    )
    const statsData = await statsRes.json()
    const statsRows: Record<string, unknown>[] = statsData.report_list ?? statsData.data ?? []

    // 캠페인 ID로 통계 매핑
    const statsMap: Record<string, Record<string, unknown>> = {}
    for (const row of statsRows) statsMap[String(row.campaign_id)] = row

    const enriched = campaigns.map(c => {
      const s           = statsMap[String(c.campaign_id)] ?? {}
      const spend       = Number(s.spend ?? 0)
      const impressions = Number(s.impression ?? 0)
      const clicks      = Number(s.click ?? 0)
      const conversions = Number(s.conversion ?? 0)
      const revenue     = Number(s.conversion_value ?? 0)
      return {
        id:     String(c.campaign_id),
        name:   String(c.campaign_name),
        status: statusMap(String(c.config_status ?? c.status ?? '')),
        spend, impressions, clicks,
        ctr:  impressions > 0 ? clicks / impressions * 100 : 0,
        cpc:  clicks > 0 ? spend / clicks : 0,
        conversions, revenue,
        roas: spend > 0 ? revenue / spend : 0,
      }
    })

    // 월별 추이 (최근 6개월)
    const monthly: { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const from  = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const to    = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      const mSince = dateStr(from)
      const mUntil = dateStr(to)
      const month  = from.toISOString().slice(0, 7)

      try {
        const mRes  = await fetch(
          `${BASE}/adaccounts/${AD_ACCOUNT_ID}/reports/campaigns?` +
          `start_date=${mSince}&end_date=${mUntil}&time_unit=PERIOD&metrics=IMPRESSION,CLICK,SPEND,CONVERSION,CONVERSION_VALUE`,
          { headers: headers() }
        )
        const mData  = await mRes.json()
        const rows: Record<string, unknown>[] = mData.report_list ?? mData.data ?? []
        const spend   = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0)
        const revenue = rows.reduce((s, r) => s + Number(r.conversion_value ?? 0), 0)
        monthly.push({
          month, spend, revenue,
          impressions: rows.reduce((s, r) => s + Number(r.impression ?? 0), 0),
          clicks:      rows.reduce((s, r) => s + Number(r.click ?? 0), 0),
          conversions: rows.reduce((s, r) => s + Number(r.conversion ?? 0), 0),
        })
      } catch {
        monthly.push({ month, spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })
      }
    }

    return NextResponse.json({ connected: true, channel: 'Kakao', campaigns: enriched, monthly })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Kakao', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
