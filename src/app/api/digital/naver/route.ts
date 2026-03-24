import { NextResponse } from 'next/server'
import crypto from 'crypto'

const BASE = 'https://api.searchad.naver.com'
const MAX_CONCURRENT = 5  // 네이버 API rate limit 대응

// 동시 요청 수 제한 풀
async function poolAll<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

interface NaverAccount {
  label: string
  apiKey: string
  secretKey: string
  customerId: string
}

// 멀티 계정 JSON 또는 단일 env 폴백
function parseAccounts(): NaverAccount[] {
  const json = process.env.NAVER_ACCOUNTS
  if (json) {
    try { return JSON.parse(json) } catch { /* 폴백 */ }
  }
  const apiKey = process.env.NAVER_API_KEY
  const secretKey = process.env.NAVER_SECRET_KEY
  const customerId = process.env.NAVER_CUSTOMER_ID
  if (apiKey && secretKey && customerId) {
    return [{ label: '', apiKey, secretKey, customerId }]
  }
  return []
}

function signature(secretKey: string, timestamp: string, method: string, uri: string): string {
  const message = `${timestamp}.${method}.${uri}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

function naverHeaders(account: NaverAccount, method: string, uri: string): Record<string, string> {
  const ts = Date.now().toString()
  return {
    'X-Timestamp': ts,
    'X-API-KEY':   account.apiKey,
    'X-Customer':  account.customerId,
    'X-Signature': signature(account.secretKey, ts, method, uri),
    'Content-Type': 'application/json; charset=UTF-8',
  }
}

async function naverGet<T>(account: NaverAccount, uri: string): Promise<T> {
  // 시그니처에는 쿼리스트링 제외한 path만 사용
  const path = uri.split('?')[0]
  const res = await fetch(`${BASE}${uri}`, { headers: naverHeaders(account, 'GET', path) })
  return res.json()
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  if (s === 'ELIGIBLE' || s === 'RUNNING') return 'active'
  if (s === 'PAUSED' || s === 'SUSPENDED') return 'paused'
  return 'completed'
}

// 단일 계정의 캠페인 + 월별 데이터 조회
async function fetchAccount(account: NaverAccount) {
  const campaigns: Record<string, string>[] = await naverGet(account, '/ncc/campaigns')
  if (!Array.isArray(campaigns)) throw new Error(`[${account.label}] 캠페인 목록 조회 실패`)

  const today = new Date()
  const ago30 = new Date(today.getTime() - 30 * 86400000)
  const timeRange = JSON.stringify({ since: dateStr(ago30), until: dateStr(today) })

  // 캠페인별 통계 (동시 요청 제한)
  const statsArr = await poolAll(
    campaigns.map((c) => async () => {
      const uri = `/stats?id=${c.nccCampaignId}&fields=["clkCnt","impCnt","salesAmt","ctr","cpc","ror","convAmt"]&timeRange=${encodeURIComponent(timeRange)}&timeIncrement=allDays`
      try {
        const resp = await naverGet<{ data?: Record<string, unknown>[] }>(account, uri)
        const data = resp?.data ?? (Array.isArray(resp) ? resp : [])
        const row = data?.[0] ?? {}
        const spend       = Number(row.salesAmt ?? 0)
        const impressions = Number(row.impCnt ?? 0)
        const clicks      = Number(row.clkCnt ?? 0)
        const ctr         = Number(row.ctr ?? 0) * 100
        const cpc         = Number(row.cpc ?? 0)
        const revenue     = Number(row.convAmt ?? 0)   // convAmt = 전환금액(수익), ror = ROAS %
        const roas        = Number(row.ror ?? 0) / 100  // ror은 퍼센트(731.94% → 7.32x)
        const conversions = spend > 0 && roas > 0 ? revenue / (spend * roas) * roas : 0  // 전환수 추정 어려움, 건수 API 별도
        return {
          id:   c.nccCampaignId,
          name: c.campaignName ?? c.name,
          status: statusMap(c.userLock === 'true' ? 'PAUSED' : c.status),
          spend, impressions, clicks, ctr, cpc,
          conversions: 0,  // 네이버 Stats API는 전환 건수를 별도 제공하지 않음
          revenue,
          roas,
          accountLabel: account.label,
        }
      } catch {
        return null
      }
    }), MAX_CONCURRENT)

  // 월별 추이 (최근 6개월) — 동시 요청 제한 적용
  // 기존: 6개월×N캠페인 순차 → 개선: 6개월 병렬, 각 월에서 전체 캠페인 ID 1번 호출
  const campIds = campaigns.map(c => c.nccCampaignId)

  // 6개월 × N캠페인 전체를 하나의 풀에서 동시 10개씩 처리
  type MonthCampResult = { month: string; spend: number; revenue: number; impressions: number; clicks: number }
  const monthCampTasks: (() => Promise<MonthCampResult>)[] = []

  for (let i = 5; i >= 0; i--) {
    const d     = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const since = dateStr(d)
    const until = dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    const month = since.slice(0, 7)
    const tr    = JSON.stringify({ since, until })

    for (const cid of campIds) {
      monthCampTasks.push(async () => {
        const uri = `/stats?id=${cid}&fields=["clkCnt","impCnt","salesAmt","convAmt"]&timeRange=${encodeURIComponent(tr)}&timeIncrement=allDays`
        try {
          const resp = await naverGet<{ data?: Record<string, unknown>[] }>(account, uri)
          const data = resp?.data ?? (Array.isArray(resp) ? resp : [])
          const row = data?.[0] ?? {}
          return {
            month,
            spend:       Number(row.salesAmt ?? 0),
            revenue:     Number(row.convAmt ?? 0),
            impressions: Number(row.impCnt ?? 0),
            clicks:      Number(row.clkCnt ?? 0),
          }
        } catch { return { month, spend: 0, revenue: 0, impressions: 0, clicks: 0 } }
      })
    }
  }

  const monthCampResults = await poolAll(monthCampTasks, MAX_CONCURRENT)

  // 월별 합산
  const mMap: Record<string, { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }> = {}
  for (const r of monthCampResults) {
    if (!mMap[r.month]) mMap[r.month] = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
    mMap[r.month].spend       += r.spend
    mMap[r.month].revenue     += r.revenue
    mMap[r.month].impressions += r.impressions
    mMap[r.month].clicks      += r.clicks
  }

  const monthly = Object.entries(mMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  return { campaigns: statsArr.filter(Boolean), monthly }
}

export async function GET() {
  const accounts = parseAccounts()
  if (accounts.length === 0) {
    return NextResponse.json({ connected: false, channel: 'Naver', campaigns: [], monthly: [] })
  }

  try {
    // 계정 순차 처리 (네이버 API rate limit 대응 — 동시 요청 수 통제)
    const allCampaigns: Record<string, unknown>[] = []
    const monthlyMap: Record<string, { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }> = {}
    const errors: string[] = []

    for (const account of accounts) {
      try {
        const result = await fetchAccount(account)
        allCampaigns.push(...result.campaigns)
        for (const m of result.monthly) {
          if (!monthlyMap[m.month]) monthlyMap[m.month] = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
          monthlyMap[m.month].spend       += m.spend
          monthlyMap[m.month].revenue     += m.revenue
          monthlyMap[m.month].impressions += m.impressions
          monthlyMap[m.month].clicks      += m.clicks
          monthlyMap[m.month].conversions += m.conversions
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }))

    return NextResponse.json({
      connected: true,
      channel: 'Naver',
      campaigns: allCampaigns,
      monthly,
      accountCount: accounts.length,
      ...(errors.length > 0 && { partialErrors: errors }),
    })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Naver', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
