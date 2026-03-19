import { NextResponse } from 'next/server'
import crypto from 'crypto'

const BASE        = 'https://api.searchad.naver.com'
const API_KEY     = process.env.NAVER_API_KEY
const SECRET_KEY  = process.env.NAVER_SECRET_KEY
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID

function signature(timestamp: string, method: string, uri: string): string {
  const message = `${timestamp}\n${method}\n${uri}`
  return crypto.createHmac('sha256', SECRET_KEY!).update(message).digest('base64')
}

function naverHeaders(method: string, uri: string): Record<string, string> {
  const ts = Date.now().toString()
  return {
    'X-Timestamp': ts,
    'X-API-KEY':   API_KEY!,
    'X-Customer':  CUSTOMER_ID!,
    'X-Signature': signature(ts, method, uri),
    'Content-Type': 'application/json; charset=UTF-8',
  }
}

async function naverGet<T>(uri: string): Promise<T> {
  const res  = await fetch(`${BASE}${uri}`, { headers: naverHeaders('GET', uri) })
  const data = await res.json()
  return data
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function statusMap(s: string): 'active' | 'paused' | 'completed' {
  if (s === 'ELIGIBLE' || s === 'RUNNING') return 'active'
  if (s === 'PAUSED' || s === 'SUSPENDED') return 'paused'
  return 'completed'
}

export async function GET() {
  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    return NextResponse.json({ connected: false, channel: 'Naver', campaigns: [], monthly: [] })
  }

  try {
    // 캠페인 목록
    const campaigns: Record<string, string>[] = await naverGet('/ncc/campaigns')
    if (!Array.isArray(campaigns)) throw new Error('캠페인 목록 조회 실패')

    // 최근 30일 기간
    const today = new Date()
    const ago30 = new Date(today.getTime() - 30 * 86400000)
    const timeRange = JSON.stringify({ since: dateStr(ago30), until: dateStr(today) })

    // 각 캠페인의 통계 (병렬 fetch)
    const statsArr = await Promise.all(
      campaigns.map(async (c) => {
        const uri = `/stats?id=${c.campaignId}&fields=["clkCnt","impCnt","salesAmt","ctr","cpc","ror","convAmt"]&timeRange=${encodeURIComponent(timeRange)}&timeIncrement=allDays`
        try {
          const data: Record<string, unknown>[] = await naverGet(uri)
          const row = data?.[0] ?? {}
          const spend       = Number(row.salesAmt ?? 0)   // 광고비
          const impressions = Number(row.impCnt ?? 0)
          const clicks      = Number(row.clkCnt ?? 0)
          const ctr         = Number(row.ctr ?? 0) * 100  // ratio → %
          const cpc         = Number(row.cpc ?? 0)
          const conversions = Number(row.convAmt ?? 0)    // 전환수 (네이버는 convAmt가 전환금액)
          const revenue     = Number(row.ror ?? 0) * spend // ror = ROAS, revenue = ror * spend
          return {
            id:   c.campaignId,
            name: c.campaignName,
            status: statusMap(c.userLock === 'true' ? 'PAUSED' : c.status),
            spend, impressions, clicks, ctr, cpc,
            conversions: Math.round(conversions),
            revenue,
            roas: spend > 0 ? revenue / spend : 0,
          }
        } catch {
          return null
        }
      })
    )

    const validCampaigns = statsArr.filter(Boolean)

    // 월별 추이 (최근 6개월)
    const monthly: { month: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const since = dateStr(d)
      const until = dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      const month = since.slice(0, 7)

      // 계정 전체 통계 (첫 캠페인 ID를 대표로 사용하거나 여러 캠페인 합산)
      let mSpend = 0, mRevenue = 0, mImp = 0, mClk = 0, mConv = 0
      for (const c of campaigns) {
        const uri = `/stats?id=${c.campaignId}&fields=["clkCnt","impCnt","salesAmt","ror","convAmt"]&timeRange=${encodeURIComponent(JSON.stringify({ since, until }))}&timeIncrement=allDays`
        try {
          const data: Record<string, unknown>[] = await naverGet(uri)
          const row = data?.[0] ?? {}
          const spend = Number(row.salesAmt ?? 0)
          mSpend  += spend
          mRevenue += Number(row.ror ?? 0) * spend
          mImp    += Number(row.impCnt ?? 0)
          mClk    += Number(row.clkCnt ?? 0)
          mConv   += Number(row.convAmt ?? 0)
        } catch { /* skip */ }
      }
      monthly.push({ month, spend: mSpend, revenue: mRevenue, impressions: mImp, clicks: mClk, conversions: Math.round(mConv) })
    }

    return NextResponse.json({ connected: true, channel: 'Naver', campaigns: validCampaigns, monthly })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err), channel: 'Naver', campaigns: [], monthly: [] },
      { status: 500 }
    )
  }
}
