-- 테이블·컬럼 COMMENT 추가 (자기문서화).
-- 이미 적용된 마이그레이션은 수정하지 않고, 별도 forward 마이그레이션으로 COMMENT만 부착.
-- Prisma는 MySQL 컬럼 COMMENT를 스키마 diff에서 추적하지 않으므로 이 변경을 되돌리지 않음.
-- 컬럼 정의는 원본 마이그레이션과 100% 동일하게 재기술하고 COMMENT만 덧붙임
-- (MySQL은 컬럼 COMMENT 변경에 MODIFY COLUMN + 전체 정의 재기술을 요구).

-- ============================================================
-- users — 직원 마스터
-- ============================================================
ALTER TABLE `users` COMMENT = '직원 마스터. HR 동기화는 범위 외 — 사번 기준 stub (ADR-016).';

ALTER TABLE `users`
  MODIFY COLUMN `id`                 BIGINT NOT NULL AUTO_INCREMENT COMMENT '내부 PK (자동 증가)',
  MODIFY COLUMN `emp_id`             VARCHAR(191) NOT NULL COMMENT '사번 (HR 연동 키, 유니크)',
  MODIFY COLUMN `name`               VARCHAR(191) NOT NULL COMMENT '직원 이름',
  MODIFY COLUMN `team`               VARCHAR(191) NULL COMMENT '소속 팀 (선택)',
  MODIFY COLUMN `role`               ENUM('EMPLOYEE', 'ADMIN') NOT NULL DEFAULT 'EMPLOYEE' COMMENT '권한 — EMPLOYEE/ADMIN (RBAC, permission-matrix.md)',
  MODIFY COLUMN `created_at`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성 시각',
  MODIFY COLUMN `contributed_days`   INT NOT NULL DEFAULT 0 COMMENT '올해 공용 풀 기여 연차 일수 → 배당 지분(stake) 산정 기준 (ADR-017 LeavePool 단순화)',
  MODIFY COLUMN `regular_leave_days` INT NOT NULL DEFAULT 12 COMMENT '법정 연차 잔여 (REGULAR, 수당 대상) — ADR-002 3-flag',
  MODIFY COLUMN `auction_leave_days` INT NOT NULL DEFAULT 0 COMMENT '경매 낙찰 연차 잔여 (AUCTION, 수당 제외, 최우선 차감). 낙찰 자동 가산은 미구현 — scope-cuts CUT-9',
  MODIFY COLUMN `event_leave_days`   INT NOT NULL DEFAULT 0 COMMENT '이벤트/포상 연차 잔여 (EVENT, 수당 제외)';

-- ============================================================
-- wallet — 잔액 마스터 (ADR-011)
-- ============================================================
ALTER TABLE `wallet` COMMENT = '잔액 마스터 (단일 진실 공급원, ADR-011). 입찰 차감/환불/관리자 적립이 반영.';

ALTER TABLE `wallet`
  MODIFY COLUMN `id`         BIGINT NOT NULL AUTO_INCREMENT COMMENT '내부 PK (자동 증가)',
  MODIFY COLUMN `user_id`    BIGINT NOT NULL COMMENT '소유 직원 (FK users.id)',
  MODIFY COLUMN `currency`   ENUM('WELFARE_POINT') NOT NULL COMMENT '화폐 코드 — 현재 WELFARE_POINT 단일 (ADR-010 통화 추상화)',
  MODIFY COLUMN `balance`    BIGINT NOT NULL DEFAULT 0 COMMENT '현재 잔액 (음수 불가 CHECK). 입찰 시 즉시 차감',
  MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '갱신 시각 (자동)';

-- ============================================================
-- ledger_entry — 불변 거래 원장 (Insert-Only, DB-RULE-1)
-- ============================================================
ALTER TABLE `ledger_entry` COMMENT = '불변 거래 원장 (Insert-Only, DB-RULE-1). UPDATE/DELETE는 트리거 차단. 정정은 보상 INSERT(REFUND/CREDIT_ADMIN).';

