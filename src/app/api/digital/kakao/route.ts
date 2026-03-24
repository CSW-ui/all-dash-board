import { NextResponse } from 'next/server'

const BASE = 'https://business.kakao.com/api/v1'

interface KakaoAccount {
  label: string
  accessToken: string
  adAccountId: string
}

// 멀티 계정 JSON 또는 단일 env 폴백
function parseAccounts(): KakaoAccount[] {
  const json = process.env.KAKAO_ACCOUNTS
  if (json) {
    try { return JSON.parse(json) } catch { /* 폴백 */ }
  }
  const accessToken = process.env.KAKAO_ACCESS_TOKEN
  const adAccountId = process.env.KAKAO_AD_ACCOUNT_ID
  if (accessToken && adAccountId) {
    return [{ label: '', accessToken, adAccountId }]
  }
  return []
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  if (s === 'ON' || s === 'ACTIVE' || s === 'RUNNING') return 'active'
  if (s === 'OFF' || s === 'PAUSED' || s === 'SUSPENDED') return 'paused'
  return 'completed'
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')  // YYYYMMDD
}

async function fetchAccount(account: KakaoAccount) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${account.accessToken}`,
    'Content-Type':  'application/json; charset=UTF-8',
  }

  // 캠페인 목록
  const campRes = await fetch(
    `${BASE}/adaccounts/${account.adAccountId}/campaigns?config_status=ALL&limit=100`,
    { headers }
  )
  const campData = await campRes.json()
  if (campData.code && campData.code !== 0) throw new Error(`[${account.label}] ${campData.message}`)

  const campaigns: Record<string, unknown>[] = campData.campaign_list ?? campData.data ?? []

  // 최근 30일 통계
  const today = new Date()
  const ago30 = new Date(today.getTime() - 30 * 86400000)
  const since = dateStr(ago30)
  const until = dateStr(today)

  const statsRes = await fetch(
    `${BASE}/adaccounts/${account.adAccountId}/reports/campaigns?` +
    `start_date=${since}&end_date=${until}&time_unit=PERIOD&metrics=IMPRESSION,CLICK,SPEND,CONVERSION,CONVERSION_VALUE,ROAS&limit=100`,
    { headers }
  )
  const statsData = await statsRes.json()
  const statsRows: Record<string, unknown>[] = statsData.report_list ?? statsData.data ?? []

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
      accountLabel: account.label,
    }
  })

  // 월별 추이 (최근 6개월)
  const monthly: { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const from   = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const to     = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
    const mSince = dateStr(from)
    const mUntil = dateStr(to)
    const month  = from.toISOString().slice(0, 7)

    try {
      const mRes = await fetch(
        `${BASE}/adaccounts/${account.adAccountId}/reports/campaigns?` +
        `start_date=${mSince}&end_date=${mUntil}&time_unit=PERIOD&metrics=IMPRESSION,CLICK,SPEND,CONVERSION,CONVERSION_VALUE`,
        { headers }
      )
      const mData = await mRes.json()
      const rows: Record<string, unknown>[] = mData.report_list ?? mData.data ?? []
      monthly.push({
        month,
        spend:       rows.reduce((s, r) => s + Number(r.spend ?? 0), 0),
        revenue:     rows.reduce((s, r) => s + Number(r.conversion_value ?? 0), 0),
        impressions: rows.reduce((s, r) => s + Number(r.impression ?? 0), 0),
        clicks:      rows.reduce((s, r) => s + Number(r.click ?? 0), 0),
        conversions: rows.reduce((s, r) => s + Number(r.conversion ?? 0), 0),
      })
    } catch {
      monthly.push({ month, spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })
    }
  }

  return { campaigns: enriched, monthly }
}

export async function GET() {
  const accounts = parseAccounts()
  if (accounts.length === 0) {
    return NextResponse.json({ connected: false, channel: 'Kakao', campaigns: [], monthly: [] })
  }

  try {
    const results = await Promise.allSettled(accounts.map(fetchAccount))

    const allCampaigns: Record<string, unknown>[] = []
    const monthlyMap: Record<string, { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }> = {}
    const errors: string[] = []

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allCampaigns.push(...r.value.campaigns)
        for (const m of r.value.monthly) {
          if (!monthlyMap[m.month]) monthlyMap[m.month] = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
          monthlyMap[m.month].spend       += m.spend
          monthlyMap[m.month].revenue     += m.revenue
          monthlyMap[m.month].impressions += m.impressions
          monthlyMap[m.month].clicks      += m.clicks
          monthlyMap[m.month].conversions += m.conversions
        }
      } else {
        errors.push(r.reason?.message ?? String(r.reason))
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }))

    return NextResponse.json({
      connected: true,
      channel: 'Kakao',
      campaigns: allCampaigns,
      monthly,
      accountCount: accounts.length,
      ...(errors.length > 0 && { partialErrors: errors }),
    })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Kakao', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
