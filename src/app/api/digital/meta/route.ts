import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v21.0'

interface MetaAccount { label: string; id: string; token: string }

// JSON 환경변수 파싱: META_ACCOUNTS (브랜드별 토큰 분리) → flat 계정 목록
function parseAccounts(): MetaAccount[] {
  // 1) 신규 JSON 형식 우선
  const jsonRaw = process.env.META_ACCOUNTS
  if (jsonRaw) {
    try {
      const brands = JSON.parse(jsonRaw) as {
        label: string; accessToken: string; adAccountIds: string[]
      }[]
      const list: MetaAccount[] = []
      for (const b of brands) {
        for (const entry of b.adAccountIds) {
          const [subLabel, id] = entry.includes(':') ? entry.split(':') : ['', entry]
          list.push({ label: subLabel.trim() || b.label, id: id.trim(), token: b.accessToken })
        }
      }
      return list
    } catch { /* JSON 파싱 실패 시 레거시 폴백 */ }
  }
  // 2) 레거시 폴백: META_AD_ACCOUNT_IDS + META_ACCESS_TOKEN
  const fallbackToken = process.env.META_ACCESS_TOKEN ?? ''
  const raw = process.env.META_AD_ACCOUNT_IDS ?? process.env.META_AD_ACCOUNT_ID ?? ''
  if (!raw || !fallbackToken) return []
  return raw.split(',').map(entry => {
    const [label, id] = entry.includes(':') ? entry.split(':') : ['', entry]
    return { label: label.trim(), id: id.trim(), token: fallbackToken }
  })
}

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
  const accounts = parseAccounts()
  if (accounts.length === 0) {
    return NextResponse.json({ connected: false, channel: 'Meta', campaigns: [], monthly: [] })
  }

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  try {
    // 모든 광고계정을 병렬로 조회 (계정별 토큰 사용)
    const results = await Promise.allSettled(
      accounts.map(async ({ label, id: adAccount, token }) => {
        const qs = (params: Record<string, string>) =>
          new URLSearchParams({ ...params, access_token: token }).toString()
        // 1) 캠페인 목록
        const campRes  = await fetch(`${BASE}/${adAccount}/campaigns?${qs({ fields: 'id,name,status', limit: '200' })}`)
        const campData = await campRes.json()
        if (campData.error) throw new Error(`[${label || adAccount}] ${campData.error.message}`)

        // 2) 캠페인별 인사이트
        const insightParams: Record<string, string> = {
          fields: 'campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values',
          level: 'campaign',
          limit: '200',
        }
        if (since && until) { insightParams.time_range = JSON.stringify({ since, until }) }
        else { insightParams.date_preset = 'last_30d' }

        const insRes  = await fetch(`${BASE}/${adAccount}/insights?${qs(insightParams)}`)
        const insData = await insRes.json()

        // 3) 월별 인사이트 (최근 6개월)
        const monthlyRes  = await fetch(
          `${BASE}/${adAccount}/insights?${qs({
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
            accountLabel: label,  // 계정 태그 (온라인영업부/마케팅팀 구분용)
            accountId: adAccount,
          }
        })

        const monthly = (monthlyData.data ?? []).map((m: Record<string, unknown>) => {
          const spend   = Number(m.spend ?? 0)
          const revenue = extractActions(m.action_values as never)
          return {
            month:       String(m.date_start).slice(0, 7),
            spend,       revenue,
            impressions: Number(m.impressions ?? 0),
            clicks:      Number(m.clicks ?? 0),
            conversions: extractActions(m.actions as never),
          }
        })

        return { campaigns, monthly }
      })
    )

    // 성공한 계정의 결과 합산
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
      channel: 'Meta',
      campaigns: allCampaigns,
      monthly,
      accountCount: accounts.length,
      ...(errors.length > 0 && { partialErrors: errors }),
    })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Meta', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
