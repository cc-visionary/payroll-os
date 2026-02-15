-- Fix stale breakMinutesApplied = 0 records from legacy default
--
-- Background: The initial migration created breakMinutesApplied as NOT NULL DEFAULT 0.
-- A later migration (20260131022827) made it nullable and dropped the default,
-- but all existing records retained breakMinutesApplied = 0.
-- The code treats 0 as "break overridden to 0 (working lunch)", causing:
--   - 60 min phantom OT (breakAdjustmentMinutes = 60 added to otLateOutMinutes)
--   - Incorrect undertime reduction by 60 min
--
-- This script NULLs out the stale 0 values where no intentional override was made,
-- preserving legitimate "working lunch" overrides (where overrideReason or overrideById is set).

-- Preview affected records (run this first to verify scope):
-- SELECT COUNT(*) FROM attendance_day_records
-- WHERE "breakMinutesApplied" = 0
--   AND "overrideReason" IS NULL
--   AND "overrideById" IS NULL;

-- Apply fix:
UPDATE attendance_day_records
SET "breakMinutesApplied" = NULL
WHERE "breakMinutesApplied" = 0
  AND "overrideReason" IS NULL
  AND "overrideById" IS NULL;
