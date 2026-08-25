-- =============================================================
-- 0003_nullable_subspecialty.sql
-- Civic Access (Team Liquid). Task 2.1 follow-up
--
-- Why this migration exists
-- --------------------------
-- `doctors.sub_specialty` was originally NOT NULL and part of a composite
-- foreign key  doctors(specialty, sub_specialty) to specialty_taxonomy(specialty, sub_specialty).
-- That worked fine when every doctor had a sub-specialty, but general practitioners
-- (e.g. family medicine, general healthcare specialists) do not. they should submit
-- specialty = 'General Practice' and sub_specialty = NULL.
--
-- Postgres MATCH SIMPLE nuance you must understand before editing this
-- --------------------------
-- The existing composite FK uses Postgres's default MATCH SIMPLE semantics.
-- MATCH SIMPLE says: if ANY column in the composite key is NULL, skip the FK
-- check entirely for that row.  This is the correct and expected Postgres
-- behaviour, but it means a doctor row with sub_specialty = NULL would also
-- have NO validation on specialty. a garbage specialty value would slip
-- through the composite FK unchallenged.
--
-- Fix: a second, independent FK
-- --------------------------
-- Rather than replacing the composite FK (which would weaken validation for
-- doctors WHO DO have a sub-specialty), we add a small lookup table:
--   public.specialties (specialty text primary key)
-- backfill it from specialty_taxonomy, add the 'General Practice' row, and
-- then add a separate FK  doctors.specialty to specialties.specialty.
-- Now BOTH paths are covered:
--   * sub_specialty NOT NULL to composite FK validates the (specialty, sub_specialty) pair
--   * sub_specialty NULL to new single-column FK validates specialty on its own
--
-- Named design decision (for the team to revisit if needed)
-- --------------------------
-- An alternative would be a BEFORE INSERT/UPDATE trigger on doctors that
-- explicitly checks specialty against specialty_taxonomy when sub_specialty IS NULL.
-- The two-FK approach was chosen for the hackathon because it uses pure declarative
-- constraints (easier to reason about, no trigger code to maintain) and has no
-- performance overhead beyond an extra index lookup on insert/update.
--
-- What is NOT changed
-- --------------------------
-- * specialty_taxonomy is unchanged. it still requires both specialty and
--   sub_specialty to be NOT NULL. General-practice doctors simply have no
--   row there; that is intentional per Assumption 3 in the build prompt.
-- * The composite FK doctors(specialty, sub_specialty) to specialty_taxonomy
--   is left untouched. It keeps enforcing valid pairs when sub_specialty is present.
-- * No seed data is changed here. Any future seed rework should include at least
--   one general-practice doctor with sub_specialty = NULL to exercise this path
--   in the demo (TODO: seed rework).
--
-- Applied by: Zin (manually via Supabase SQL Editor. do NOT run supabase db push)
-- =============================================================

-- =========================================================
-- Step 1: Drop the NOT NULL constraint on sub_specialty
-- =========================================================
alter table public.doctors
  alter column sub_specialty drop not null;

-- =========================================================
-- Step 2: Create the specialties lookup table
--
-- This table is the single source of truth for valid specialty
-- values. It is separate from specialty_taxonomy, which tracks
-- (specialty, sub_specialty) *pairs*. not standalone specialties.
-- =========================================================
create table public.specialties (
  specialty text primary key
);

-- RLS: public read; writes only via service-role key (same pattern as specialty_taxonomy)
alter table public.specialties enable row level security;

create policy "specialties_read_all" on public.specialties
  for select using (true);

-- =========================================================
-- Step 3: Backfill specialties from the existing taxonomy
--
-- Every specialty that has sub-specialty entries in the taxonomy
-- is valid, so backfill them all. This must run before the FK
-- below is added, or existing doctors rows would fail the check.
-- =========================================================
insert into public.specialties (specialty)
  select distinct specialty
  from public.specialty_taxonomy
  on conflict (specialty) do nothing;

-- =========================================================
-- Step 4: Insert 'General Practice'
--
-- General practitioners pick this specialty and leave
-- sub_specialty NULL. 'General Practice' has no rows in
-- specialty_taxonomy (per Assumption 3 in the build prompt)
-- so it must be added here explicitly.
-- =========================================================
insert into public.specialties (specialty)
  values ('General Practice')
  on conflict (specialty) do nothing;

-- =========================================================
-- Step 5: Add FK doctors.specialty to specialties.specialty
--
-- This new constraint covers the null-sub_specialty case:
-- when sub_specialty IS NULL, the composite FK to
-- specialty_taxonomy is skipped (MATCH SIMPLE), but this
-- single-column FK still enforces that specialty is a known,
-- valid value.
--
-- Both FKs coexist. Postgres allows this and enforces both
-- independently.
-- =========================================================
alter table public.doctors
  add constraint doctors_specialty_fk
  foreign key (specialty)
  references public.specialties (specialty);
