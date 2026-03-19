import { NextResponse } from 'next/server'

const BASE        = 'https://graph.facebook.com/v21.0'
const TOKEN       = process.env.META_ACCESS_TOKEN
const AD_ACCOUNT  = process.env.META_AD_ACCOUNT_ID  // e.g. act_123456789

// purchase 관련 action_type 목록
const PURCHASE_TYPES = [
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'omni_purchase',
]

function extractActions(actions: { action_type: string; value: string }[] | undefined) {
  if (!actions) return 0
  return actions
    .filter(a => PURCHASE_TYPES.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value), 0)
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  const lower = s.toLowerCase()
  if (lower === 'active') return 'active'
  if (lower === 'paused') return 'paused'
  return 'completed'
}

export async function GET(req: Request) {
  if (!TOKEN || !AD_ACCOUNT) {
    return NextResponse.json({ connected: false, channel: 'Meta', campaigns: [], monthly: [] })
  }

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  try {
    const qs = (params: Record<string, string>) =>
      new URLSearchParams({ ...params, access_token: TOKEN }).toString()

    // 1) 캠페인 목록
    const campRes  = await fetch(`${BASE}/${AD_ACCOUNT}/campaigns?${qs({ fields: 'id,name,status', limit: '200' })}`)
    const campData = await campRes.json()
    if (campData.error) throw new Error(campData.error.message)

    // 2) 캠페인별 인사이트 (지정 기간 또는 최근 30일)
    const insightParams: Record<string, string> = {
      fields: 'campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values',
      level: 'campaign',
      limit: '200',
    }
    if (since && until) { insightParams.time_range = JSON.stringify({ since, until }) }
    else { insightParams.date_preset = 'last_30d' }

    const insRes  = await fetch(`${BASE}/${AD_ACCOUNT}/insights?${qs(insightParams)}`)
    const insData = await insRes.json()

    // 3) 월별 인사이트 (최근 6개월)
    const monthlyRes  = await fetch(
      `${BASE}/${AD_ACCOUNT}/insights?${qs({
        fields: 'spend,impressions,clicks,actions,action_values,date_start',
        date_preset: 'last_6_months',
        time_increment: 'monthly',
        level: 'account',
      })}`
    )
    const monthlyData = await monthlyRes.json()

    // 인사이트를 campaign_id로 인덱싱
    const insMap: Record<string, Record<string, unknown>> = {}
    for (const ins of (insData.data ?? [])) insMap[ins.campaign_id] = ins

    const campaigns = (campData.data ?? []).map((c: Record<string, string>) => {
      const ins         = insMap[c.id] ?? {}
      const spend       = Number(ins.spend ?? 0)
      const impressions = Number(ins.impressions ?? 0)
      const clicks      = Number(ins.clicks ?? 0)
      const ctr         = Number(ins.ctr ?? 0)
      const cpc         = Number(ins.cpc ?? 0)
      const conversions = extractActions(ins.actions as never)
      const revenue     = extractActions(ins.action_values as never)
      return {
        id: c.id,
        name: c.name,
        status: statusMap(c.status),
        spend, impressions, clicks, ctr, cpc, conversions, revenue,
        roas: spend > 0 ? revenue / spend : 0,
      }
    })

    const monthly = (monthlyData.data ?? []).map((m: Record<string, unknown>) => {
      const spend   = Number(m.spend ?? 0)
      const revenue = extractActions(m.action_values as never)
      return {
        month:       String(m.date_start).slice(0, 7), // YYYY-MM
        spend,       revenue,
        impressions: Number(m.impressions ?? 0),
        clicks:      Number(m.clicks ?? 0),
        conversions: extractActions(m.actions as never),
      }
    })

    return NextResponse.json({ connected: true, channel: 'Meta', campaigns, monthly })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Meta', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
