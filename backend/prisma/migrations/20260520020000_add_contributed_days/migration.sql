-- Add contributed_days to users for the dividend stake calculation.
-- See ADR-017 LeavePool — this column is a school-project shortcut so we
-- can compute stake ratios without building the full LeavePool aggregate.

ALTER TABLE `users`
  ADD COLUMN `contributed_days` INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT `users_contributed_days_nonneg` CHECK (`contributed_days` >= 0);
