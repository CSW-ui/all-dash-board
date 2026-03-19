# BCAVE 업무 자동화 플랫폼 (all dash board)

패션 기업 비케이브(B.cave)의 임직원용 업무 자동화 플랫폼.
상품기획 → 디자인 → 생산 → 마케팅 → 영업 → 이커머스 → CS 전체 밸류체인 자동화.

## 브랜드
- 커버낫(CO), 와키윌리(WA), 리(LE), 커버낫 키즈(CK), Lee Kids(LK)

## 기술 스택
- **프레임워크:** Next.js 14 (App Router) + TypeScript
- **스타일:** Tailwind CSS + tailwindcss-animate
- **UI 컴포넌트:** Radix UI (Dialog, Select, Tabs, Tooltip, DropdownMenu 등)
- **차트:** Recharts
- **아이콘:** lucide-react
- **인증/DB:** Supabase (Auth + PostgreSQL) — 프로필, 캠페인, 인플루언서, 시딩 데이터
- **데이터 웨어하우스:** Snowflake — 판매 실적, 재고, 생산 데이터
- **외부 API:** Apify (데이터 수집), Meta/Google/Naver/Kakao 광고 API (예정)
- **유틸:** date-fns, clsx, tailwind-merge, class-variance-authority, xlsx

## 프로젝트 구조
```
src/
├── app/
│   ├── (dashboard)/           # 대시보드 레이아웃 (Sidebar + TopBar)
│   │   ├── dashboard/         # 메인 IMC 대시보드
│   │   ├── sales/             # 영업: 매출실적, 재발주, 물량배분, 보충출고
│   │   ├── marketing/         # 마케팅: IMC플랜, 인플루언서, 디지털마케팅(Meta/Google/Naver/Kakao)
│   │   ├── product-planning/  # 상품기획: 보고서생성, 트렌드분석, AI작성
│   │   └── admin/             # 관리자: 엑셀업로드, 권한관리
│   ├── api/                   # API 라우트
│   │   ├── sales/             # Snowflake 연동 매출 API
│   │   ├── campaigns/         # Supabase 캠페인 CRUD
│   │   ├── influencers/       # Supabase 인플루언서 CRUD
│   │   ├── seeding/           # 시딩 관리
│   │   ├── digital/           # 디지털 마케팅 채널별 API
│   │   ├── ai/generate/       # AI 텍스트 생성
│   │   └── apify/             # Apify 데이터 수집
│   └── login/                 # 로그인 페이지
├── components/
│   ├── layout/                # Sidebar, SidebarItem, TopBar
│   ├── dashboard/             # KpiCard, KpiGrid, RevenueLineChart, DeptBarChart
│   ├── marketing/             # CampaignTable, InfluencerTable, SeedingTracker, GanttChart 등
│   ├── automation/            # AiTextEditor, ReportGenerator
│   └── admin/                 # ExcelUploader, UserPermissions
├── contexts/AuthContext.tsx    # Supabase 인증 (role: admin/manager/staff, brands 필터)
├── hooks/                     # useSidebar, useAiGenerate, useTargetData
├── lib/
│   ├── snowflake.ts           # Snowflake REST API (JWT 인증) — 서버 전용
│   ├── supabase.ts            # Supabase 클라이언트
│   ├── supabase-browser.ts    # 브라우저용 Supabase
│   ├── supabase-server.ts     # 서버용 Supabase
│   ├── constants.ts           # NAV_CONFIG, BRAND, DEPT_COLORS
│   ├── mock-data.ts           # 목업 데이터
│   └── utils.ts               # cn() 유틸
└── types/                     # TypeScript 타입 정의
    ├── dashboard.ts
    ├── marketing.ts
    └── index.ts
```

