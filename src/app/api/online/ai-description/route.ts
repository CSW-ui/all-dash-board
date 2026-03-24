import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

const BRAND_NAMES: Record<string, string> = {
  CO: '커버낫', WA: '와키윌리', LE: '리(Lee)', CK: '커버낫 키즈', LK: 'Lee Kids',
}

type ProductInput = {
  stylenm: string
  itemnm: string
  colornm: string
  tagprice: number
  material_mix?: string
  brandcd: string
  product_description?: string
  selling_points?: string[]
  fit_type?: string
}

// AI 상품설명 자동 생성 (매니저 교육용 + 온라인 상세페이지용)
export async function POST(req: NextRequest) {
  try {
    const { products, mode } = await req.json()

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: '상품 정보가 없습니다' }, { status: 400 })
    }

    // 최대 10개씩 처리
    const batch = products.slice(0, 10)

    // mode: 'detail' = 새로운 상세 생성 (매니저+온라인), 기본 = 기존 호환
    const isDetailMode = mode === 'detail'

    const results = await Promise.all(
      batch.map(async (product: ProductInput) => {
        const brandName = BRAND_NAMES[product.brandcd] || product.brandcd

        const prompt = isDetailMode
          ? buildDetailPrompt(product, brandName)
          : buildSimplePrompt(product, brandName)

        try {
          const content = await chatCompletion(
            isDetailMode ? DETAIL_SYSTEM_PROMPT : '패션 상품 설명 전문 카피라이터입니다. 한국어로 작성하세요.',
            prompt,
            { temperature: 0.7, maxTokens: isDetailMode ? 1500 : 500 },
          )

          if (isDetailMode) {
            return { ...parseDetailResponse(content), success: true, raw: content }
          }

          return { ...parseSimpleResponse(content), success: true, raw: content }
        } catch (aiErr) {
          return {
            description: '',
            descriptionManager: '',
            descriptionOnline: '',
            materialAnalysis: '',
            sellingPoints: [],
            sellingPointsManager: [],
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

// 상세 생성 시스템 프롬프트
const DETAIL_SYSTEM_PROMPT = `당신은 패션 업계 10년차 소재 전문가이자 상품 카피라이터입니다.
소재의 물리적 특성, 착용감, 관리법을 정확히 알고 있으며, 이를 소비자가 이해하기 쉬운 언어로 전달합니다.

핵심 원칙:
- 소재명을 들으면 해당 소재의 특성(통기성, 내구성, 촉감, 신축성, 세탁성 등)을 자동으로 분석
- 혼용률에 따라 각 소재가 기여하는 장점을 구체적으로 설명
- 과장 없이 신뢰감 있는 톤 유지
- "매니저 교육용"은 직원이 고객에게 구두로 설명할 수 있는 전문적 내용
- "온라인 상세페이지용"은 구매 전환을 유도하는 감성적이면서 신뢰감 있는 톤

반드시 지정된 JSON 형식으로만 응답하세요.`

// 상세 프롬프트 (매니저용 + 온라인용)
function buildDetailPrompt(product: ProductInput, brandName: string): string {
  return `패션 브랜드 "${brandName}"의 상품에 대해 2가지 버전의 상세 설명을 작성해주세요.

상품 정보:
- 상품명: ${product.stylenm}
- 품목: ${product.itemnm}
- 컬러: ${product.colornm}
- 정가: ${product.tagprice?.toLocaleString()}원
${product.material_mix ? `- 소재 혼용률: ${product.material_mix}` : '- 소재: 정보 없음 (일반적인 해당 품목 소재 기준으로 작성)'}
${product.fit_type ? `- 핏: ${product.fit_type}` : ''}
${product.product_description ? `- 디자이너 메모: ${product.product_description}` : ''}
${product.selling_points?.length ? `- 기존 셀링포인트: ${product.selling_points.join(', ')}` : ''}

다음 JSON 형식으로 응답해주세요:
{
  "materialAnalysis": "소재 특성 분석 (각 소재별 장점을 2~3줄로 설명. 혼용률이 있으면 각 소재가 기여하는 역할 명시)",
  "descriptionManager": "매니저 교육용 설명 (5~7문장. 직원이 고객에게 설명할 때 활용. 소재 장점, 착용 팁, 관리법 포함. '이 제품은~' 형식의 설명체)",
  "sellingPointsManager": ["매니저용 셀링포인트1 (소재 관점)", "매니저용 셀링포인트2", "매니저용 셀링포인트3", "매니저용 셀링포인트4"],
  "descriptionOnline": "온라인 상세페이지용 설명 (4~6문장. 감성적이면서 신뢰감 있는 톤. 소재 장점을 자연스럽게 녹여서 구매 욕구 자극)",
  "sellingPointsOnline": ["온라인용 셀링포인트1", "온라인용 셀링포인트2", "온라인용 셀링포인트3", "온라인용 셀링포인트4", "온라인용 셀링포인트5"],
  "seoTags": ["SEO키워드1", "SEO키워드2", "SEO키워드3", "SEO키워드4", "SEO키워드5"],
  "careTip": "간단한 세탁/관리 팁 (1~2문장)"
}`
}

// 기존 호환 프롬프트
function buildSimplePrompt(product: ProductInput, brandName: string): string {
  return `패션 브랜드 "${brandName}"의 상품 상세페이지 설명을 작성해주세요.

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
}

// 상세 응답 파싱
function parseDetailResponse(content: string) {
  try {
    // JSON 블록 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found')

    const parsed = JSON.parse(jsonMatch[0])
    return {
      materialAnalysis: parsed.materialAnalysis || '',
      descriptionManager: parsed.descriptionManager || '',
      sellingPointsManager: Array.isArray(parsed.sellingPointsManager) ? parsed.sellingPointsManager : [],
      descriptionOnline: parsed.descriptionOnline || '',
      sellingPointsOnline: Array.isArray(parsed.sellingPointsOnline) ? parsed.sellingPointsOnline : [],
      seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [],
      careTip: parsed.careTip || '',
    }
  } catch {
    // JSON 파싱 실패 시 텍스트 기반 파싱 시도
    return {
      materialAnalysis: '',
      descriptionManager: content,
      sellingPointsManager: [],
      descriptionOnline: content,
      sellingPointsOnline: [],
      seoTags: [],
      careTip: '',
    }
  }
}

// 기존 호환 파싱
function parseSimpleResponse(content: string) {
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

  return { description, sellingPoints, seoTags }
}
