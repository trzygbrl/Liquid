-- =============================================================
-- 0008_doctor_verification_and_taxonomy_rls.sql
-- Civic Access (Team Liquid)
--
-- Two independent, bundled changes (Phase 7 pivot, see /.claude/roadmap.md
-- Task 7.1):
--   1. Replaces doctors.verified (an always-true, never-set boolean with no
--      real workflow behind it) with a real verification_status column plus
--      audit fields, locked to service-role-only writes so a doctor can't
--      self-verify from the browser console. The PRC license number itself
--      is NOT a new column here -- it lives in the existing
--      doctors.credentials text field (Task 7.2 makes that a real required
--      input instead of today's uploaded-filename stub).
--   2. Lets an authenticated doctor insert new rows into specialty_taxonomy
--      (self-service "add a new specialty/sub-specialty" -- Task 7.3), via
--      an RLS policy scoped by the `role` claim already set at signup time
--      in user_metadata (src/lib/auth.ts's signUpWithRole), since a
--      brand-new doctor doing this during onboarding won't have a `doctors`
--      row yet to check against instead.
--
-- Idempotent (IF NOT EXISTS / DROP ... IF EXISTS / re-runnable backfill)
-- so it's safe to run again after a partial failure.
-- =============================================================

-- =========================================================
-- 1. doctors: verified boolean -> verification_status + audit fields
-- =========================================================
alter table public.doctors
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists verification_notes text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

-- Backfill + drop the old column, guarded so re-running this migration
-- after it has already succeeded is a safe no-op (verified won't exist the
-- 2nd time). Every existing row was implicitly trusted under the old
-- always-true default, so this backfills them to 'verified' before the
-- column disappears -- nothing currently in patient search silently
-- vanishes when this lands.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'doctors' and column_name = 'verified'
  ) then
    update public.doctors
    set verification_status = 'verified'
    where verified = true;

    alter table public.doctors drop column verified;
  end if;
end;
$$;

-- =========================================================
-- 2. Lock verification_status/verification_notes/reviewed_by/reviewed_at
--    to service-role-only writes. auth.role() reads the PostgREST session's
--    role claim ('anon' / 'authenticated' / 'service_role') -- distinct
--    from the app's own user_metadata.role claim used in section 3 below.
--    A trigger is used rather than an RLS policy because service-role
--    connections bypass RLS entirely but still fire triggers, and RLS alone
--    can't express "this specific set of columns is locked" the way a
--    trigger silently reverting them can.
-- =========================================================
create or replace function public.protect_doctor_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.verification_status := old.verification_status;
    new.verification_notes  := old.verification_notes;
    new.reviewed_by         := old.reviewed_by;
    new.reviewed_at         := old.reviewed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_doctor_verification_fields on public.doctors;
create trigger trg_protect_doctor_verification_fields
before update on public.doctors
for each row execute function public.protect_doctor_verification_fields();

-- =========================================================
-- 3. specialty_taxonomy: allow a doctor to self-service a new
--    specialty/sub-specialty entry (Task 7.3's "Other, please specify").
--    Existing policy `specialty_taxonomy_read_all` (public select) is
--    untouched -- this only adds insert. Checked via the user_metadata
--    role claim (not an `exists (select 1 from doctors...)` check) so it
--    works for a doctor who hasn't finished onboarding yet.
-- =========================================================
drop policy if exists "specialty_taxonomy_insert_doctors" on public.specialty_taxonomy;

create policy "specialty_taxonomy_insert_doctors" on public.specialty_taxonomy
  for insert
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor');
