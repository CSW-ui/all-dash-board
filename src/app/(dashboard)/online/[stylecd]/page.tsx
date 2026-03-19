'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Sparkles, Upload, X, GripVertical,
  ImageIcon, CheckCircle2, Eye, Package, Truck, Paintbrush, ShoppingBag, ClipboardList
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type ProductInfo = {
  stylecd: string; stylenm: string; brandcd: string; yearcd: string;
  seasonnm: string; itemnm: string; sexnm: string; colorcd: string;
  colornm: string; chasu: string; tagprice: number; precost: number;
  orignnm: string; manufacturer: string; sizes: string; ordqty: number;
  plangbnm: string;
}

type ManualFields = {
  // 소싱
  material_mix: string; wash_care: string; production_country: string;
  production_factory: string; logistics_due_date: string;
  sample_arrival_date: string; sample_received_date: string; sourcing_manager: string;
  // 디자인
  product_name_kr: string; product_name_en: string; fit_type: string;
  product_description: string; product_description_online: string;
  selling_points: string[]; size_spec: string; detail_shot_code: string;
  detail_upgrade: string; design_complete: string; designer_name: string; seo_tags: string[];
  // 이미지
  thumbnail_urls: string[]; lookbook_urls: string[]; detail_urls: string[];
  // 온라인
  launch_date: string; launch_platforms: string[]; musinsa_exclusive: string;
  online_exclusive: boolean; image_received: boolean;
  sample_delivered_date: string; sample_delivered_size: string;
  hanger_yn: boolean; line_info: string; setup_yn: boolean;
  // 기획
  is_carryover: boolean; original_stylecd: string; set_stylecd: string; planning_manager: string;
  // 상태
  status: string;
}

const BRAND_NAMES: Record<string, string> = {
  CO: '커버낫', WA: '와키윌리', LE: '리', CK: '커버낫 키즈', LK: 'Lee Kids'
}
const FIT_OPTIONS = ['레귤러핏', '세미 오버핏', '오버핏', '슬림핏', '릴렉스핏']
const PLATFORM_OPTIONS = ['무신사', '29CM', 'W컨셉', '카카오', '네이버', '자사몰', 'SSG', '하이버']

const DEFAULT_FORM: ManualFields = {
  material_mix: '', wash_care: '', production_country: '', production_factory: '',
  logistics_due_date: '', sample_arrival_date: '', sample_received_date: '', sourcing_manager: '',
  product_name_kr: '', product_name_en: '', fit_type: '', product_description: '',
  product_description_online: '', selling_points: [], size_spec: '', detail_shot_code: '',
  detail_upgrade: '', design_complete: '', designer_name: '', seo_tags: [],
  thumbnail_urls: [], lookbook_urls: [], detail_urls: [],
  launch_date: '', launch_platforms: [], musinsa_exclusive: '', online_exclusive: false,
  image_received: false, sample_delivered_date: '', sample_delivered_size: '',
  hanger_yn: false, line_info: '', setup_yn: false,
  is_carryover: false, original_stylecd: '', set_stylecd: '', planning_manager: '',
  status: 'draft',
}

