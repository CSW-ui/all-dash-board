import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

// 소재별 특성 지식베이스
const MATERIAL_KB: Record<string, string> = {
  '코튼': '부드러운 촉감, 뛰어난 흡습성, 통기성 우수. 세탁 시 다소 수축 가능',
  '면': '부드러운 촉감, 뛰어난 흡습성, 통기성 우수. 세탁 시 다소 수축 가능',
  '폴리': '구김 적음, 빠른 건조, 형태 유지력 우수, 가볍고 내구성 뛰어남',
  '폴리에스터': '구김 적음, 빠른 건조, 형태 유지력 우수, 가볍고 내구성 뛰어남',
  '나일론': '가볍고 강한 인장강도, 마찰에 강함, 빠른 건조, 발수 특성',
  '울': '뛰어난 보온성, 자연 항균·방취, 탄력 회복력 우수, 고급스러운 촉감',
  '양모': '뛰어난 보온성, 자연 항균·방취, 탄력 회복력 우수, 고급스러운 촉감',
  '린넨': '시원한 착용감, 높은 통기성, 자연스러운 질감, 내구성 우수',
  '레이온': '실크 같은 부드러움, 드레이프성 우수, 흡습성 좋음',
  '비스코스': '실크 같은 부드러움, 드레이프성 우수, 흡습성 좋음',
  '스판덱스': '뛰어난 신축성, 자유로운 움직임, 체형에 맞는 피팅',
  '엘라스틴': '뛰어난 신축성, 자유로운 움직임, 체형에 맞는 피팅',
  '텐셀': '실크 같은 부드러움, 친환경 소재, 흡습·속건 우수, 항균성',
  '리오셀': '실크 같은 부드러움, 친환경 소재, 흡습·속건 우수, 항균성',
  '아크릴': '울 대비 가벼움, 보온성, 세탁 용이, 합리적 가격대',
  '캐시미어': '극도로 부드러운 촉감, 가볍지만 뛰어난 보온성, 프리미엄 소재',
  '실크': '고급스러운 광택, 부드러운 촉감, 체온 조절, 저자극성',
  '데님': '견고한 내구성, 세탁할수록 자연스러운 워싱, 클래식한 텍스처',
  '코듀로이': '보온성 우수, 독특한 골지 질감, 빈티지 무드',
  '플리스': '가볍고 뛰어난 보온성, 부드러운 촉감, 빠른 건조',
  '고어텍스': '완벽한 방수·방풍, 뛰어난 투습성으로 땀 배출',
  '옥스포드': '두툼한 직조감, 내구성 우수, 세탁 후에도 형태 유지',
  '트윌': '사선 직조로 내구성 우수, 부드러운 표면감',
  '져지': '편안한 신축성, 부드러운 촉감, 활동성 우수',
  '니트': '부드러운 신축성, 편안한 착용감, 보온성',
}

const SYSTEM_PROMPT = `당신은 패션 소재 전문가이자 소비자 신뢰 기반 카피라이터입니다.
디자이너가 입력한 상품설명, 셀링포인트, 혼용율을 분석하여 소비자가 신뢰감을 느낄 수 있는 버전으로 리라이트합니다.

핵심 원칙:
1. **구체적 수치화**: 추상적 표현을 구체적 수치나 근거로 전환 ("두꺼운 원단" → "280g/㎡ 고중량 원단")
2. **사용 시나리오**: 실제 착용 상황을 제시 ("오버핏" → "레이어링 시에도 답답함 없는 오버핏")
3. **소재 과학**: 혼용율이 있으면 각 소재의 역할과 시너지를 과학적으로 설명
4. **내구성/품질 근거**: 세탁, 변형, 관리 측면의 실용 정보 추가
5. **감각적 표현**: 촉감, 시각, 착용감 등 오감을 자극하는 표현
6. **과장 금지**: 있는 사실만 기반, 소비자가 불신할 과장 표현 절대 금지

혼용율 분석 시:
- 각 소재가 혼방 비율에 따라 기여하는 역할을 구분
- 주소재(높은 비율)의 장점이 기본 특성, 부소재가 보완하는 기능 명시
- 예: "폴리 64 코튼 36" → 폴리에스터가 형태유지·속건을, 코튼이 피부 친화적 촉감을 담당

반드시 지정된 JSON 형식으로만 응답하세요.`

