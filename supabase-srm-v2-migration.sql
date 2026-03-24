-- =============================================================
-- SRM v2 마이그레이션: 6단계 워크플로우 기반 재설계
-- Supabase SQL Editor에서 실행
-- =============================================================

-- 1. srm_production에 워크플로우 컬럼 추가
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS vendor_response JSONB;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS vendor_responded_at TIMESTAMPTZ;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS confirmed_by UUID;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS md_comment TEXT;
ALTER TABLE srm_production ADD COLUMN IF NOT EXISTS last_vendor_update_at TIMESTAMPTZ;

-- 2. 기존 데이터 status 보정: 이미 데이터가 있는 건은 상태 추정
UPDATE srm_production SET status = 'completed' WHERE is_closed = TRUE;
UPDATE srm_production SET status = 'in_production' WHERE is_closed = FALSE AND fabric_order IS NOT NULL AND status = 'draft';
UPDATE srm_production SET status = 'confirmed' WHERE is_closed = FALSE AND confirmed_due IS NOT NULL AND fabric_order IS NULL AND status = 'draft';

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_srm_status ON srm_production(status);
CREATE INDEX IF NOT EXISTS idx_srm_status_vendor ON srm_production(status, vendor);

-- 4. vendor_submissions 테이블은 당분간 유지 (기존 데이터 참조용)
-- 신규 제출은 srm_production 직접 업데이트로 대체
-- 추후 안정화 후 DROP TABLE vendor_submissions;
