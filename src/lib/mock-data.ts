import { KpiMetric, ChartDataPoint, ActivityItem, Campaign, IMCCampaign, InfluencerAccount, SeedingRecord, SeedingResult, MetaAdsCampaign, ChannelPerformance } from '@/types'

// ─── KPI Data (Snowflake: BCAVE.SEWON.SW_SALEINFO + FORECAST_SALES) ────────
// 2026년 2월 실적: 227억 / 2025년 2월 대비 +7.1%
export const dashboardKpis: KpiMetric[] = [
  { id: '1', title: '2월 매출 실적', value: '227억', delta: 7.1, deltaLabel: 'vs 전년동월', trend: 'up', icon: 'TrendingUp' },
  { id: '2', title: '2월 판매수량', value: '376,268', delta: 2.2, deltaLabel: 'vs 전년동월', trend: 'up', icon: 'Users' },
  { id: '3', title: '활성 매장수', value: '492', delta: 4.5, deltaLabel: 'vs 지난달', trend: 'up', icon: 'Target' },
  { id: '4', title: '1월 vs 2월', value: '+8.4%', delta: 8.4, deltaLabel: '매출 성장률', trend: 'up', icon: 'BarChart3' },
]

export const marketingKpis: KpiMetric[] = [
  { id: '1', title: '총 노출수', value: '4,521만', delta: 15.2, deltaLabel: 'vs 지난달', trend: 'up', icon: 'Eye' },
  { id: '2', title: '클릭수', value: '12.8만', delta: 9.7, deltaLabel: 'vs 지난달', trend: 'up', icon: 'MousePointer' },
  { id: '3', title: 'CVR', value: '2.83%', delta: -0.3, deltaLabel: 'vs 지난달', trend: 'down', icon: 'Percent' },
  { id: '4', title: 'ROAS', value: '4.2x', delta: 5.1, deltaLabel: 'vs 지난달', trend: 'up', icon: 'BarChart3' },
]

export const productKpis: KpiMetric[] = [
  { id: '1', title: '신제품 수', value: '12', delta: 4, deltaLabel: '이번 분기', trend: 'up', icon: 'Package' },
  { id: '2', title: '시장 점유율', value: '18.4%', delta: 1.2, deltaLabel: 'vs 지난분기', trend: 'up', icon: 'PieChart' },
  { id: '3', title: '상품 ROI', value: '312%', delta: 24, deltaLabel: 'vs 지난분기', trend: 'up', icon: 'TrendingUp' },
  { id: '4', title: '재구매율', value: '64.2%', delta: 2.1, deltaLabel: 'vs 지난분기', trend: 'up', icon: 'RefreshCw' },
]

// ─── Chart Data (Snowflake 실제 데이터, 단위: 원) ────────────
// SW_SALEINFO 월별 실적 + FORECAST_SALES 목표
export const revenueChartData: ChartDataPoint[] = [
  { month: '25.07', actual: 19419323442, target: 21000000000 },
  { month: '25.08', actual: 18186754948, target: 20000000000 },
  { month: '25.09', actual: 21740391323, target: 22000000000 },
  { month: '25.10', actual: 35179840436, target: 33000000000 },
  { month: '25.11', actual: 34617298479, target: 33000000000 },
  { month: '25.12', actual: 26367420242, target: 27000000000 },
  { month: '26.01', actual: 20944198331, target: 22000000000 },
  { month: '26.02', actual: 22704363705, target: 22000000000 },
  { month: '26.03', actual: 8178824685, target: 26415383010 },
]

// 브랜드별 2026 Q1 실적 (Snowflake 실제 데이터)
export const deptBarData = [
  { dept: '커버낫', revenue: 21920776948, leads: 324050 },
  { dept: '리(LEE)', revenue: 14478257283, leads: 226730 },
  { dept: '와키윌리', revenue: 10421523333, leads: 180211 },
  { dept: 'LEE KIDS', revenue: 2161512931, leads: 44091 },
  { dept: '커버낫 키즈', revenue: 1758370952, leads: 34918 },
]

export const channelData = [
  { name: 'SNS 광고', value: 38, color: '#e91e63' },
  { name: '검색 광고', value: 27, color: '#7c3aed' },
  { name: '이메일', value: 18, color: '#0891b2' },
  { name: '디스플레이', value: 17, color: '#059669' },
]