// 혼용율 파싱: "폴리 64 코튼 36" → [{name: "폴리", ratio: 64}, {name: "코튼", ratio: 36}]
function parseMaterialMix(mix: string): { name: string; ratio: number; traits: string }[] {
  if (!mix) return []

  const results: { name: string; ratio: number; traits: string }[] = []
  // "폴리에스터 64% 코튼 36%" 또는 "폴리 64 코튼 36" 패턴
  const pattern = /([가-힣a-zA-Z]+)\s*(\d+)%?/g
  let match
  while ((match = pattern.exec(mix)) !== null) {
    const name = match[1].trim()
    const ratio = parseInt(match[2])
    // 지식베이스에서 특성 찾기
    const traits = Object.entries(MATERIAL_KB).find(
      ([key]) => name.includes(key) || key.includes(name)
    )?.[1] || ''
    results.push({ name, ratio, traits })
  }
  return results
}

export async function POST(req: NextRequest) {
  try {
    const { product_description, selling_points, material_mix, stylenm, itemnm, brandcd, tagprice, fit_type } = await req.json()

    if (!product_description && (!selling_points || selling_points.length === 0) && !material_mix) {
      return NextResponse.json({ error: '리라이트할 내용이 없습니다. 상품설명, 셀링포인트, 혼용율 중 하나 이상 입력해주세요.' }, { status: 400 })
    }

    // 혼용율 분석
    const materials = parseMaterialMix(material_mix || '')
    const materialContext = materials.length > 0
      ? `\n\n소재 혼용율 분석:\n${materials.map(m =>
          `- ${m.name} ${m.ratio}%${m.traits ? `: ${m.traits}` : ''}`
        ).join('\n')}`
      : ''

    const BRAND_NAMES: Record<string, string> = {
      CO: '커버낫', WA: '와키윌리', LE: '리(Lee)', CK: '커버낫 키즈', LK: 'Lee Kids',
    }

    const prompt = `다음 디자이너 입력을 소비자 신뢰감 강화 버전으로 리라이트해주세요.

상품 기본 정보:
- 브랜드: ${BRAND_NAMES[brandcd] || brandcd}
- 상품명: ${stylenm || '미입력'}
- 품목: ${itemnm || '미입력'}
${tagprice ? `- 정가: ${tagprice.toLocaleString()}원` : ''}
${fit_type ? `- 핏: ${fit_type}` : ''}
${material_mix ? `- 소재 혼용율: ${material_mix}` : ''}
${materialContext}

디자이너 입력 원문:
${product_description ? `[상품설명]\n${product_description}` : '[상품설명] 미입력'}

${selling_points?.length ? `[셀링포인트]\n${selling_points.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}` : '[셀링포인트] 미입력'}

다음 JSON 형식으로 응답:
{
  "material_analysis": "소재 혼용율 기반 특성 분석 (혼용율이 없으면 빈 문자열). 각 소재의 역할과 소비자 체감 장점을 2~3줄로.",
  "description_rewrite": "상품설명 리라이트 (소비자 신뢰감 강화 버전. 원문의 의미를 살리되 구체적 근거, 사용 시나리오, 감각적 표현 추가. 4~6문장)",
  "selling_points_rewrite": ["리라이트된 셀링포인트1", "리라이트된 셀링포인트2", "리라이트된 셀링포인트3", "리라이트된 셀링포인트4", "리라이트된 셀링포인트5"],
  "care_tip": "소재 기반 세탁/관리 팁 (1~2문장)"
}`

    const content = await chatCompletion(
      SYSTEM_PROMPT,
      prompt,
      { temperature: 0.7, maxTokens: 1200 },
    )

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('JSON not found')
      const parsed = JSON.parse(jsonMatch[0])

      return NextResponse.json({
        material_analysis: parsed.material_analysis || '',
        description_rewrite: parsed.description_rewrite || '',
        selling_points_rewrite: Array.isArray(parsed.selling_points_rewrite) ? parsed.selling_points_rewrite : [],
        care_tip: parsed.care_tip || '',
      })
    } catch {
      return NextResponse.json({
        material_analysis: '',
        description_rewrite: content,
        selling_points_rewrite: [],
        care_tip: '',
      })
    }
  } catch (err: unknown) {
    console.error('AI 리라이트 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