## Snowflake 연동 규칙
- **서버 전용:** `src/lib/snowflake.ts`의 `snowflakeQuery()` 함수 사용 (API Route에서만 호출)
- **인증:** RSA Key-Pair JWT 방식
- **DB/스키마:** `BCAVE.SEWON`
- **매출 뷰:** `BCAVE.SEWON.VW_SALES_VAT` (SW_SALEINFO 직접 조회 금지)
- **브랜드 필터:** `BRANDCD IN ('CO','WA','LE','CK','LK')` 항상 적용
- **날짜 필터:** `SALEDT >= '20250101'` 기본 적용
- **예시:**
```ts
import { snowflakeQuery, BRAND_FILTER, SALE_DATE_FILTER, SALES_VIEW } from '@/lib/snowflake'

const data = await snowflakeQuery(`
  SELECT SALEDT, SUM(SALEAMT) as TOTAL
  FROM ${SALES_VIEW}
  WHERE ${BRAND_FILTER} AND ${SALE_DATE_FILTER}
  GROUP BY SALEDT
  ORDER BY SALEDT DESC
`)
```

## Supabase 연동 규칙
- **브라우저:** `createSupabaseBrowserClient()` from `@/lib/supabase-browser`
- **서버 (API Route):** `createSupabaseServerClient()` from `@/lib/supabase-server`
- **인증 테이블:** `profiles` (id, email, name, role, brands)
- **역할:** admin(전체 접근), manager(브랜드 제한), staff(브랜드 제한)

## UI/디자인 규칙
- **사이드바 배경:** `#16213e` (다크 네이비)
- **브랜드 액센트:** `#e91e63` (핑크)
- **서피스 배경:** `#f8f9fa` (연한 그레이)
- **카드:** `bg-white rounded-xl shadow-sm border border-surface-border p-6`
- **KPI 카드:** KpiCard 컴포넌트 재사용 (`@/components/dashboard/KpiCard`)
- **차트:** Recharts 사용, 브랜드 컬러 팔레트 적용
- **레이아웃:** 사이드바(접힘 가능 60↔16) + TopBar + main(p-6)
- **애니메이션:** fade-in, slide-in-right 사용

## 새 페이지 만들 때 패턴
1. `src/app/(dashboard)/[부서]/[기능]/page.tsx`에 페이지 생성
2. 복잡한 UI는 `src/components/[부서]/` 하위에 컴포넌트 분리
3. Snowflake 데이터 필요 시 → `src/app/api/[부서]/route.ts`에 API 생성
4. `src/lib/constants.ts`의 `NAV_CONFIG`에 네비게이션 항목 추가
5. 필요한 타입은 `src/types/`에 정의

## 코딩 컨벤션
- 한국어 주석 사용
- 'use client' 지시문: 클라이언트 컴포넌트에만 명시
- cn() 유틸로 클래스 병합: `cn('base-class', condition && 'conditional-class')`
- API Route는 Next.js App Router 방식: `export async function GET(req)` / `POST(req)`
- 에러 처리: `NextResponse.json({ error: '메시지' }, { status: 코드 })`

## 부서별 색상
- 상품기획: bg `#dbeafe`, text `#1d4ed8`
- 영업: bg `#dcfce7`, text `#15803d`
- 마케팅: bg `#fce7f3`, text `#be185d`

## 아직 만들지 않은 모듈 (TODO)
- [ ] 생산/소싱: 공장진도 포털, QC 관리, 원자재 발주, 테크팩 관리
- [ ] 이커머스: PIM(상품정보관리), 재고 실시간 연동, CS 챗봇
- [ ] 재고 통합: 온/오프라인 통합 재고 대시보드, 품절 예측 알림
- [ ] MD/원가: 라인플랜 시뮬레이션, 원가 계산기
- [ ] PR: 미디어 클리핑, 협찬 샘플 추적
- [ ] 경영지원: 결재 워크플로우, 비용처리 자동화
- [ ] AI 고도화: VOC 분석, 수요예측, 트렌드 자동 리서치
- [ ] 디자인: PLM 연동, 샘플 버전 관리, 도식화 DAM
