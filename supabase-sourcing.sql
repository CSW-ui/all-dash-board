-- Supabase SQL Editor에서 실행
-- 소싱 현황 테이블 (온라인 발매일정에 필요한 핵심 필드만)

CREATE TABLE IF NOT EXISTS sourcing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylecd TEXT NOT NULL,
  colorcd TEXT NOT NULL,
  brandcd TEXT NOT NULL,

  -- 기본정보
  style_name TEXT,                  -- 품명
  delivery TEXT,                    -- 딜리버리 (1차, 2차 등)
  sourcing_md TEXT,                 -- 소싱MD
  vendor TEXT,                      -- 협력업체
  country TEXT,                     -- 생산국가

  -- 수량
  order_qty INTEGER DEFAULT 0,      -- 발주수량
  received_qty INTEGER DEFAULT 0,   -- 입고량

  -- 핵심 일정 (온라인팀이 봐야 하는 것)
  confirmed_due_date DATE,          -- 확정납기 (언제 입고 예정?)
  photo_sample_date DATE,           -- 수납샘플 입수일 (언제 촬영 샘플?)
  delay_days INTEGER DEFAULT 0,     -- 입고 지연일

  -- 생산 진행 단계 (진행률 계산용)
  fabric_in BOOLEAN DEFAULT false,       -- 원단 입고
  cutting_done BOOLEAN DEFAULT false,    -- 재단 완료
  sewing_done BOOLEAN DEFAULT false,     -- 봉제 완료
  production_done BOOLEAN DEFAULT false, -- 완성
  shipped BOOLEAN DEFAULT false,         -- 선적
  received BOOLEAN DEFAULT false,        -- 입고 완료

  -- 소재 (상세페이지 연동)
  material_mix TEXT,                -- 혼용률
  wash_code TEXT,                   -- 세탁코드

  -- 메모
  remark TEXT,                      -- 특이사항/지연사유
  is_closed BOOLEAN DEFAULT false,  -- 종결여부

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(stylecd, colorcd, brandcd)
);

ALTER TABLE sourcing_status DISABLE ROW LEVEL SECURITY;

CREATE TRIGGER sourcing_status_updated_at
  BEFORE UPDATE ON sourcing_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
