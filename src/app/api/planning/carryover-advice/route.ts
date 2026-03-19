import { NextResponse } from 'next/server'

const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const WEATHER_API_KEY = process.env.WEATHER_API_KEY!

export async function POST(req: Request) {
  const { staleStyles, channels, years, brand, question, history } = await req.json()

  // 기온 조회
  let weatherInfo = ''
  try {
    const today = new Date()
    const baseDate = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
    const wRes = await fetch(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${WEATHER_API_KEY}&pageNo=1&numOfRows=50&dataType=JSON&base_date=${baseDate}&base_time=0500&nx=60&ny=127`)
    const wJson = await wRes.json()
    const items = wJson.response?.body?.items?.item ?? []
    const tmx = items.find((i: any) => i.category === 'TMX')?.fcstValue
    const tmn = items.find((i: any) => i.category === 'TMN')?.fcstValue
    weatherInfo = `서울 오늘 최고 ${tmx ?? '?'}°C, 최저 ${tmn ?? '?'}°C`
  } catch {}

  const systemPrompt = `패션기업 B.cave의 이월재고 관리 전문가. 구체적인 할인율과 채널 전략을 제안하세요.

[규칙]
- 오래된 시즌(YEARCD 낮을수록)부터 우선 처분
- 아울렛: 30~50% 할인으로 대량 소진 가능
- 온라인: 20~40% 할인 + 프로모션으로 젊은층 타겟
- 백화점: 정가 유지 or 소폭 할인(10~20%), 브랜드 이미지 보호
- 기온 고려: 시즌 지난 아이템은 빠르게 처분
- 한국어로 구체적으로 답변`

  const dataContext = `[이월재고 데이터]\n브랜드: ${brand}\n기온: ${weatherInfo}\n적체상품: ${(staleStyles ?? []).slice(0,10).join(', ')}\n채널: ${(channels ?? []).join(', ')}\n연도: ${(years ?? []).join(', ')}`

  const messages: any[] = [{ role: 'system', content: systemPrompt }]

  if (question && history?.length) {
    messages.push({ role: 'user', content: dataContext + '\n\n위 데이터를 기반으로 질문에 답해주세요.' })
    messages.push({ role: 'assistant', content: '네, 이월재고 데이터를 확인했습니다. 무엇이든 물어보세요.' })
    for (const m of (history ?? [])) {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })
    }
  } else {
    messages.push({ role: 'user', content: `${dataContext}\n\n구체적으로 어떤 상품을 어느 채널에서 몇% 할인으로 판매해야 하는지 제안해주세요.` })
  }

  try {
    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4, max_tokens: 1000 }),
    })
    if (!res.ok) {
      console.error('OpenAI carryover error:', res.status, await res.text().then(t => t.slice(0, 300)))
      return NextResponse.json({ advice: 'AI 분석 오류가 발생했습니다.' })
    }
    const json = await res.json()
    return NextResponse.json({ advice: json.choices?.[0]?.message?.content ?? '' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
