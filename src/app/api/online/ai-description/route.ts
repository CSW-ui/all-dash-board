import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL || undefined,
})

// AI 상품설명 자동 생성
export async function POST(req: NextRequest) {
  try {
    const { products } = await req.json()

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: '상품 정보가 없습니다' }, { status: 400 })
    }

    // 최대 10개씩 처리
    const batch = products.slice(0, 10)

    const results = await Promise.all(
      batch.map(async (product: {
        stylenm: string; itemnm: string; colornm: string;
        tagprice: number; material_mix?: string; brandcd: string;
      }) => {
        const brandName = {
          CO: '커버낫', WA: '와키윌리', LE: '리', CK: '커버낫 키즈', LK: 'Lee Kids'
        }[product.brandcd] || product.brandcd

        const prompt = `패션 브랜드 "${brandName}"의 상품 상세페이지 설명을 작성해주세요.

상품 정보:
- 상품명: ${product.stylenm}
- 품목: ${product.itemnm}
- 컬러: ${product.colornm}
- 정가: ${product.tagprice?.toLocaleString()}원
${product.material_mix ? `- 소재: ${product.material_mix}` : ''}

다음 형식으로 작성:
1. **상품 설명** (3~4문장, 자연스러운 톤)
2. **셀링포인트** (3~5개, 각 한 줄)
3. **SEO 키워드** (5~7개, 쉼표 구분)

한국어로 작성하고, 패션 이커머스에 적합한 톤으로 작성해주세요.`

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          })

          const content = completion.choices[0]?.message?.content || ''

          // 파싱
          const descMatch = content.match(/상품 설명[*]*[:\s]*([\s\S]*?)(?=셀링포인트|$)/i)
          const spMatch = content.match(/셀링포인트[*]*[:\s]*([\s\S]*?)(?=SEO|$)/i)
          const seoMatch = content.match(/SEO[*\s키워드]*[:\s]*([\s\S]*?)$/i)

          const description = descMatch?.[1]?.trim().replace(/^\*+|\*+$/g, '').trim() || content
          const sellingPoints = spMatch?.[1]
            ?.split('\n')
            .map(s => s.replace(/^[-•*\d.)\s]+/, '').trim())
            .filter(Boolean) || []
          const seoTags = seoMatch?.[1]
            ?.split(/[,，\n]/)
            .map(s => s.trim().replace(/^[-•*\s]+/, '').trim())
            .filter(Boolean) || []

          return {
            stylecd: product.stylenm,
            description,
            sellingPoints,
            seoTags,
            raw: content,
            success: true,
          }
        } catch (aiErr) {
          return {
            stylecd: product.stylenm,
            description: '',
            sellingPoints: [],
            seoTags: [],
            success: false,
            error: String(aiErr),
          }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (err: unknown) {
    console.error('AI 설명 생성 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
