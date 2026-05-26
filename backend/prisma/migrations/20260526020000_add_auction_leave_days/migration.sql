-- 경매가 낙찰자에게 부여하는 AUCTION 연차 일수 (ADR-002 3-flag / CUT-9).
-- 낙찰 정산 시 leave_balance(AUCTION).adjusted_days 에 적립. 기존 행 기본 1일.
ALTER TABLE `auction`
  ADD COLUMN `leave_days` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `auction_leave_days_positive` CHECK (`leave_days` >= 1);
