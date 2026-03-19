import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 개별 상품 수동입력 데이터 저장/업데이트
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { stylecd, colorcd, brandcd, ...fields } = body

    if (!stylecd || !colorcd || !brandcd) {
      return NextResponse.json({ error: '필수 필드 누락 (stylecd, colorcd, brandcd)' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('online_product_info')
      .upsert({
        stylecd,
        colorcd,
        brandcd,
        ...fields,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stylecd,colorcd,brandcd',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ product: data })
  } catch (err: unknown) {
    console.error('상품 저장 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// 대량 업데이트 (엑셀 업로드용)
export async function PUT(req: NextRequest) {
  try {
    const { items } = await req.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '업데이트할 항목이 없습니다' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    let successCount = 0
    let failCount = 0

    for (const item of items) {
      const { stylecd, colorcd, brandcd, ...fields } = item
      if (!stylecd || !colorcd || !brandcd) {
        failCount++
        continue
      }

      const { error } = await supabase
        .from('online_product_info')
        .upsert({
          stylecd,
          colorcd,
          brandcd,
          ...fields,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'stylecd,colorcd,brandcd',
        })

      if (error) {
        console.error('[online/product PUT] upsert error:', error.message, '| item:', stylecd, colorcd, brandcd)
        failCount++
      } else successCount++
    }

    return NextResponse.json({ successCount, failCount, total: items.length })
  } catch (err: unknown) {
    console.error('대량 업데이트 오류:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
