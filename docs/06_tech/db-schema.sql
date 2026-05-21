-- ============================================================================
-- 사내 연차 경매 시스템 — PostgreSQL 스키마 (v2)
-- 상태: 🟡 초안. 팀 리뷰 및 tech-stack 확정 후 최종화
-- 참조: SRS 3.4, erd.md, ADR-001/002/004/010/011/014/015
--
-- v2 변경 요약 (2026-05-14):
--   - users.current_point 제거 → wallet 테이블 분리 (ADR-010 currency 추상화)
--   - point_transaction_log → ledger_entry (ADR-010, ADR-011)
--   - currency 컬럼 추가 (다중 화폐 대비)
--   - action_type에 CREDIT_ADMIN / EXPIRE 추가 (ADR-011 관리자 적립)
--   - outbox payload 다중 currency 지원
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auction;
SET search_path TO auction;

-- ----------------------------------------------------------------------------
-- Enum Types
-- ----------------------------------------------------------------------------
CREATE TYPE leave_type AS ENUM ('REGULAR', 'AUCTION', 'EVENT');
CREATE TYPE auction_status AS ENUM ('CREATED', 'OPEN', 'CLOSED', 'AWARDED', 'UNSOLD', 'EXPIRED');
CREATE TYPE action_type AS ENUM (
    'BID',           -- 입찰 시 차감
    'REFUND',        -- 유찰·취소 환불 적립
    'WIN',           -- 낙찰 확정 (BID와 별도 로깅하여 감사 가능)
    'DIVIDEND',      -- 연말 배당 출금 (외부 payout)
    'CREDIT_ADMIN',  -- 관리자 적립 (ADR-011 분기/이벤트 지급)
    'EXPIRE'         -- 만료·소멸 (현재는 ADR-011에서 미사용, 미래 확장)
);
CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'ADMIN');

-- ----------------------------------------------------------------------------
-- USERS  — 잔액 컬럼 제거 (wallet 테이블로 분리)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    emp_id          VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    role            user_role NOT NULL DEFAULT 'EMPLOYEE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_emp_id ON users(emp_id);

-- ----------------------------------------------------------------------------
-- WALLET — 잔액 마스터 (ADR-010, ADR-011)
--   - currency 컬럼으로 다중 화폐 대비
--   - 현재 운영 화폐는 'WELFARE_POINT' 단일 (ADR-009)
-- ----------------------------------------------------------------------------
CREATE TABLE wallet (
    user_id     BIGINT      NOT NULL REFERENCES users(id),
    currency    VARCHAR(30) NOT NULL,           -- 'WELFARE_POINT' (ADR-009)
    balance     BIGINT      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, currency),
    CONSTRAINT chk_wallet_balance_nonneg CHECK (balance >= 0)
);

CREATE INDEX idx_wallet_currency ON wallet(currency);

-- ----------------------------------------------------------------------------
-- LEAVE_BALANCE (파티셔닝: year 기준 — ADR-004)
-- ----------------------------------------------------------------------------
CREATE TABLE leave_balance (
    id              BIGSERIAL,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    year            INT NOT NULL,
    leave_type      leave_type NOT NULL,
    allocated_days  INT NOT NULL DEFAULT 0,
    used_days       INT NOT NULL DEFAULT 0,
    deleted_at      TIMESTAMPTZ,  -- Soft Delete (DB-RULE-2)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, year),
    CONSTRAINT uq_leave_balance_triple UNIQUE (user_id, year, leave_type),
    CONSTRAINT chk_allocated_nonneg CHECK (allocated_days >= 0),
    CONSTRAINT chk_used_nonneg      CHECK (used_days >= 0),
    CONSTRAINT chk_used_le_allocated CHECK (used_days <= allocated_days)
) PARTITION BY RANGE (year);

CREATE TABLE leave_balance_2026 PARTITION OF leave_balance
    FOR VALUES FROM (2026) TO (2027);
