-- Web paid-tier gate: tag each Better Auth session with its originating
-- platform (web | mobile), derived server-side from the request Origin.
-- Existing rows backfill to 'mobile' (the safe default).
--
-- NOTE: This column already exists in the production database (verified
-- 2026-06-13: text NOT NULL DEFAULT 'mobile'). This file records the schema
-- change in version control. IF NOT EXISTS makes it idempotent/safe to re-run.
ALTER TABLE session
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'mobile';
