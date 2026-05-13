-- ============================================================================
-- 사내 연차 경매 시스템 — PostgreSQL 스키마
-- 상태: 🟡 초안. 팀 리뷰 및 tech-stack 확정 후 최종화
-- 참조: SRS 3.4, erd.md, ADR-001/002/004
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
CREATE TYPE auction_status AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');
CREATE TYPE action_type AS ENUM ('BID', 'REFUND', 'WIN', 'DIVIDEND');
CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'ADMIN');

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    emp_id          VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    role            user_role NOT NULL DEFAULT 'EMPLOYEE',
    current_point   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_point_nonneg CHECK (current_point >= 0)
);

CREATE INDEX idx_users_emp_id ON users(emp_id);

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

-- 연도별 파티션 (매년 11/30 작업으로 다음 해 파티션 미리 생성)
CREATE TABLE leave_balance_2026 PARTITION OF leave_balance
    FOR VALUES FROM (2026) TO (2027);
CREATE TABLE leave_balance_2027 PARTITION OF leave_balance
    FOR VALUES FROM (2027) TO (2028);

CREATE INDEX idx_lb_user_year ON leave_balance(user_id, year);

-- ----------------------------------------------------------------------------
-- AUCTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE auctions (
    id              BIGSERIAL PRIMARY KEY,
    status          auction_status NOT NULL DEFAULT 'OPEN',
    year            INT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    highest_bid     INT NOT NULL DEFAULT 0,
    winner_id       BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_auction_times     CHECK (end_time > start_time),
    CONSTRAINT chk_auction_highest   CHECK (highest_bid >= 0)
);

CREATE INDEX idx_auctions_status_endtime ON auctions(status, end_time);
CREATE INDEX idx_auctions_year           ON auctions(year);

-- ----------------------------------------------------------------------------
-- POINT_TRANSACTION_LOG (DB-RULE-1: Insert-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE point_transaction_log (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users(id),
    auction_id              BIGINT REFERENCES auctions(id),
    action_type             action_type NOT NULL,
    amount                  INT NOT NULL,             -- (+)/(-)
    escrow_balance_snapshot BIGINT NOT NULL,
    reason                  TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ptl_user      ON point_transaction_log(user_id);
CREATE INDEX idx_ptl_auction   ON point_transaction_log(auction_id);
CREATE INDEX idx_ptl_action    ON point_transaction_log(action_type);
CREATE INDEX idx_ptl_created   ON point_transaction_log(created_at);

-- -----------------------------
-- 🛡️ Insert-Only 트리거 (DB-RULE-1)
-- -----------------------------
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'POINT_TRANSACTION_LOG is insert-only (DB-RULE-1). Use REFUND INSERT instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ptl_prevent_update
    BEFORE UPDATE ON point_transaction_log
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

CREATE TRIGGER ptl_prevent_delete
    BEFORE DELETE ON point_transaction_log
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
-- ----------------------------------------------------------------------------
CREATE TABLE escrow (
    id          BIGSERIAL PRIMARY KEY,
    year        INT NOT NULL UNIQUE,
    balance     BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_escrow_balance_nonneg CHECK (balance >= 0)
);

-- ----------------------------------------------------------------------------
-- OUTBOX (ADR-005 Outbox Pattern — 채택 시 사용)
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
-- 감사 뷰: 에스크로 정합성 실시간 검증
-- ----------------------------------------------------------------------------
CREATE VIEW escrow_audit_view AS
SELECT
    EXTRACT(YEAR FROM created_at)::INT AS year,
    COALESCE(SUM(CASE WHEN action_type IN ('BID','WIN') THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN action_type = 'REFUND'   THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN action_type = 'DIVIDEND' THEN amount ELSE 0 END), 0)
        AS computed_balance
FROM point_transaction_log
GROUP BY EXTRACT(YEAR FROM created_at);

-- 사용 예: 배치 시점에 computed_balance ≠ escrow.balance면 경보 발동

-- ----------------------------------------------------------------------------
-- 시드 데이터 (개발·테스트용)
-- ----------------------------------------------------------------------------
INSERT INTO users (emp_id, name, role, current_point) VALUES
    ('E00001', '김기철', 'ADMIN',    100000),
    ('E00002', '오지석', 'EMPLOYEE', 80000),
    ('E00003', '예은',   'EMPLOYEE', 50000);

INSERT INTO leave_balance (user_id, year, leave_type, allocated_days) VALUES
    (1, 2026, 'REGULAR', 15),
    (2, 2026, 'REGULAR', 15),
    (3, 2026, 'REGULAR', 10);

INSERT INTO escrow (year, balance) VALUES (2026, 0);

-- ============================================================================
-- TODO
-- ============================================================================
-- [ ] 인덱스 전략 부하 테스트 후 조정
-- [ ] VACUUM/ANALYZE 자동화 (파티션 추가 후 통계 갱신)
-- [ ] Outbox polling worker 설계 (ADR-005 확정 후)
-- [ ] 배치 procedure: 12/31 year-end-settlement
-- [ ] 배치 procedure: 12/31 dividend-distribution
-- [ ] LEAVE_BALANCE 파티션 자동 생성 스케줄러 (매년 11/30)
-- ============================================================================
