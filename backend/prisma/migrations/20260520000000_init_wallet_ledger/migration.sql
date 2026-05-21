-- TimesoftCone — initial Wallet & Ledger migration (MySQL 8).
-- Encodes: CLAUDE.md DB-RULE-1 (Insert-Only ledger), ADR-011 (wallet master),
-- ADR-010 (currency enum).
--
-- MySQL notes:
--   * Enums are inline in column definitions (MySQL has no CREATE TYPE).
--   * Triggers use SIGNAL SQLSTATE for the INSERT-Only enforcement.
--   * MySQL does NOT fire triggers on TRUNCATE, so the protection there relies
--     on application discipline + the absence of update/delete methods on
--     LedgerRepository.

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE `users` (
  `id`         BIGINT NOT NULL AUTO_INCREMENT,
  `emp_id`     VARCHAR(191) NOT NULL,
  `name`       VARCHAR(191) NOT NULL,
  `team`       VARCHAR(191) NULL,
  `role`       ENUM('EMPLOYEE', 'ADMIN') NOT NULL DEFAULT 'EMPLOYEE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_emp_id_key` (`emp_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ============================================================
-- WALLET — source of truth for balances (ADR-011)
-- ============================================================
CREATE TABLE `wallet` (
  `id`         BIGINT NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT NOT NULL,
  `currency`   ENUM('WELFARE_POINT') NOT NULL,
  `balance`    BIGINT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_wallet_user_currency` (`user_id`, `currency`),
  CONSTRAINT `wallet_balance_nonnegative` CHECK (`balance` >= 0),
  CONSTRAINT `wallet_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ============================================================
-- LEDGER_ENTRY — Insert-Only (CLAUDE.md DB-RULE-1)
-- ============================================================
CREATE TABLE `ledger_entry` (
  `id`            BIGINT NOT NULL AUTO_INCREMENT,
  `occurred_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id`       BIGINT NOT NULL,
  `currency`      ENUM('WELFARE_POINT') NOT NULL,
  `action_type`   ENUM('BID', 'REFUND', 'WIN', 'DIVIDEND', 'CREDIT_ADMIN', 'EXPIRE') NOT NULL,
  `amount`        BIGINT NOT NULL,
  `balance_after` BIGINT NOT NULL,
  `auction_id`    VARCHAR(191) NULL,
  `ref_note`      TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `ledger_user_time_idx`   (`user_id`, `occurred_at`),
  INDEX `ledger_action_time_idx` (`action_type`, `occurred_at`),
  CONSTRAINT `ledger_balance_after_nonnegative` CHECK (`balance_after` >= 0),
  CONSTRAINT `ledger_credit_admin_needs_note`
    CHECK (`action_type` <> 'CREDIT_ADMIN' OR (`ref_note` IS NOT NULL AND CHAR_LENGTH(`ref_note`) > 0)),
  CONSTRAINT `ledger_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ============================================================
-- Insert-Only enforcement (DB-RULE-1)
-- ============================================================
CREATE TRIGGER `ledger_entry_no_update`
  BEFORE UPDATE ON `ledger_entry`
  FOR EACH ROW
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'DB-RULE-1: ledger_entry is INSERT-ONLY. UPDATE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN).';

CREATE TRIGGER `ledger_entry_no_delete`
  BEFORE DELETE ON `ledger_entry`
  FOR EACH ROW
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'DB-RULE-1: ledger_entry is INSERT-ONLY. DELETE blocked. Use a compensating INSERT (REFUND / CREDIT_ADMIN).';