export const trendData: ChartDataPoint[] = [
  { month: '1월', actual: 42, target: 40 },
  { month: '2월', actual: 38, target: 42 },
  { month: '3월', actual: 55, target: 45 },
  { month: '4월', actual: 61, target: 48 },
  { month: '5월', actual: 58, target: 50 },
  { month: '6월', actual: 72, target: 53 },
  { month: '7월', actual: 78, target: 56 },
  { month: '8월', actual: 84, target: 60 },
]

// ─── Activity Feed ───────────────────────────────────────────
export const recentActivities: ActivityItem[] = [
  { id: '1', user: '김민준', action: '보고서 생성', target: '8월 매출 분석 보고서', timestamp: new Date('2026-03-12T09:30:00'), department: 'sales' },
  { id: '2', user: '이서연', action: 'AI 콘텐츠 생성', target: '인스타그램 캠페인 카피', timestamp: new Date('2026-03-12T09:15:00'), department: 'marketing' },
  { id: '3', user: '박지훈', action: '트렌드 분석 완료', target: 'Q3 상품 트렌드 리포트', timestamp: new Date('2026-03-12T08:50:00'), department: 'product-planning' },
  { id: '4', user: '최수아', action: '딜 업데이트', target: 'ACME Corp 계약 협상 → 완료', timestamp: new Date('2026-03-12T08:30:00'), department: 'sales' },
  { id: '5', user: '정태양', action: '캠페인 시작', target: '3월 봄 시즌 SNS 캠페인', timestamp: new Date('2026-03-11T17:00:00'), department: 'marketing' },
  { id: '6', user: '한채원', action: '신제품 등록', target: '2026 S/S 컬렉션 12종', timestamp: new Date('2026-03-11T16:20:00'), department: 'product-planning' },
]

