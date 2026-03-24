-- =============================================
-- 사업계획 모듈 테이블 생성
-- Supabase SQL Editor에서 실행
-- =============================================

-- 1. 사업계획 마스터
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,                          -- 계획 연도 (2026)
  version_name TEXT NOT NULL DEFAULT '기본',       -- 버전명 (기본, 수정1차, 시뮬레이션A 등)
  status TEXT NOT NULL DEFAULT 'draft',            -- draft, confirmed, archived
  description TEXT,                                -- 메모
  created_by TEXT,                                 -- 작성자
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 매장별 월별 목표매출
CREATE TABLE IF NOT EXISTS bp_store_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,                             -- CO, WA, LE, CK, LK
  store_name TEXT NOT NULL,                        -- 매장명
  channel_type TEXT NOT NULL DEFAULT '백화점',      -- 백화점, 아울렛, 온라인, 대리점, 직영점
  m1 BIGINT DEFAULT 0, m2 BIGINT DEFAULT 0, m3 BIGINT DEFAULT 0,
  m4 BIGINT DEFAULT 0, m5 BIGINT DEFAULT 0, m6 BIGINT DEFAULT 0,
  m7 BIGINT DEFAULT 0, m8 BIGINT DEFAULT 0, m9 BIGINT DEFAULT 0,
  m10 BIGINT DEFAULT 0, m11 BIGINT DEFAULT 0, m12 BIGINT DEFAULT 0,
  annual_target BIGINT GENERATED ALWAYS AS (m1+m2+m3+m4+m5+m6+m7+m8+m9+m10+m11+m12) STORED,
  prev_year_actual BIGINT DEFAULT 0,               -- 전년 실적 (Snowflake에서 가져옴)
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, brand, store_name)
);

-- 3. 브랜드/시즌별 발주계획
CREATE TABLE IF NOT EXISTS bp_order_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  season TEXT NOT NULL,                             -- 봄, 여름, 가을, 겨울, 상반기, 스탠다드
  item_category TEXT NOT NULL,                      -- 품목 (아우터, 상의, 하의, 원피스 등)
  plan_amount BIGINT DEFAULT 0,                     -- 기획금액 (원)
  plan_qty INTEGER DEFAULT 0,                       -- 기획수량
  avg_unit_price INTEGER DEFAULT 0,                 -- 평균 단가
  cost_rate NUMERIC(5,2) DEFAULT 0,                 -- 원가율 (%)
  cost_amount BIGINT GENERATED ALWAYS AS (
    CASE WHEN plan_amount > 0 THEN ROUND(plan_amount * cost_rate / 100) ELSE 0 END
  ) STORED,                                         -- 매출원가
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, brand, season, item_category)
);

-- 4. 판관비 항목
CREATE TABLE IF NOT EXISTS bp_sga_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                           -- 인건비, 임대료, 마케팅, 물류, 수수료, 기타
  item_name TEXT NOT NULL,                          -- 세부 항목명
  cost_type TEXT NOT NULL DEFAULT '고정',            -- 고정, 변동
  monthly_amount BIGINT DEFAULT 0,                  -- 월 고정금액 (고정비일 때)
  rate_of_sales NUMERIC(5,2) DEFAULT 0,             -- 매출대비 비율% (변동비일 때)
  annual_amount BIGINT DEFAULT 0,                   -- 연간 합계 (계산 또는 입력)
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, category, item_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bp_store_plan ON bp_store_targets(plan_id);
CREATE INDEX IF NOT EXISTS idx_bp_order_plan ON bp_order_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_bp_sga_plan ON bp_sga_items(plan_id);
