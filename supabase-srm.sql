-- =============================================================
-- SRM (Supplier Relationship Management) 모듈 테이블
-- Supabase SQL Editor에서 실행
-- =============================================================

-- srm_production: 생산 진행 마스터 (담당자 시트 통합)
CREATE TABLE srm_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylecd TEXT NOT NULL,
  chasu TEXT NOT NULL DEFAULT '01',
  colorcd TEXT NOT NULL,
  brandcd TEXT NOT NULL,
  stylenm TEXT,
  sourcing_md TEXT,
  designer TEXT,
  planning_md TEXT,
  order_date DATE,
  order_type TEXT, -- M/R/S (메인/리오더/스팟)
  item_category TEXT, -- 복종 대구분
  item_name TEXT, -- 아이템
  season TEXT, -- 시즌
  color_qty INT DEFAULT 0,
  po_qty INT DEFAULT 0,
  confirmed_due DATE,
  vendor TEXT,
  country TEXT,
  factory TEXT,
  delivery TEXT,
  direct_ship BOOLEAN DEFAULT FALSE,
  -- 원단
  fabric_vendor TEXT,
  fabric_spec TEXT,
  bt_confirm DATE,
  bulk_confirm DATE,
  ksk_result TEXT,
  gb_result TEXT,
  -- 사양
  artwork_confirm DATE,
  qc1_receive DATE, qc1_confirm DATE,
  qc2_receive DATE, qc2_confirm DATE,
  qc3_receive DATE, qc3_confirm DATE,
  app_confirm DATE,
  pp1_receive DATE, pp1_confirm DATE,
  pp2_receive DATE, pp2_confirm DATE,
  pp_confirm DATE,
  matching_chart DATE,
  yardage_confirm DATE,
  -- 생산
  fabric_order DATE,
  fabric_ship DATE,
  fabric_inbound DATE,
  cutting_start DATE,
  sewing_start DATE,
  sewing_complete DATE,
  finish_date DATE,
  shipping_date DATE,
  acceptance_sample DATE,
  acceptance_confirm DATE,
  acceptance_all DATE,
  final_test_ksk TEXT,
  final_test_gb TEXT,
  -- 입고
  remark TEXT,
  remark_history TEXT,
  inbound_1_date DATE, inbound_1_qty INT,
  inbound_2_date DATE, inbound_2_qty INT,
  inbound_3_date DATE, inbound_3_qty INT,
  inbound_4_date DATE, inbound_4_qty INT,
  inbound_5_date DATE, inbound_5_qty INT,
  expected_qty INT,
  expected_rate DECIMAL,
  remaining_qty INT,
  is_closed BOOLEAN DEFAULT FALSE,
  over_short_remark TEXT,
  -- 원가
  expected_cost DECIMAL,
  confirmed_cost DECIMAL,
  confirmed_price DECIMAL,
  material_mix TEXT,
  wash_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stylecd, chasu, colorcd)
);

-- vendor_submissions: 협력사 제출 데이터
CREATE TABLE vendor_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylecd TEXT NOT NULL,
  chasu TEXT NOT NULL,
  colorcd TEXT NOT NULL,
  brandcd TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  submitted_by UUID,
  submission_type TEXT NOT NULL, -- 'inbound_schedule' | 'material_mix' | 'wash_code'
  inbound_schedule JSONB,
  material_data JSONB,
  wash_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_vendor_sub_vendor ON vendor_submissions(vendor_name, status);
CREATE INDEX idx_vendor_sub_style ON vendor_submissions(stylecd, chasu, colorcd);
CREATE INDEX idx_vendor_sub_status ON vendor_submissions(status) WHERE status = 'pending';
CREATE INDEX idx_srm_vendor ON srm_production(vendor);
CREATE INDEX idx_srm_md ON srm_production(sourcing_md);
CREATE INDEX idx_srm_brand ON srm_production(brandcd);

-- profiles에 vendor_name 컬럼 추가 (협력사 사용자 식별용)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vendor_name TEXT;
-- role 체크 업데이트: vendor 역할 추가 필요 시 profiles.role에 'vendor' 값 허용
