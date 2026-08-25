-- =============================================================
-- seed_taxonomy_only.sql
-- Civic Access (Team Liquid). Task 1.4 (taxonomy re-seed)
--
-- PURPOSE
-- -------
-- This is a standalone, re-runnable script that seeds ONLY the
-- specialty lookup tables. It does NOT touch auth.users, doctors,
-- clinics, or schedule_slots. safe to run at any time without
-- side-effects on live user data.
--
-- Use this when:
--   * The database has been wiped and the taxonomy needs to be
--     restored without re-creating the full demo doctor accounts.
--   * A new specialty or sub-specialty needs to be added later.
--
-- The full demo doctor seed (auth.users + doctors + clinics + slots)
-- lives in supabase/seeds/seed_ophthalmology.sql. Run that script
-- separately in the Supabase SQL Editor when you need the 8
-- pre-built Ophthalmology demo accounts.
--
-- HOW TO RUN
-- ----------
-- Paste into Supabase Dashboard to SQL Editor to Run.
-- ON CONFLICT clauses make every INSERT idempotent.
-- =============================================================

-- =========================================================
-- 1. specialty_taxonomy. (specialty, sub_specialty) pairs
--    Used by the profile-setup form's constrained dropdowns
--    and the composite FK on doctors(specialty, sub_specialty).
-- =========================================================
INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
VALUES
  ('Ophthalmology', 'Retina'),
  ('Ophthalmology', 'Cataract'),
  ('Ophthalmology', 'Glaucoma'),
  ('Ophthalmology', 'Pediatric Ophthalmology')
ON CONFLICT (specialty, sub_specialty) DO NOTHING;

-- =========================================================
-- 2. specialties. single-column lookup added by migration 0003
--    Validates doctors.specialty independently of sub_specialty.
--    'General Practice' has no taxonomy rows. it is represented
--    here only, and doctors who pick it submit sub_specialty = NULL.
-- =========================================================
INSERT INTO public.specialties (specialty)
VALUES
  ('Ophthalmology'),
  ('General Practice')
ON CONFLICT (specialty) DO NOTHING;
