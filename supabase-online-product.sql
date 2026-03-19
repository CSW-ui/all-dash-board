-- Supabase SQL Editor에서 실행
-- 상품 상세페이지 관리용 테이블 (26SS 딜리버리, 상품정보 엑셀 기반)

CREATE TABLE IF NOT EXISTS online_product_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylecd TEXT NOT NULL,
  colorcd TEXT NOT NULL,
  brandcd TEXT NOT NULL,

  -- ========== 소싱팀 입력 ==========
  material_mix TEXT,              -- 혼용율 (예: "겉감,폴리에스터,100%|안감,폴리에스터,100%")
  wash_care TEXT,                 -- 세탁코드 (예: "BK-T02")
  production_country TEXT,        -- 생산국 (Snowflake ORIGNNM과 별도로 소싱팀 기입)
  production_factory TEXT,        -- 생산처 (예: "(주)야심")
  logistics_due_date DATE,        -- 물류 예상 납기일
  sample_arrival_date DATE,       -- 수납제품전달 예정일자 (상세촬영 소싱팀기입)
  sample_received_date DATE,      -- 소싱 입수 날짜
  sourcing_manager TEXT,          -- 소싱팀 담당자명

  -- ========== 디자인팀 입력 ==========
  product_name_kr TEXT,           -- 제품명 (한글) — 온라인용
  product_name_en TEXT,           -- 제품명 (영어) — 온라인용
  fit_type TEXT,                  -- 핏 (레귤러핏/세미오버핏/오버핏)
  product_description TEXT,       -- 디테일 설명 (디자인팀 작성, 줄바꿈 포함)
  product_description_online TEXT,-- 디테일 설명2 (온라인팀 문장형 수정)
  selling_points TEXT[],          -- 셀링포인트 (배열)
  size_spec TEXT,                 -- 사이즈 스펙
  detail_shot_code TEXT,          -- 요청 디테일컷 코드 (예: "BW-T02")
  detail_upgrade TEXT,            -- 상세고도화 여부 (상세고도화/IMC 등)
  design_complete TEXT,           -- 완료 여부 (완료/미완료)
  designer_name TEXT,             -- 디자인팀 담당자명
  seo_tags TEXT[],                -- SEO 키워드

  -- ========== 이미지 (Supabase Storage 경로) ==========
  thumbnail_urls TEXT[],          -- 섬네일 이미지
  lookbook_urls TEXT[],           -- 착용컷
  detail_urls TEXT[],             -- 디테일컷

  -- ========== 온라인팀 입력 ==========
  launch_date DATE,               -- 온라인 발매 일자
  launch_platforms TEXT[],        -- 발매 플랫폼
  musinsa_exclusive TEXT,         -- 무신사 단독 여부 (차수 정보, 예: "~4차")
  online_exclusive BOOLEAN DEFAULT false, -- 온라인 단독 가능 여부
  image_received BOOLEAN DEFAULT false,   -- 이미지 수령 여부
  sample_delivered_date DATE,     -- 수납샘플 전달일자 (온라인팀 입수 체크)
  sample_delivered_size TEXT,     -- 수납샘플 전달 사이즈
  hanger_yn BOOLEAN DEFAULT false,-- 행거 여부
  line_info TEXT,                 -- 라인
  setup_yn BOOLEAN DEFAULT false, -- 셋업 여부

  -- ========== 기획팀 입력 ==========
  is_carryover BOOLEAN DEFAULT false, -- 캐리오버 여부
  original_stylecd TEXT,          -- 기존품번 (고객후기 유지)
  set_stylecd TEXT,               -- 세트 상품 품번
  planning_manager TEXT,          -- 기획팀 담당자명

  -- ========== 상태 관리 ==========
  -- draft / planning / sourcing / design / complete
  status TEXT DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(stylecd, colorcd, brandcd)
);

-- RLS 정책 (인증된 사용자만 접근)
ALTER TABLE online_product_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read" ON online_product_info
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON online_product_info
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update" ON online_product_info
  FOR UPDATE TO authenticated USING (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER online_product_info_updated_at
  BEFORE UPDATE ON online_product_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Supabase Storage 버킷 생성은 대시보드에서: product-images (public)