CREATE TABLE leave_balance_2027 PARTITION OF leave_balance
    FOR VALUES FROM (2027) TO (2028);

CREATE INDEX idx_lb_user_year ON leave_balance(user_id, year);

-- ----------------------------------------------------------------------------
-- AUCTIONS
--   - status enum 확장 (ADR-014 State 패턴의 6개 상태 모두 표현)
-- ----------------------------------------------------------------------------
CREATE TABLE auctions (
    id              BIGSERIAL PRIMARY KEY,
    status          auction_status NOT NULL DEFAULT 'OPEN',
    year            INT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    highest_bid     BIGINT NOT NULL DEFAULT 0,
    winner_id       BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_auction_times     CHECK (end_time > start_time),
    CONSTRAINT chk_auction_highest   CHECK (highest_bid >= 0)
);

CREATE INDEX idx_auctions_status_endtime ON auctions(status, end_time);
CREATE INDEX idx_auctions_year           ON auctions(year);

-- ----------------------------------------------------------------------------
-- LEDGER_ENTRY (DB-RULE-1: Insert-Only)
--   - 구 POINT_TRANSACTION_LOG → 통합 원장으로 명명 변경 (ADR-010, ADR-011)
--   - currency 컬럼 추가 (다중 화폐 분리 검증 가능)
-- ----------------------------------------------------------------------------
CREATE TABLE ledger_entry (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users(id),
    auction_id              BIGINT REFERENCES auctions(id),
    currency                VARCHAR(30) NOT NULL,    -- 'WELFARE_POINT'
    action_type             action_type NOT NULL,
    amount                  BIGINT NOT NULL,         -- (+)/(-)
    escrow_balance_snapshot BIGINT NOT NULL,         -- Memento 패턴 (ADR-015 §향후 검토)
    reason                  TEXT,                    -- CREDIT_ADMIN 시 필수
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- CREDIT_ADMIN은 사유 필수
    CONSTRAINT chk_ledger_credit_admin_reason
        CHECK (action_type <> 'CREDIT_ADMIN' OR (reason IS NOT NULL AND length(reason) > 0))
);

CREATE INDEX idx_ledger_user      ON ledger_entry(user_id);
CREATE INDEX idx_ledger_auction   ON ledger_entry(auction_id);
CREATE INDEX idx_ledger_action    ON ledger_entry(action_type);
CREATE INDEX idx_ledger_currency  ON ledger_entry(currency);
CREATE INDEX idx_ledger_created   ON ledger_entry(created_at);

-- -----------------------------
-- 🛡️ Insert-Only 트리거 (DB-RULE-1)
-- -----------------------------
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'LEDGER_ENTRY is insert-only (DB-RULE-1). Use REFUND/CREDIT_ADMIN INSERT instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_prevent_update
    BEFORE UPDATE ON ledger_entry
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

CREATE TRIGGER ledger_prevent_delete
    BEFORE DELETE ON ledger_entry
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ----------------------------------------------------------------------------
-- STAKE (연도별 기여자 지분)
-- ----------------------------------------------------------------------------
CREATE TABLE stake (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    year                INT NOT NULL,
    contributed_days    INT NOT NULL,
    stake_ratio         NUMERIC(10, 8) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stake_user_year     UNIQUE (user_id, year),
    CONSTRAINT chk_stake_days_pos     CHECK (contributed_days > 0),
    CONSTRAINT chk_stake_ratio_range  CHECK (stake_ratio >= 0 AND stake_ratio <= 1)
);

CREATE INDEX idx_stake_year ON stake(year);

-- ----------------------------------------------------------------------------
-- ESCROW (집계 테이블)
--   - currency 단위 분리 (ADR-010 다중 화폐 대비)
-- ----------------------------------------------------------------------------
CREATE TABLE escrow (
    year        INT NOT NULL,
    currency    VARCHAR(30) NOT NULL,
    balance     BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (year, currency),
    CONSTRAINT chk_escrow_balance_nonneg CHECK (balance >= 0)
);

