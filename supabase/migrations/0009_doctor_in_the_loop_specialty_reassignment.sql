-- =============================================================
-- 0009_doctor_in_the_loop_specialty_reassignment.sql
-- Civic Access (Team Liquid)
--
-- Adds Doctor-in-the-Loop (HITL) specialty verification and
-- patient re-referral columns to public.appointments.
--
-- When a doctor reviews a pending appointment request:
-- 1. If appropriate, doctor confirms appointment.
-- 2. If inappropriate specialty, doctor declines and is required
--    to provide a clinical rationale (status_reason) and a recommended
--    specialist (doctor_recommended_specialty).
-- =============================================================

-- 1. Add AI context columns to appointments
alter table public.appointments
  add column if not exists ai_recommended_specialty text,
  add column if not exists ai_recommended_sub_specialty text;

-- 2. Add doctor reassignment columns to appointments
alter table public.appointments
  add column if not exists doctor_recommended_specialty text,
  add column if not exists doctor_recommended_sub_specialty text,
  add column if not exists reassigned_by_doctor boolean not null default false;

-- 3. Index for quick filtering on doctor recommended appointments
create index if not exists idx_appointments_reassigned
  on public.appointments (reassigned_by_doctor)
  where reassigned_by_doctor = true;
