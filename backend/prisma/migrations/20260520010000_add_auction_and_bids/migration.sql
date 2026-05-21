-- Auction & BidEvent migration (MySQL 8).
-- The PlaceBid path uses `SELECT id FROM auction WHERE id = ? FOR UPDATE`
-- for concurrency (see scope-cuts.md CUT-1: chose MySQL row-level lock over
-- the original ADR-006 Redis Redlock for school-project scope).

CREATE TABLE `auction` (
  `id`                  VARCHAR(191) NOT NULL,
  `status`              ENUM('CREATED', 'OPEN', 'AWARDED', 'UNSOLD') NOT NULL DEFAULT 'CREATED',
  `start_price`         BIGINT NOT NULL,
  `highest`             BIGINT NOT NULL,
  `highest_bidder_id`   BIGINT NULL,
  `bid_count`           INT NOT NULL DEFAULT 0,
  `min_increment`       BIGINT NOT NULL DEFAULT 100,
  `started_at`          DATETIME(3) NOT NULL,
  `ends_at`             DATETIME(3) NOT NULL,
  `settled_at`          DATETIME(3) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `auction_status_ends_at_idx` (`status`, `ends_at`),
  CONSTRAINT `auction_start_price_nonneg`     CHECK (`start_price` >= 0),
  CONSTRAINT `auction_highest_nonneg`         CHECK (`highest` >= 0),
  CONSTRAINT `auction_bid_count_nonneg`       CHECK (`bid_count` >= 0),
  CONSTRAINT `auction_min_increment_positive` CHECK (`min_increment` > 0),
  CONSTRAINT `auction_time_ordering`          CHECK (`ends_at` > `started_at`),
  CONSTRAINT `auction_winner_fk` FOREIGN KEY (`highest_bidder_id`) REFERENCES `users`(`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE `bid_event` (
  `id`         BIGINT NOT NULL AUTO_INCREMENT,
  `auction_id` VARCHAR(191) NOT NULL,
  `user_id`    BIGINT NOT NULL,
  `amount`     BIGINT NOT NULL,
  `placed_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `bid_event_auction_recent_idx` (`auction_id`, `placed_at` DESC),
  CONSTRAINT `bid_event_amount_positive` CHECK (`amount` > 0),
  CONSTRAINT `bid_event_auction_fk` FOREIGN KEY (`auction_id`) REFERENCES `auction`(`id`),
  CONSTRAINT `bid_event_user_fk`    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
