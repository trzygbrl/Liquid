-- =============================================================
-- 0007_appointment_status_reason.sql
-- Civic Access (Team Liquid)
--
-- Adds a required reason for declined/cancelled appointments, so the
-- patient always has clarity on why an appointment was dropped. Enforced
-- as a check constraint (not just at the UI layer) -- a status transition
-- into 'declined' or 'cancelled' without a reason is rejected by the DB.
--
-- Idempotent (IF NOT EXISTS / DROP ... IF EXISTS / re-runnable backfill)
-- so it's safe to run again after a partial failure.
-- =============================================================

alter table public.appointments add column if not exists status_reason text;

-- Backfill pre-existing declined/cancelled rows (created before this column
-- existed) -- otherwise the check constraint below rejects them on add.
update public.appointments
set status_reason = 'Reason not recorded (appointment was dropped before this feature was added).'
where status in ('declined', 'cancelled') and status_reason is null;

alter table public.appointments drop constraint if exists appointments_status_reason_required;

alter table public.appointments add constraint appointments_status_reason_required
  check (status not in ('declined', 'cancelled') or status_reason is not null);