// ─── Marketing Campaigns ─────────────────────────────────────
export const campaigns: Campaign[] = [
  { id: '1', name: '3월 봄 시즌 SNS', channel: 'sns', status: 'active', budget: 5000000, spend: 3240000, impressions: 1240000, clicks: 38200, conversions: 1082, startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31') },
  { id: '2', name: '네이버 검색 광고', channel: 'search', status: 'active', budget: 3000000, spend: 2100000, impressions: 890000, clicks: 24500, conversions: 694, startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31') },
  { id: '3', name: '뉴스레터 봄 특집', channel: 'email', status: 'active', budget: 500000, spend: 480000, impressions: 42000, clicks: 8400, conversions: 238, startDate: new Date('2026-03-05'), endDate: new Date('2026-03-20') },
  { id: '4', name: '디스플레이 리타겟팅', channel: 'display', status: 'paused', budget: 2000000, spend: 870000, impressions: 560000, clicks: 9800, conversions: 196, startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31') },
  { id: '5', name: '2월 발렌타인 캠페인', channel: 'sns', status: 'completed', budget: 4000000, spend: 3980000, impressions: 2100000, clicks: 52000, conversions: 1560, startDate: new Date('2026-02-07'), endDate: new Date('2026-02-14') },
]

// ─── IMC Campaigns ────────────────────────────────────────────
export const imcCampaigns: IMCCampaign[] = [
  {
    id: 'imc-1',
    title: '2026 S/S 런칭 캠페인',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    status: 'active',
    color: '#e91e63',
    products: [
      { productCode: 'CVN-SS26-001', productName: '커버낫 스프링 후드집업' },
      { productCode: 'CVN-SS26-002', productName: '커버낫 리넨 슬랙스' },
    ],
    seedingRecords: [
      { influencerId: 'inf-1', influencerHandle: '@style.hana', productCode: 'CVN-SS26-001', seedingQty: 2, seedingDate: '2026-02-20' },
      { influencerId: 'inf-2', influencerHandle: '@daily.joon', productCode: 'CVN-SS26-002', seedingQty: 1, seedingDate: '2026-02-22' },
    ],
    metaAds: { campaignId: 'meta-1', spend: 3240000, revenue: 13608000, roas: 4.2 },
    oohCost: 5000000,
    notes: '3월 봄 시즌 주력 캠페인',
  },
  {
    id: 'imc-2',
    title: '리(LEE) 데님 프로모션',
    startDate: '2026-03-15',
    endDate: '2026-04-15',
    status: 'planned',
    color: '#7c3aed',
    products: [
      { productCode: 'LEE-DN26-001', productName: '리 클래식 스트레이트 진' },
    ],
    seedingRecords: [],
    oohCost: 0,
  },
  {
    id: 'imc-3',
    title: '2월 발렌타인 캠페인',
    startDate: '2026-02-07',
    endDate: '2026-02-14',
    status: 'completed',
    color: '#0891b2',
    products: [
      { productCode: 'CVN-VD26-001', productName: '커버낫 하트 에디션 티셔츠' },
    ],
    seedingRecords: [
      { influencerId: 'inf-3', influencerHandle: '@luna.fashion', productCode: 'CVN-VD26-001', seedingQty: 3, seedingDate: '2026-02-01' },
    ],
    metaAds: { campaignId: 'meta-2', spend: 3980000, revenue: 17910000, roas: 4.5 },
    oohCost: 2500000,
  },
  {
    id: 'imc-4',
    title: '와키윌리 여름 프리뷰',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'planned',
    color: '#059669',
    products: [],
    seedingRecords: [],
    oohCost: 0,
  },
]

// ─── Influencer Accounts (Apify collected) ────────────────────
export const influencerAccounts: InfluencerAccount[] = [
  { id: 'inf-1', handle: '@style.hana', platform: 'instagram', followers: 128500, category: '패션', engagementRate: 4.2, collectedAt: '2026-03-01' },
  { id: 'inf-2', handle: '@daily.joon', platform: 'instagram', followers: 87300, category: '라이프스타일', engagementRate: 3.8, collectedAt: '2026-03-01' },
  { id: 'inf-3', handle: '@luna.fashion', platform: 'instagram', followers: 210000, category: '패션', engagementRate: 5.1, collectedAt: '2026-03-02' },
  { id: 'inf-4', handle: '@sportymia', platform: 'instagram', followers: 54200, category: '스포츠', engagementRate: 6.3, collectedAt: '2026-03-02' },
  { id: 'inf-5', handle: '@kstyle.daily', platform: 'tiktok', followers: 340000, category: '패션', engagementRate: 7.8, collectedAt: '2026-03-03' },
  { id: 'inf-6', handle: '@minjun_looks', platform: 'youtube', followers: 95000, category: '뷰티', engagementRate: 2.9, collectedAt: '2026-03-03' },
]

// ─── Seeding Records ──────────────────────────────────────────
export const seedingRecords: SeedingRecord[] = [
  { id: 'seed-1', campaignId: 'imc-1', campaignTitle: '2026 S/S 런칭 캠페인', productCode: 'CVN-SS26-001', productName: '커버낫 스프링 후드집업', influencerId: 'inf-1', influencerHandle: '@style.hana', seedingDate: '2026-02-20', seedingType: '제품발송', status: '게시완료' },
  { id: 'seed-2', campaignId: 'imc-1', campaignTitle: '2026 S/S 런칭 캠페인', productCode: 'CVN-SS26-002', productName: '커버낫 리넨 슬랙스', influencerId: 'inf-2', influencerHandle: '@daily.joon', seedingDate: '2026-02-22', seedingType: '제품발송', status: '수령확인' },
  { id: 'seed-3', campaignId: 'imc-3', campaignTitle: '2월 발렌타인 캠페인', productCode: 'CVN-VD26-001', productName: '커버낫 하트 에디션 티셔츠', influencerId: 'inf-3', influencerHandle: '@luna.fashion', seedingDate: '2026-02-01', seedingType: '콘텐츠의뢰', status: '게시완료' },
  { id: 'seed-4', campaignId: 'imc-1', campaignTitle: '2026 S/S 런칭 캠페인', productCode: 'CVN-SS26-001', productName: '커버낫 스프링 후드집업', influencerId: 'inf-5', influencerHandle: '@kstyle.daily', seedingDate: '2026-03-05', seedingType: '콘텐츠의뢰', status: '발송완료' },
]

// ─── Seeding Results ──────────────────────────────────────────
export const seedingResults: SeedingResult[] = [
  { seedingRecordId: 'seed-1', influencerHandle: '@style.hana', platform: 'instagram', postUrl: 'https://instagram.com/p/example1', views: 84200, likes: 3540, comments: 128, estimatedReach: 102000, isPosted: true, postedAt: '2026-03-08' },
  { seedingRecordId: 'seed-3', influencerHandle: '@luna.fashion', platform: 'instagram', postUrl: 'https://instagram.com/p/example2', views: 176000, likes: 8920, comments: 312, estimatedReach: 215000, isPosted: true, postedAt: '2026-02-10' },
  { seedingRecordId: 'seed-2', influencerHandle: '@daily.joon', platform: 'instagram', views: 0, likes: 0, comments: 0, estimatedReach: 0, isPosted: false },
  { seedingRecordId: 'seed-4', influencerHandle: '@kstyle.daily', platform: 'tiktok', views: 0, likes: 0, comments: 0, estimatedReach: 0, isPosted: false },
]

// ─── Meta Ads Campaigns ───────────────────────────────────────
export const metaAdsCampaigns: MetaAdsCampaign[] = [
  { id: 'meta-1', name: '3월 봄 시즌 - 커버낫', status: 'active', spend: 3240000, impressions: 1240000, clicks: 38200, ctr: 3.08, cpc: 84, conversions: 1082, revenue: 13608000, roas: 4.2 },
  { id: 'meta-2', name: '2월 발렌타인 - 전체', status: 'completed', spend: 3980000, impressions: 2100000, clicks: 52000, ctr: 2.48, cpc: 76, conversions: 1560, revenue: 17910000, roas: 4.5 },
  { id: 'meta-3', name: '리(LEE) 데님 리타겟팅', status: 'paused', spend: 870000, impressions: 560000, clicks: 9800, ctr: 1.75, cpc: 88, conversions: 196, revenue: 1960000, roas: 2.3 },
  { id: 'meta-4', name: '와키윌리 신규 고객 획득', status: 'active', spend: 1540000, impressions: 890000, clicks: 19580, ctr: 2.2, cpc: 78, conversions: 490, revenue: 4900000, roas: 3.2 },
]

// ─── Adriel Multi-Channel Benchmark ──────────────────────────
export const adrielChannelData: ChannelPerformance[] = [
  { channel: 'Meta', spend: 8630000, impressions: 4790000, clicks: 119580, conversions: 3328, revenue: 38234000, roas: 4.43, ctr: 2.5 },
  { channel: 'Google', spend: 3200000, impressions: 2100000, clicks: 63000, conversions: 1260, revenue: 10080000, roas: 3.15, ctr: 3.0 },
  { channel: 'Kakao', spend: 1800000, impressions: 980000, clicks: 19600, conversions: 392, revenue: 2940000, roas: 1.63, ctr: 2.0 },
]

// ─── Digital Monthly Trend (6개월, 채널별 지출 & 수익) ─────────
export const digitalMonthlyData = [
  { month: '25.10', metaSpend: 7200000, metaRevenue: 31104000, googleSpend: 2800000, googleRevenue: 8400000, kakaoSpend: 1400000, kakaoRevenue: 1680000 },
  { month: '25.11', metaSpend: 7800000, metaRevenue: 34320000, googleSpend: 2900000, googleRevenue: 8700000, kakaoSpend: 1500000, kakaoRevenue: 1800000 },
  { month: '25.12', metaSpend: 9200000, metaRevenue: 43240000, googleSpend: 3400000, googleRevenue: 11220000, kakaoSpend: 2000000, kakaoRevenue: 2800000 },
  { month: '26.01', metaSpend: 6800000, metaRevenue: 28560000, googleSpend: 2600000, googleRevenue: 7020000, kakaoSpend: 1200000, kakaoRevenue: 1320000 },
  { month: '26.02', metaSpend: 8100000, metaRevenue: 37260000, googleSpend: 3100000, googleRevenue: 9610000, kakaoSpend: 1700000, kakaoRevenue: 2210000 },
  { month: '26.03', metaSpend: 8630000, metaRevenue: 38234000, googleSpend: 3200000, googleRevenue: 10080000, kakaoSpend: 1800000, kakaoRevenue: 2940000 },
]

// ─── Report Templates ────────────────────────────────────────
export const reportTemplates = [
  { id: '1', title: '월간 매출 보고서', description: '월별 매출 실적, 목표 달성률, 부서별 성과를 종합 분석', icon: 'BarChart3', dept: 'all', color: '#e91e63' },
  { id: '2', title: '상품 성과 분석', description: '카테고리별 판매량, 마진율, 재고 현황 분석', icon: 'Package', dept: 'product-planning', color: '#3b82f6' },
  { id: '3', title: '캠페인 성과 보고', description: '채널별 광고 성과, ROAS, CVR 종합 리포트', icon: 'Megaphone', dept: 'marketing', color: '#8b5cf6' },
  { id: '4', title: '영업 파이프라인 보고', description: '딜 현황, 예상 매출, 영업 사원별 성과 분석', icon: 'GitBranch', dept: 'sales', color: '#10b981' },
  { id: '5', title: '트렌드 분석 보고서', description: '시장 트렌드, 경쟁사 분석, 기회 요인 도출', icon: 'TrendingUp', dept: 'product-planning', color: '#f59e0b' },
  { id: '6', title: '고객 분석 보고서', description: '고객 세그먼트, 구매 패턴, LTV 분석', icon: 'Users', dept: 'marketing', color: '#06b6d4' },
]
