import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Megaphone,
  Target,
  CalendarRange,
  Users,
  MonitorPlay,
  Settings,
  BarChart3,
  ClipboardList,
  Archive,
  Truck,
  ShoppingBag,
  FileImage,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon?: React.ElementType
  badge?: number
  children?: NavItem[]
}

export type NavSection = {
  id: string
  label: string
  icon?: React.ElementType
  items: NavItem[]
}

export const NAV_CONFIG: NavSection[] = [
  {
    id: 'departments',
    label: '부서',
    items: [
      {
        label: '상품기획',
        href: '/planning',
        icon: Package,
        children: [
          { label: '기획현황판', href: '/planning', icon: ClipboardList },
          { label: '이월재고 관리', href: '/planning/carryover', icon: Archive },
        ],
      },
      {
        label: '영업',
        href: '/sales',
        icon: Target,
        children: [
          { label: '매출 대시보드', href: '/sales', icon: BarChart3 },
          { label: '보충출고 자동화', href: '/sales/replenishment', icon: Truck },
        ],
      },
      {
        label: '소싱',
        href: '/sourcing',
        icon: Truck,
        children: [
          { label: '소싱 현황', href: '/sourcing', icon: Truck },
        ],
      },
      {
        label: '디자인',
        href: '/design',
        icon: FileImage,
        children: [
          { label: '상품정보 입력', href: '/design', icon: FileImage },
        ],
      },
      {
        label: '온라인',
        href: '/online',
        icon: ShoppingBag,
        children: [
          { label: '발매일정·상세페이지', href: '/online', icon: FileImage },
        ],
      },
      {
        label: '마케팅',
        href: '/marketing',
        icon: Megaphone,
        children: [
          { label: 'IMC 캘린더', href: '/marketing/imc-plan', icon: CalendarRange },
          { label: '인플루언서', href: '/marketing/influencer', icon: Users },
          {
            label: '디지털 마케팅', href: '/marketing/digital', icon: MonitorPlay,
            children: [
              { label: 'Meta', href: '/marketing/digital/meta', icon: MonitorPlay },
              { label: 'Google', href: '/marketing/digital/google', icon: MonitorPlay },
              { label: 'Naver', href: '/marketing/digital/naver', icon: MonitorPlay },
              { label: 'Kakao', href: '/marketing/digital/kakao', icon: MonitorPlay },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: '관리자',
    icon: Settings,
    items: [
      { label: '관리자 설정', href: '/admin', icon: Settings },
    ],
  },
]

export const DEPT_COLORS = {
  'product-planning': { bg: '#dbeafe', text: '#1d4ed8', label: '상품기획' },
  sales: { bg: '#dcfce7', text: '#15803d', label: '영업' },
  marketing: { bg: '#fce7f3', text: '#be185d', label: '마케팅' },
}

export const BRAND = {
  name: 'B.cave',
  accent: '#e91e63',
}

// 브랜드 코드별 색상 (차트, 뱃지 등)
export const BRAND_COLORS: Record<string, string> = {
  CO: '#e91e63', LE: '#3b82f6', WA: '#10b981', CK: '#f59e0b', LK: '#8b5cf6',
}

// 브랜드 코드 → 한글 이름
export const BRAND_NAMES: Record<string, string> = {
  CO: '커버낫', LE: '리(Lee)', WA: '와키윌리', CK: '커버낫 키즈', LK: 'Lee Kids',
}

// 한글 브랜드명 → 브랜드 코드 (엑셀 업로드 등에서 사용)
const BRANDNM_TO_CD_RAW: Record<string, string> = {
  '커버낫': 'CO',
  '리(lee)': 'LE', '리(Lee)': 'LE', '리(LEE)': 'LE', '리': 'LE', 'lee': 'LE',
  '와키윌리': 'WA',
  '커버낫 키즈': 'CK', '커버낫키즈': 'CK',
  'lee kids': 'LK', 'LEE KIDS': 'LK', '리키즈': 'LK', '리 키즈': 'LK',
}
const normBrand = (s: string) => s.replace(/\s+/g, '').toLowerCase()
export function brandNameToCode(nm: string): string | null {
  if (BRANDNM_TO_CD_RAW[nm]) return BRANDNM_TO_CD_RAW[nm]
  const n = normBrand(nm)
  for (const [k, v] of Object.entries(BRANDNM_TO_CD_RAW)) {
    if (normBrand(k) === n) return v
  }
  return null
}

// 유효 브랜드 코드 Set (SQL 인젝션 방지용)
export const VALID_BRANDS = new Set(['CO', 'WA', 'LE', 'CK', 'LK'])

// 대시보드용 브랜드 색상 (한글 키)
export const BRAND_COLORS_KR: Record<string, string> = {
  '커버낫': '#e91e63', '리(LEE)': '#3b82f6', '와키윌리': '#10b981',
  'LEE KIDS': '#8b5cf6', '커버낫 키즈': '#f59e0b',
}

// 브랜드 탭 (전체 + 개별 브랜드)
export const BRAND_TABS = [
  { label: '전체', value: 'all' },
  { label: '커버낫', value: 'CO' },
  { label: '리(Lee)', value: 'LE' },
  { label: '와키윌리', value: 'WA' },
  { label: '커버낫 키즈', value: 'CK' },
  { label: 'Lee Kids', value: 'LK' },
]