export default function ProductDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const stylecd = params.stylecd as string
  const colorcd = searchParams.get('color') || ''
  const brandcd = searchParams.get('brand') || ''

  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [form, setForm] = useState<ManualFields>({ ...DEFAULT_FORM })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [newSp, setNewSp] = useState('')
  const [newTag, setNewTag] = useState('')
  const [activeSection, setActiveSection] = useState('sourcing')

  const supabase = createSupabaseBrowserClient()
  const imgRef = useRef<HTMLInputElement>(null)
  const [uploadType, setUploadType] = useState<'thumbnail' | 'lookbook' | 'detail'>('thumbnail')

  const fetchProduct = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ brand: brandcd, year: '2026' })
      const res = await fetch(`/api/online/products?${p}`)
      const data = await res.json()
      const found = data.products?.find((pr: ProductInfo) =>
        pr.stylecd === stylecd && pr.colorcd === colorcd
      )
      if (found) {
        setProduct(found)
        if (found.manual) {
          setForm(prev => {
            const merged = { ...prev }
            Object.keys(prev).forEach(key => {
              if (found.manual[key] !== undefined && found.manual[key] !== null) {
                (merged as Record<string, unknown>)[key] = found.manual[key]
              }
            })
            return merged
          })
        }
      }

      // 소싱 데이터에서 혼용률/세탁코드 가져오기
      try {
        const srcRes = await fetch(`/api/online/sourcing?brand=${brandcd}`)
        const srcData = await srcRes.json()
        const srcItem = srcData.items?.find((s: { stylecd: string; colorcd: string }) =>
          s.stylecd === stylecd && s.colorcd === colorcd
        )
        if (srcItem) {
          setForm(prev => ({
            ...prev,
            // 소싱에서 입력한 값이 있고, 상세페이지에 아직 없으면 채우기
            material_mix: prev.material_mix || srcItem.materialMix || '',
            wash_care: prev.wash_care || srcItem.washCode || '',
            production_country: prev.production_country || srcItem.country || '',
            production_factory: prev.production_factory || srcItem.vendor || '',
            sample_arrival_date: prev.sample_arrival_date || srcItem.sampleDeliveryDate || '',
          }))
        }
      } catch { /* 소싱 데이터 없으면 무시 */ }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [stylecd, colorcd, brandcd])

  useEffect(() => { fetchProduct() }, [fetchProduct])

  const setField = (key: keyof ManualFields, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // 저장
  const handleSave = async (newStatus?: string) => {
    setSaving(true)
    try {
      await fetch('/api/online/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stylecd, colorcd, brandcd, ...form, status: newStatus || form.status }),
      })
      if (newStatus) setField('status', newStatus)
      alert('저장 완료')
    } catch (err) { console.error(err); alert('저장 오류') }
    finally { setSaving(false) }
  }

  // AI 설명 생성
  const handleAiGenerate = async () => {
    if (!product) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/online/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{
            stylenm: form.product_name_kr || product.stylenm,
            itemnm: product.itemnm, colornm: product.colornm,
            tagprice: product.tagprice, material_mix: form.material_mix, brandcd: product.brandcd,
          }]
        }),
      })
      const data = await res.json()
      const r = data.results?.[0]
      if (r?.success) {
        setForm(prev => ({
          ...prev,
          product_description_online: r.description,
          selling_points: r.sellingPoints,
          seo_tags: r.seoTags,
        }))
      }
    } catch (err) { console.error(err) }
    finally { setAiLoading(false) }
  }

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const path = `product-images/${brandcd}/${stylecd}/${colorcd}/${uploadType}_${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('product-images').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
        urls.push(urlData.publicUrl)
      }
    }
    if (urls.length > 0) {
      const field = `${uploadType}_urls` as keyof ManualFields
      setForm(prev => ({ ...prev, [field]: [...(prev[field] as string[]), ...urls] }))
    }
    e.target.value = ''
  }

  const removeImage = (type: string, idx: number) => {
    const field = `${type}_urls` as keyof ManualFields
    setForm(prev => ({ ...prev, [field]: (prev[field] as string[]).filter((_, i) => i !== idx) }))
  }

  // 셀링포인트/태그
  const addSp = () => { if (newSp.trim()) { setField('selling_points', [...form.selling_points, newSp.trim()]); setNewSp('') } }
  const removeSp = (i: number) => setField('selling_points', form.selling_points.filter((_, idx) => idx !== i))
  const addTag = () => { if (newTag.trim()) { setField('seo_tags', [...form.seo_tags, newTag.trim()]); setNewTag('') } }
  const removeTag = (i: number) => setField('seo_tags', form.seo_tags.filter((_, idx) => idx !== i))

  const togglePlatform = (p: string) => {
    setField('launch_platforms', form.launch_platforms.includes(p)
      ? form.launch_platforms.filter(x => x !== p) : [...form.launch_platforms, p])
  }

  if (loading) return <div className="p-6 text-center text-gray-400">로딩 중...</div>
  if (!product) return <div className="p-6 text-center text-gray-400">상품을 찾을 수 없습니다</div>

  const sections = [
    { id: 'sourcing', label: '소싱', icon: Truck },
    { id: 'design', label: '디자인', icon: Paintbrush },
    { id: 'online', label: '온라인', icon: ShoppingBag },
    { id: 'planning', label: '기획', icon: ClipboardList },
    { id: 'image', label: '이미지', icon: ImageIcon },
  ]

  return (
    <div className="p-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/online')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {form.product_name_kr || product.stylenm}
          </h1>
          <p className="text-sm text-gray-500">
            {BRAND_NAMES[product.brandcd]} · {product.stylecd} · {product.colornm} · {product.itemnm}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave()} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
          </button>
          {form.status !== 'complete' && (
            <button onClick={() => handleSave('complete')} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> 완료
            </button>
          )}
        </div>
      </div>

      {/* 2컬럼 */}
      <div className="grid grid-cols-5 gap-6">
        {/* 왼쪽: 편집 (3칸) */}
        <div className="col-span-3 space-y-4">
          {/* 기본정보 (자동) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Snowflake 자동
            </h3>
            <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-xs">
              <Info label="상품코드" value={product.stylecd} />
              <Info label="컬러" value={`${product.colornm} (${product.colorcd})`} />
              <Info label="품목" value={product.itemnm} />
              <Info label="성별" value={product.sexnm} />
              <Info label="정가" value={`${product.tagprice?.toLocaleString()}원`} />
              <Info label="원가" value={`${product.precost?.toLocaleString()}원`} />
              <Info label="발주수량" value={`${product.ordqty?.toLocaleString()}pcs`} />
              <Info label="사이즈" value={product.sizes} />
              <Info label="원산지" value={product.orignnm || '—'} />
              <Info label="제조사" value={product.manufacturer || '—'} />
              <Info label="시즌" value={`${product.yearcd} ${product.seasonnm}`} />
              <Info label="구분" value={product.plangbnm || '—'} />
            </div>
          </div>

          {/* 섹션 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {sections.map(s => {
              const Icon = s.icon
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all flex-1 justify-center ${
                    activeSection === s.id ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              )
            })}
          </div>

          {/* ── 소싱팀 ── */}
          {activeSection === 'sourcing' && (
            <Section title="소싱팀 입력">
              <Row2>
                <Field label="혼용율" placeholder="겉감,폴리에스터,100%|안감,폴리에스터,100%"
                  value={form.material_mix} onChange={v => setField('material_mix', v)} />
                <Field label="세탁코드" placeholder="BK-T02"
                  value={form.wash_care} onChange={v => setField('wash_care', v)} />
              </Row2>
              <Row2>
                <Field label="생산국" placeholder="베트남, 중국"
                  value={form.production_country} onChange={v => setField('production_country', v)} />
                <Field label="생산처" placeholder="(주)야심"
                  value={form.production_factory} onChange={v => setField('production_factory', v)} />
              </Row2>
              <Row2>
                <DateField label="물류 예상 납기일" value={form.logistics_due_date}
                  onChange={v => setField('logistics_due_date', v)} />
                <DateField label="수납제품전달 예정일자" value={form.sample_arrival_date}
                  onChange={v => setField('sample_arrival_date', v)} />
              </Row2>
              <Row2>
                <DateField label="소싱 입수 날짜" value={form.sample_received_date}
                  onChange={v => setField('sample_received_date', v)} />
                <Field label="담당 소싱MD" placeholder="담당자명"
                  value={form.sourcing_manager} onChange={v => setField('sourcing_manager', v)} />
              </Row2>
            </Section>
          )}

          {/* ── 디자인팀 ── */}
          {activeSection === 'design' && (
            <Section title="디자인팀 입력" action={
              <button onClick={handleAiGenerate} disabled={aiLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-violet-100 text-violet-700 rounded-md hover:bg-violet-200 disabled:opacity-50">
                <Sparkles className="w-3 h-3" /> {aiLoading ? 'AI 생성 중...' : 'AI 자동생성'}
              </button>
            }>
              <Row2>
                <Field label="제품명 (한글)" placeholder="온라인용 상품명"
                  value={form.product_name_kr} onChange={v => setField('product_name_kr', v)} />
                <Field label="제품명 (영어)" placeholder="PRODUCT NAME"
                  value={form.product_name_en} onChange={v => setField('product_name_en', v)} />
              </Row2>
              <Row2>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">핏</label>
                  <select value={form.fit_type} onChange={e => setField('fit_type', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                    <option value="">선택</option>
                    {FIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <Field label="담당 디자이너" placeholder="디자이너명"
                  value={form.designer_name} onChange={v => setField('designer_name', v)} />
              </Row2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">디테일 설명 (디자인팀)</label>
                <textarea rows={4} placeholder="- 레귤러 핏&#10;- 가슴 심볼 로고 프린트&#10;- YKK 나일론 2WAY 지퍼"
                  value={form.product_description}
                  onChange={e => setField('product_description', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">디테일 설명2 (온라인팀 문장형)</label>
                <textarea rows={4} placeholder="레귤러 핏으로 착용되며, 가볍고 부드러운 소재를 사용했습니다..."
                  value={form.product_description_online}
                  onChange={e => setField('product_description_online', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
              </div>
              {/* 셀링포인트 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">셀링포인트</label>
                <div className="space-y-1 mb-2">
                  {form.selling_points.map((sp, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                      <GripVertical className="w-3 h-3 text-gray-300" />
                      <span className="text-sm flex-1">{sp}</span>
                      <button onClick={() => removeSp(i)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="셀링포인트 추가..." value={newSp}
                    onChange={e => setNewSp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSp()}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
                  <button onClick={addSp} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
              </div>
              <Row2>
                <Field label="사이즈 스펙" placeholder="사이즈 이미지 또는 텍스트"
                  value={form.size_spec} onChange={v => setField('size_spec', v)} />
                <Field label="요청 디테일컷 코드" placeholder="BW-T02"
                  value={form.detail_shot_code} onChange={v => setField('detail_shot_code', v)} />
              </Row2>
              <Row2>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상세고도화</label>
                  <select value={form.detail_upgrade} onChange={e => setField('detail_upgrade', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                    <option value="">선택</option>
                    <option value="상세고도화">상세고도화</option>
                    <option value="IMC">IMC</option>
                    <option value="해당없음">해당없음</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">완료 여부</label>
                  <select value={form.design_complete} onChange={e => setField('design_complete', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                    <option value="">미완료</option>
                    <option value="완료">완료</option>
                  </select>
                </div>
              </Row2>
              {/* SEO */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SEO 키워드</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.seo_tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                      {tag}<button onClick={() => removeTag(i)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="키워드..." value={newTag}
                    onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
                  <button onClick={addTag} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
              </div>
            </Section>
          )}

          {/* ── 온라인팀 ── */}
          {activeSection === 'online' && (
            <Section title="온라인팀 입력">
              <Row2>
                <DateField label="온라인 발매일" value={form.launch_date}
                  onChange={v => setField('launch_date', v)} />
                <Field label="무신사 단독" placeholder="~4차"
                  value={form.musinsa_exclusive} onChange={v => setField('musinsa_exclusive', v)} />
              </Row2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">발매 플랫폼</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button key={p} onClick={() => togglePlatform(p)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        form.launch_platforms.includes(p) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
              <Row2>
                <DateField label="수납샘플 전달일자 (온라인팀 입수)" value={form.sample_delivered_date}
                  onChange={v => setField('sample_delivered_date', v)} />
                <Field label="수납샘플 전달 사이즈" placeholder="M, L"
                  value={form.sample_delivered_size} onChange={v => setField('sample_delivered_size', v)} />
              </Row2>
              <Row2>
                <Field label="라인" placeholder="라인 정보"
                  value={form.line_info} onChange={v => setField('line_info', v)} />
                <div className="space-y-2 pt-5">
                  <Toggle label="온라인 단독" checked={form.online_exclusive}
                    onChange={v => setField('online_exclusive', v)} />
                  <Toggle label="이미지 수령" checked={form.image_received}
                    onChange={v => setField('image_received', v)} />
                  <Toggle label="행거 여부" checked={form.hanger_yn}
                    onChange={v => setField('hanger_yn', v)} />
                  <Toggle label="셋업 여부" checked={form.setup_yn}
                    onChange={v => setField('setup_yn', v)} />
                </div>
              </Row2>
            </Section>
          )}

          {/* ── 기획팀 ── */}
          {activeSection === 'planning' && (
            <Section title="기획팀 입력">
              <Row2>
                <Field label="기존품번 (고객후기 유지)" placeholder="CO2507BP01"
                  value={form.original_stylecd} onChange={v => setField('original_stylecd', v)} />
                <Field label="세트 상품 품번" placeholder="CO2602SO01"
                  value={form.set_stylecd} onChange={v => setField('set_stylecd', v)} />
              </Row2>
              <Row2>
                <Field label="기획팀 담당자" placeholder="담당자명"
                  value={form.planning_manager} onChange={v => setField('planning_manager', v)} />
                <div className="pt-5">
                  <Toggle label="캐리오버" checked={form.is_carryover}
                    onChange={v => setField('is_carryover', v)} />
                </div>
              </Row2>
            </Section>
          )}

          {/* ── 이미지 ── */}
          {activeSection === 'image' && (
            <Section title="이미지 관리">
              <ImageSection label="섬네일 (대표 상품컷)" images={form.thumbnail_urls}
                onAdd={() => { setUploadType('thumbnail'); imgRef.current?.click() }}
                onRemove={i => removeImage('thumbnail', i)} />
              <ImageSection label="착용컷 (모델 착장)" images={form.lookbook_urls}
                onAdd={() => { setUploadType('lookbook'); imgRef.current?.click() }}
                onRemove={i => removeImage('lookbook', i)} />
              <ImageSection label="디테일컷" images={form.detail_urls}
                onAdd={() => { setUploadType('detail'); imgRef.current?.click() }}
                onRemove={i => removeImage('detail', i)} />
              <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </Section>
          )}
        </div>

        {/* 오른쪽: 미리보기 (2칸) */}
        <div className="col-span-2">
          <div className="sticky top-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">상세페이지 미리보기</span>
            </div>
            <div className="p-4 max-h-[calc(100vh-120px)] overflow-y-auto space-y-3">
              {/* 섬네일 */}
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {form.thumbnail_urls.length > 0 ? (
                  <img src={form.thumbnail_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-1" />
                    <p className="text-[10px]">섬네일 없음</p>
                  </div>
                )}
              </div>
              {form.thumbnail_urls.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {form.thumbnail_urls.map((u, i) => (
                    <img key={i} src={u} alt="" className="w-14 h-14 object-cover rounded border" />
                  ))}
                </div>
              )}

              <p className="text-[10px] text-gray-400">{BRAND_NAMES[product.brandcd]}</p>
              <h2 className="text-base font-bold text-gray-900">
                {form.product_name_kr || product.stylenm}
              </h2>
              {form.product_name_en && (
                <p className="text-xs text-gray-400">{form.product_name_en}</p>
              )}
              <p className="text-base font-bold">{product.tagprice?.toLocaleString()}원</p>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">컬러</span>
                <span className="font-medium">{product.colornm}</span>
                {form.fit_type && <>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-400">핏</span>
                  <span className="font-medium">{form.fit_type}</span>
                </>}
              </div>

              <div className="flex gap-1 flex-wrap">
                {product.sizes?.split(',').map(s => (
                  <span key={s} className="px-2 py-0.5 text-[10px] border border-gray-300 rounded">{s}</span>
                ))}
              </div>

              <hr />

              {/* 착용컷 */}
              {form.lookbook_urls.map((u, i) => (
                <img key={i} src={u} alt="" className="w-full rounded-lg" />
              ))}

              {/* 상품설명 (온라인팀 문장형) */}
              {form.product_description_online && (
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                  {form.product_description_online}
                </p>
              )}

              {/* 디테일 설명 (디자인팀) */}
              {form.product_description && !form.product_description_online && (
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                  {form.product_description}
                </p>
              )}

              {/* 셀링포인트 */}
              {form.selling_points.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5">POINT</p>
                  {form.selling_points.map((sp, i) => (
                    <p key={i} className="text-xs text-gray-700 flex gap-1.5 mb-0.5">
                      <span className="text-pink-500">•</span>{sp}
                    </p>
                  ))}
                </div>
              )}

              {/* 디테일컷 */}
              {form.detail_urls.map((u, i) => (
                <img key={i} src={u} alt="" className="w-full rounded-lg" />
              ))}

              <hr />

              {/* 상품정보 */}
              <div className="text-xs space-y-1.5">
                <p className="text-sm font-semibold text-gray-700 mb-2">상품 정보</p>
                {form.material_mix && <InfoLine label="소재" value={form.material_mix} />}
                {form.wash_care && <InfoLine label="세탁" value={form.wash_care} />}
                {(form.production_country || product.orignnm) && (
                  <InfoLine label="원산지" value={form.production_country || product.orignnm} />
                )}
                {(form.production_factory || product.manufacturer) && (
                  <InfoLine label="제조사" value={form.production_factory || product.manufacturer || ''} />
                )}
                {form.size_spec && <InfoLine label="사이즈" value={form.size_spec} />}
              </div>

              {/* 발매 */}
              {(form.launch_date || form.launch_platforms.length > 0) && (
                <div className="pt-2 border-t space-y-1 text-xs">
                  {form.launch_date && <InfoLine label="발매일" value={form.launch_date} />}
                  {form.launch_platforms.length > 0 && (
                    <InfoLine label="판매처" value={form.launch_platforms.join(', ')} />
                  )}
                </div>
              )}

              {/* SEO */}
              {form.seo_tags.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex flex-wrap gap-1">
                    {form.seo_tags.map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded">#{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 헬퍼 컴포넌트 ──

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-gray-400">{label}</span><p className="text-gray-800 font-medium">{value || '—'}</p></div>
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex text-xs"><span className="w-14 text-gray-400 shrink-0">{label}</span><span className="text-gray-700">{value}</span></div>
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
    </div>
  )
}

function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 text-gray-900" />
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  )
}

function ImageSection({ label, images, onAdd, onRemove }: {
  label: string; images: string[]; onAdd: () => void; onRemove: (i: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <button onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200">
          <Upload className="w-3 h-3" /> 업로드
        </button>
      </div>
      {images.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
              <button onClick={() => onRemove(i)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-gray-400"
          onClick={onAdd}>
          <ImageIcon className="w-5 h-5 text-gray-300 mx-auto" />
          <p className="text-[10px] text-gray-400 mt-1">클릭하여 추가</p>
        </div>
      )}
    </div>
  )
}