-- ----------------------------------------------------------------------------
-- OUTBOX (ADR-005 Outbox Pattern)
--   - 외부 시스템 호출 트리거 (HR /leave, HR /welfare)
-- ----------------------------------------------------------------------------
CREATE TABLE outbox (
    id              BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    aggregate_type  VARCHAR(50)  NOT NULL,   -- 'auction_award', 'dividend_payout'
    aggregate_id    BIGINT       NOT NULL,
    payload         JSONB        NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING/SENT/DLQ
    retry_count     INT          NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status_created ON outbox(status, created_at);

-- ----------------------------------------------------------------------------
-- 감사 뷰: 에스크로 정합성 실시간 검증 (NFR-2)
--   - currency 단위로 분리 검증
--   - 공식: Σ(BID + WIN) - Σ(REFUND + DIVIDEND) = ESCROW.balance
--   - CREDIT_ADMIN은 외부 적립이므로 에스크로 등식과 무관 (분리)
-- ----------------------------------------------------------------------------
CREATE VIEW escrow_audit_view AS
SELECT
    EXTRACT(YEAR FROM created_at)::INT AS year,
    currency,
    COALESCE(SUM(CASE WHEN action_type IN ('BID','WIN') THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN action_type = 'REFUND'   THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN action_type = 'DIVIDEND' THEN amount ELSE 0 END), 0)
        AS computed_balance
FROM ledger_entry
WHERE action_type IN ('BID', 'WIN', 'REFUND', 'DIVIDEND')  -- CREDIT_ADMIN/EXPIRE 제외
GROUP BY EXTRACT(YEAR FROM created_at), currency;

-- 사용 예: 배치 시점에 computed_balance ≠ escrow.balance면 경보 발동

-- ----------------------------------------------------------------------------
-- 시드 데이터 (개발·테스트용)
-- ----------------------------------------------------------------------------
INSERT INTO users (emp_id, name, role) VALUES
    ('E00001', '김기철', 'ADMIN'),
    ('E00002', '오지석', 'EMPLOYEE'),
    ('E00003', '예은',   'EMPLOYEE');

-- 잔액은 관리자 적립으로 시드 (CREDIT_ADMIN action) — ADR-011 §시드 정책
INSERT INTO wallet (user_id, currency, balance) VALUES
    (1, 'WELFARE_POINT', 100000),
    (2, 'WELFARE_POINT', 80000),
    (3, 'WELFARE_POINT', 50000);

INSERT INTO ledger_entry (user_id, currency, action_type, amount, escrow_balance_snapshot, reason)
VALUES
    (1, 'WELFARE_POINT', 'CREDIT_ADMIN', 100000, 0, 'Initial seed (development)'),
    (2, 'WELFARE_POINT', 'CREDIT_ADMIN',  80000, 0, 'Initial seed (development)'),
    (3, 'WELFARE_POINT', 'CREDIT_ADMIN',  50000, 0, 'Initial seed (development)');

INSERT INTO leave_balance (user_id, year, leave_type, allocated_days) VALUES
    (1, 2026, 'REGULAR', 15),
    (2, 2026, 'REGULAR', 15),
    (3, 2026, 'REGULAR', 10);

INSERT INTO escrow (year, currency, balance) VALUES (2026, 'WELFARE_POINT', 0);

-- ============================================================================
-- TODO
-- ============================================================================
-- [ ] 인덱스 전략 부하 테스트 후 조정
-- [ ] VACUUM/ANALYZE 자동화 (파티션 추가 후 통계 갱신)
-- [ ] Outbox polling worker 설계 (ADR-005 확정 후)
-- [ ] 배치 procedure: 12/31 year-end-settlement
-- [ ] 배치 procedure: 12/31 dividend-distribution
-- [ ] LEAVE_BALANCE 파티션 자동 생성 스케줄러 (매년 11/30)
-- [ ] wallet ↔ HR 마이그레이션 도구 (ADR-011 운영 시드)
-- ============================================================================
