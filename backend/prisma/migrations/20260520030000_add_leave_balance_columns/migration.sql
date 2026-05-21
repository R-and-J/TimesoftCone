-- ADR-002 three-flag leave separation (REGULAR / AUCTION / EVENT).
-- Read-only at this point — bid settlement does not yet credit auction_leave_days.
-- See scope-cuts.md CUT-9 (Leave context partial revival, 2026-05-20).

ALTER TABLE `users`
  ADD COLUMN `regular_leave_days` INT NOT NULL DEFAULT 12,
  ADD COLUMN `auction_leave_days` INT NOT NULL DEFAULT 0,
  ADD COLUMN `event_leave_days`   INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT `users_regular_leave_nonneg` CHECK (`regular_leave_days` >= 0),
  ADD CONSTRAINT `users_auction_leave_nonneg` CHECK (`auction_leave_days` >= 0),
  ADD CONSTRAINT `users_event_leave_nonneg`   CHECK (`event_leave_days`   >= 0);