ALTER TABLE `ledger_entry`
  MODIFY COLUMN `id`            BIGINT NOT NULL AUTO_INCREMENT COMMENT '내부 PK (자동 증가)',
  MODIFY COLUMN `occurred_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '거래 발생 시각',
  MODIFY COLUMN `user_id`       BIGINT NOT NULL COMMENT '대상 직원 (FK users.id)',
  MODIFY COLUMN `currency`      ENUM('WELFARE_POINT') NOT NULL COMMENT '화폐 코드',
  MODIFY COLUMN `action_type`   ENUM('BID', 'REFUND', 'WIN', 'DIVIDEND', 'CREDIT_ADMIN', 'EXPIRE') NOT NULL COMMENT '거래 유형 — BID/REFUND/WIN/DIVIDEND/CREDIT_ADMIN/EXPIRE',
  MODIFY COLUMN `amount`        BIGINT NOT NULL COMMENT '변동 금액 (부호 포함: + 입금 / - 출금)',
  MODIFY COLUMN `balance_after` BIGINT NOT NULL COMMENT '거래 직후 잔액 스냅샷 (감사 추적)',
  MODIFY COLUMN `auction_id`    VARCHAR(191) NULL COMMENT '관련 경매 (FK auction.id; 배당/관리자 적립 시 NULL)',
  MODIFY COLUMN `ref_note`      TEXT NULL COMMENT '사유/메모 — CREDIT_ADMIN은 필수 (CHECK)';

-- ============================================================
-- auction — 경매 매물 (연차 1일권)
-- ============================================================
ALTER TABLE `auction` COMMENT = '경매 매물 (연차 1일권). 상태 머신 ADR-014 (scope-cuts CUT-3로 enum+가드 단순화).';

ALTER TABLE `auction`
  MODIFY COLUMN `id`                VARCHAR(191) NOT NULL COMMENT '경매 ID (문자열 PK, 예: A-2026-104)',
  MODIFY COLUMN `status`            ENUM('CREATED', 'OPEN', 'AWARDED', 'UNSOLD') NOT NULL DEFAULT 'CREATED' COMMENT '상태 — CREATED/OPEN/AWARDED/UNSOLD',
  MODIFY COLUMN `start_price`       BIGINT NOT NULL COMMENT '시작가',
  MODIFY COLUMN `highest`           BIGINT NOT NULL COMMENT '현재 최고 입찰가',
  MODIFY COLUMN `highest_bidder_id` BIGINT NULL COMMENT '현재 최고 입찰자 (FK users.id; 없으면 NULL)',
  MODIFY COLUMN `bid_count`         INT NOT NULL DEFAULT 0 COMMENT '누적 입찰 수',
  MODIFY COLUMN `min_increment`     BIGINT NOT NULL DEFAULT 100 COMMENT '최소 입찰 증분 (기본 100) — business-rules OP-3',
  MODIFY COLUMN `started_at`        DATETIME(3) NOT NULL COMMENT '경매 시작(오픈) 시각',
  MODIFY COLUMN `ends_at`           DATETIME(3) NOT NULL COMMENT '마감 시각 (started_at 이후, CHECK)',
  MODIFY COLUMN `settled_at`        DATETIME(3) NULL COMMENT '정산 완료 시각 (미정산 NULL)',
  MODIFY COLUMN `created_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성 시각',
  MODIFY COLUMN `updated_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '갱신 시각 (자동)';

-- ============================================================
-- bid_event — 수락된 입찰 이력 (감사 로그)
-- ============================================================
ALTER TABLE `bid_event` COMMENT = '수락된 입찰 이력 (감사 로그). 경매 상세 화면 피드.';

ALTER TABLE `bid_event`
  MODIFY COLUMN `id`         BIGINT NOT NULL AUTO_INCREMENT COMMENT '내부 PK (자동 증가)',
  MODIFY COLUMN `auction_id` VARCHAR(191) NOT NULL COMMENT '경매 (FK auction.id)',
  MODIFY COLUMN `user_id`    BIGINT NOT NULL COMMENT '입찰자 (FK users.id)',
  MODIFY COLUMN `amount`     BIGINT NOT NULL COMMENT '입찰 금액 (양수 CHECK)',
  MODIFY COLUMN `placed_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '입찰 시각';
