import { NextResponse } from 'next/server'

const DEVELOPER_TOKEN  = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const CLIENT_ID        = process.env.GOOGLE_ADS_CLIENT_ID
const CLIENT_SECRET    = process.env.GOOGLE_ADS_CLIENT_SECRET
const REFRESH_TOKEN    = process.env.GOOGLE_ADS_REFRESH_TOKEN
const CUSTOMER_ID      = process.env.GOOGLE_ADS_CUSTOMER_ID      // 숫자만, 하이픈 없이
const LOGIN_CUSTOMER   = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID // MCC 계정 ID (선택)

const BASE = 'https://googleads.googleapis.com/v17'

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description ?? 'Failed to get access token')
  return data.access_token
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  if (s === 'ENABLED') return 'active'
  if (s === 'PAUSED')  return 'paused'
  return 'completed'
}

const MONTHLY_QUERY = `
  SELECT
    segments.month,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE
    segments.date DURING LAST_180_DAYS
    AND campaign.status != 'REMOVED'
`

export async function GET(req: Request) {
  if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
    return NextResponse.json({ connected: false, channel: 'Google', campaigns: [], monthly: [] })
  }

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const dateFilter = since && until
    ? `AND segments.date BETWEEN '${since}' AND '${until}'`
    : 'AND segments.date DURING LAST_30_DAYS'

  const CAMPAIGN_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE
      campaign.status != 'REMOVED'
      ${dateFilter}
  `

  try {
    const accessToken = await getAccessToken()

    const headers: Record<string, string> = {
      'Authorization':   `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN,
      'Content-Type':    'application/json',
    }
    if (LOGIN_CUSTOMER) headers['login-customer-id'] = LOGIN_CUSTOMER

    // 캠페인별 집계
    const campRes  = await fetch(`${BASE}/customers/${CUSTOMER_ID}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({ query: CAMPAIGN_QUERY }),
    })
    const campData = await campRes.json()
    if (campData.error) throw new Error(campData.error.message)

    const campMap: Record<string, {
      id: string; name: string; status: string
      spend: number; impressions: number; clicks: number; conversions: number; revenue: number
    }> = {}
    for (const row of (campData.results ?? [])) {
      const id = row.campaign.id
      if (!campMap[id]) campMap[id] = {
        id, name: row.campaign.name, status: row.campaign.status,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      }
      campMap[id].spend       += Number(row.metrics.costMicros ?? 0) / 1_000_000
      campMap[id].impressions += Number(row.metrics.impressions ?? 0)
      campMap[id].clicks      += Number(row.metrics.clicks ?? 0)
      campMap[id].conversions += Number(row.metrics.conversions ?? 0)
      campMap[id].revenue     += Number(row.metrics.conversionsValue ?? 0)
    }

    const campaigns = Object.values(campMap).map(c => ({
      ...c,
      status: statusMap(c.status),
      ctr:  c.impressions > 0 ? c.clicks / c.impressions * 100 : 0,
      cpc:  c.clicks > 0 ? c.spend / c.clicks : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
    }))

    // 월별 집계
    const monthlyRes  = await fetch(`${BASE}/customers/${CUSTOMER_ID}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({ query: MONTHLY_QUERY }),
    })
    const monthlyData = await monthlyRes.json()

    const monthMap: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }> = {}
    for (const row of (monthlyData.results ?? [])) {
      const month = row.segments.month.slice(0, 7)
      if (!monthMap[month]) monthMap[month] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
      monthMap[month].spend       += Number(row.metrics.costMicros ?? 0) / 1_000_000
      monthMap[month].impressions += Number(row.metrics.impressions ?? 0)
      monthMap[month].clicks      += Number(row.metrics.clicks ?? 0)
      monthMap[month].conversions += Number(row.metrics.conversions ?? 0)
      monthMap[month].revenue     += Number(row.metrics.conversionsValue ?? 0)
    }

    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }))

    return NextResponse.json({ connected: true, channel: 'Google', campaigns, monthly })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Google', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
