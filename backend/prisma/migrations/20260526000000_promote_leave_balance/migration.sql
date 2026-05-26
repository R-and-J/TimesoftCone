-- Promote the flat three-flag leave columns on `users` into a structured
-- per-user / per-year / per-type table (ADR-002 three-flag, ADR-016 leave master).
-- Modeled on ezpass tbl_user_yryc (granted = atmc_yryc_day_qty, adjusted = mdat_yryc_day_qty).
-- Member identity comes from ezpass; leave balances are owned here so auction
-- settlement stays a single local transaction.

-- ============================================================
-- 1. New structured table
-- ============================================================
CREATE TABLE `leave_balance` (
  `id`            BIGINT NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT NOT NULL,
  `year`          INT NOT NULL,
  `leave_type`    ENUM('REGULAR', 'AUCTION', 'EVENT') NOT NULL,
  `granted_days`  INT NOT NULL DEFAULT 0,
  `adjusted_days` INT NOT NULL DEFAULT 0,
  `used_days`     INT NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_leave_user_year_type` (`user_id`, `year`, `leave_type`),
  INDEX `leave_user_year_idx` (`user_id`, `year`),
  CONSTRAINT `leave_granted_nonneg`  CHECK (`granted_days`  >= 0),
  CONSTRAINT `leave_adjusted_nonneg` CHECK (`adjusted_days` >= 0),
  CONSTRAINT `leave_used_nonneg`     CHECK (`used_days`     >= 0),
  CONSTRAINT `leave_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ============================================================
-- 2. Migrate existing flat-column balances (current accounting year).
--    REGULAR -> granted (auto annual leave); AUCTION/EVENT -> adjusted.
-- ============================================================
INSERT INTO `leave_balance` (`user_id`, `year`, `leave_type`, `granted_days`, `adjusted_days`, `used_days`)
  SELECT `id`, 2026, 'REGULAR', `regular_leave_days`, 0, 0 FROM `users` WHERE `regular_leave_days` > 0;
INSERT INTO `leave_balance` (`user_id`, `year`, `leave_type`, `granted_days`, `adjusted_days`, `used_days`)
  SELECT `id`, 2026, 'AUCTION', 0, `auction_leave_days`, 0 FROM `users` WHERE `auction_leave_days` > 0;
INSERT INTO `leave_balance` (`user_id`, `year`, `leave_type`, `granted_days`, `adjusted_days`, `used_days`)
  SELECT `id`, 2026, 'EVENT', 0, `event_leave_days`, 0 FROM `users` WHERE `event_leave_days` > 0;

-- ============================================================
-- 3. Drop the flat columns + their CHECK constraints.
-- ============================================================
ALTER TABLE `users`
  DROP CHECK `users_regular_leave_nonneg`,
  DROP CHECK `users_auction_leave_nonneg`,
  DROP CHECK `users_event_leave_nonneg`;

ALTER TABLE `users`
  DROP COLUMN `regular_leave_days`,
  DROP COLUMN `auction_leave_days`,
  DROP COLUMN `event_leave_days`;
