-- =============================================================
-- seed_ophthalmology.sql
-- Civic Access (Team Liquid). Task 1.4 seed data
--
-- 8 Ophthalmology doctors for the Pampanga demo.
-- Sub-specialties: Retina (x2), Cataract (x2), Glaucoma (x2),
--                  Pediatric Ophthalmology (x2)
--
-- HOW TO RUN
-- ----------
-- Paste this entire file into the Supabase SQL Editor and click Run.
-- The SQL Editor runs as the postgres/service role and bypasses RLS,
-- so it can insert into auth.users and public.doctors without hitting
-- the "doctors_insert_own" policy (which requires auth.uid() = id).
--
-- Demo logins created:
--   doctor+reyes@civicaccess.demo      / DemoPass2024!
--   doctor+dela-cruz@civicaccess.demo  / DemoPass2024!
--   doctor+santos@civicaccess.demo     / DemoPass2024!
--   doctor+garcia@civicaccess.demo     / DemoPass2024!
--   doctor+mendoza@civicaccess.demo    / DemoPass2024!
--   doctor+lim@civicaccess.demo        / DemoPass2024!
--   doctor+tan@civicaccess.demo        / DemoPass2024!
--   doctor+aquino@civicaccess.demo     / DemoPass2024!
--
-- Run order (enforced by FKs):
--   1. auth.users          (doctors FK into this)
--   2. specialty_taxonomy  (composite FK on doctors)
--   3. specialties         (single-col FK added by migration 0003)
--   4. doctors
--   5. clinics             (schedule_slots FK into this)
--   6. schedule_slots
-- =============================================================

DO $$
DECLARE
  -- Doctor UUIDs (same value used in auth.users AND doctors.id)
  d1  uuid := '11111111-0001-0001-0001-000000000001';
  d2  uuid := '11111111-0002-0002-0002-000000000002';
  d3  uuid := '11111111-0003-0003-0003-000000000003';
  d4  uuid := '11111111-0004-0004-0004-000000000004';
  d5  uuid := '11111111-0005-0005-0005-000000000005';
  d6  uuid := '11111111-0006-0006-0006-000000000006';
  d7  uuid := '11111111-0007-0007-0007-000000000007';
  d8  uuid := '11111111-0008-0008-0008-000000000008';

  -- Clinic UUIDs
  c1  uuid := '22222222-0001-0001-0001-000000000001';
  c2  uuid := '22222222-0002-0002-0002-000000000002';
  c3  uuid := '22222222-0003-0003-0003-000000000003';
  c4  uuid := '22222222-0004-0004-0004-000000000004';
  c5  uuid := '22222222-0005-0005-0005-000000000005';
  c6  uuid := '22222222-0006-0006-0006-000000000006';
  c7  uuid := '22222222-0007-0007-0007-000000000007';
  c8  uuid := '22222222-0008-0008-0008-000000000008';

  -- Password hash computed at runtime using pgcrypto (already enabled).
  -- All 8 demo accounts share the same password: DemoPass2024!
  demo_pw text;

BEGIN

  demo_pw := crypt('DemoPass2024!', gen_salt('bf'));

  -- =========================================================
  -- 1. auth.users
  --    email_confirmed_at = now() automatically sets confirmed_at
  --    so these accounts can log in immediately with GoTrue.
  -- =========================================================
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_user_meta_data,
    raw_app_meta_data,
    is_sso_user,
    created_at,
    updated_at
  ) VALUES
    (d1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+reyes@civicaccess.demo',      demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+dela-cruz@civicaccess.demo',  demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+santos@civicaccess.demo',     demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+garcia@civicaccess.demo',     demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+mendoza@civicaccess.demo',    demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+lim@civicaccess.demo',        demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d7, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+tan@civicaccess.demo',        demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (d8, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'doctor+aquino@civicaccess.demo',     demo_pw, now(), now(),
     '{"role":"doctor"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();

  -- =========================================================
  -- 1b. auth.identities
  --    In Supabase GoTrue, id is UUID and provider_id is TEXT (user_id::text).
  -- =========================================================
  DELETE FROM auth.identities WHERE user_id IN (d1, d2, d3, d4, d5, d6, d7, d8);

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    (d1, d1, jsonb_build_object('sub', d1::text, 'email', 'doctor+reyes@civicaccess.demo', 'email_verified', true), 'email', d1::text, now(), now(), now()),
    (d2, d2, jsonb_build_object('sub', d2::text, 'email', 'doctor+dela-cruz@civicaccess.demo', 'email_verified', true), 'email', d2::text, now(), now(), now()),
    (d3, d3, jsonb_build_object('sub', d3::text, 'email', 'doctor+santos@civicaccess.demo', 'email_verified', true), 'email', d3::text, now(), now(), now()),
    (d4, d4, jsonb_build_object('sub', d4::text, 'email', 'doctor+garcia@civicaccess.demo', 'email_verified', true), 'email', d4::text, now(), now(), now()),
    (d5, d5, jsonb_build_object('sub', d5::text, 'email', 'doctor+mendoza@civicaccess.demo', 'email_verified', true), 'email', d5::text, now(), now(), now()),
    (d6, d6, jsonb_build_object('sub', d6::text, 'email', 'doctor+lim@civicaccess.demo', 'email_verified', true), 'email', d6::text, now(), now(), now()),
    (d7, d7, jsonb_build_object('sub', d7::text, 'email', 'doctor+tan@civicaccess.demo', 'email_verified', true), 'email', d7::text, now(), now(), now()),
    (d8, d8, jsonb_build_object('sub', d8::text, 'email', 'doctor+aquino@civicaccess.demo', 'email_verified', true), 'email', d8::text, now(), now(), now());

  -- =========================================================
  -- 2. specialty_taxonomy
  --    Ophthalmology sub-specialty pairs. ON CONFLICT means
  --    re-running this script is safe.
  -- =========================================================
  INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
  VALUES
    ('Ophthalmology', 'Retina'),
    ('Ophthalmology', 'Cataract'),
    ('Ophthalmology', 'Glaucoma'),
    ('Ophthalmology', 'Pediatric Ophthalmology')
  ON CONFLICT (specialty, sub_specialty) DO NOTHING;

  -- =========================================================
  -- 3. specialties
  --    Single-column lookup table added by migration 0003.
  --    The migration backfills from specialty_taxonomy, but an
  --    explicit insert here makes the script self-contained.
  -- =========================================================
  INSERT INTO public.specialties (specialty)
  VALUES ('Ophthalmology')
  ON CONFLICT (specialty) DO NOTHING;

  -- =========================================================
  -- 4. doctors
  -- =========================================================
  INSERT INTO public.doctors (
    id, name, credentials,
    specialty, sub_specialty,
    hmo_accreditations, verified
  )
  VALUES
    -- Retina ------------------------------------------------
    (d1,
     'Dr. Maria Luisa Reyes',
     'PRC Lic. No. 0123456 | MD, University of Santo Tomas (2010) | '
     'Fellow, Philippine Academy of Ophthalmology | '
     'Vitreoretinal Fellowship, Asian Eye Institute | 14 yrs experience',
     'Ophthalmology', 'Retina',
     ARRAY['Maxicare', 'Medicard', 'Intellicare'],
     true),

    (d2,
     'Dr. Jose Antonio Dela Cruz',
     'PRC Lic. No. 0234567 | MD, Far Eastern University-NRMF (2015) | '
     'Fellow, Vitreo-Retina Society of the Philippines | 9 yrs experience',
     'Ophthalmology', 'Retina',
     ARRAY['Maxicare', 'PhilCare'],
     true),

    -- Cataract -----------------------------------------------
    (d3,
     'Dr. Ana Corazon Santos',
     'PRC Lic. No. 0345678 | MD, University of the Philippines-Manila (2007) | '
     'Diplomate, Philippine Board of Ophthalmology | '
     'Phacoemulsification Training, Aravind Eye Hospital (India) | 17 yrs experience',
     'Ophthalmology', 'Cataract',
     ARRAY['Medicard', 'PhilCare', 'Intellicare'],
     true),

    (d4,
     'Dr. Ramon Emmanuel Garcia',
     'PRC Lic. No. 0456789 | MD, Ateneo School of Medicine and Public Health (2013) | '
     'Fellow, Philippine Academy of Ophthalmology | '
     'Anterior Segment Surgery Training, Singapore National Eye Centre | 11 yrs experience',
     'Ophthalmology', 'Cataract',
     ARRAY['Maxicare', 'Medicard'],
     true),

    -- Glaucoma -----------------------------------------------
    (d5,
     'Dr. Fe Consolacion Mendoza',
     'PRC Lic. No. 0567890 | MD, De La Salle Medical and Health Sciences Institute (2011) | '
     'Fellow, Glaucoma Society of the Philippines | 13 yrs experience',
     'Ophthalmology', 'Glaucoma',
     ARRAY['Intellicare', 'PhilCare'],
     true),

    (d6,
     'Dr. Benjamin Patrick Lim',
     'PRC Lic. No. 0678901 | MD, Cebu Institute of Medicine (2016) | '
     'Diplomate, Philippine Board of Ophthalmology | '
     'Glaucoma Fellowship, Institut Curie Paris (France) | 8 yrs experience',
     'Ophthalmology', 'Glaucoma',
     ARRAY['Maxicare', 'Medicard', 'PhilCare'],
     true),

    -- Pediatric Ophthalmology --------------------------------
    (d7,
     'Dr. Rosario Milagros Tan',
     'PRC Lic. No. 0789012 | MD, University of Santo Tomas (2008) | '
     'Fellow, Philippine Society of Pediatric Ophthalmology and Strabismus | '
     'Pediatric Ophthalmology Fellowship, Childrens Hospital Los Angeles | 16 yrs experience',
     'Ophthalmology', 'Pediatric Ophthalmology',
     ARRAY['Maxicare', 'Intellicare'],
     true),

    (d8,
     'Dr. Leonardo Cruz Aquino',
     'PRC Lic. No. 0890123 | MD, University of the East-Ramon Magsaysay Memorial Medical Center (2017) | '
     'Fellow, Philippine Academy of Ophthalmology | 7 yrs experience',
     'Ophthalmology', 'Pediatric Ophthalmology',
     ARRAY['Medicard', 'PhilCare', 'Intellicare'],
     true)

  ON CONFLICT (id) DO NOTHING;

  -- =========================================================
  -- 5. clinics. one per doctor, all in Pampanga
  -- =========================================================
  INSERT INTO public.clinics (id, doctor_id, name, room_details, location, consultation_fee)
  VALUES
    (c1, d1,
     'Angeles Medical Eye Center',
     'Room 302, 3rd Floor',
     'Holy Family Hospital, McArthur Highway, Angeles City, Pampanga',
     1200.00),

    (c2, d2,
     'Pampanga Retina and Eye Specialists',
     'Suite 104, Ground Floor',
     'Pampanga Doctors Hospital, 12 Oliva Street, San Fernando City, Pampanga',
     1000.00),

    (c3, d3,
     'ClaroVis Ophthalmology Clinic',
     'Room 207, 2nd Floor',
     'Sacred Heart Medical Center, Don Juico Avenue, Angeles City, Pampanga',
     1500.00),

    (c4, d4,
     'Eagle Eye Surgical and Laser Center',
     'Unit 3B, Medical Arts Building',
     'Ospital ning Angeles, Sto. Rosario Street, Angeles City, Pampanga',
     1100.00),

    (c5, d5,
     'San Fernando Eye and Glaucoma Institute',
     'Room 110, 1st Floor',
     'Metro Clark Medical Center, M.A. Roxas Highway, Clark Freeport Zone, Pampanga',
     1300.00),

    (c6, d6,
     'InVision Glaucoma Clinic',
     'Suite 205, Medical Plaza',
     'Jose B. Lingad Memorial Regional Hospital, San Fernando City, Pampanga',
     900.00),

    (c7, d7,
     'Little Eyes Pediatric Ophthalmology Center',
     'Room 401, 4th Floor',
     'Angeles University Medical Center, MacArthur Highway, Angeles City, Pampanga',
     1200.00),

    (c8, d8,
     'Kapampangan Childrens Eye Clinic',
     'Room 101, Ground Floor',
     'Pampanga Adventist Hospital, Magalang Road, San Fernando City, Pampanga',
     850.00)

  ON CONFLICT (id) DO NOTHING;

  -- =========================================================
  -- 6. schedule_slots. 3-4 available slots per doctor
  --    Spread across Aug 19 to Sep 1 2026 (the demo window).
  --    is_booked defaults to 'available'; no need to set it.
  -- =========================================================
  INSERT INTO public.schedule_slots (doctor_id, clinic_id, date, start_time, end_time)
  VALUES
    -- Dr. Reyes (Retina). 4 slots
    (d1, c1, '2026-08-20', '09:00', '09:45'),
    (d1, c1, '2026-08-20', '10:00', '10:45'),
    (d1, c1, '2026-08-25', '14:00', '14:45'),
    (d1, c1, '2026-09-01', '09:00', '09:45'),

    -- Dr. Dela Cruz (Retina). 3 slots
    (d2, c2, '2026-08-21', '08:00', '08:45'),
    (d2, c2, '2026-08-21', '09:00', '09:45'),
    (d2, c2, '2026-08-27', '13:00', '13:45'),

    -- Dr. Santos (Cataract). 4 slots
    (d3, c3, '2026-08-19', '10:00', '10:45'),
    (d3, c3, '2026-08-22', '14:00', '14:45'),
    (d3, c3, '2026-08-26', '10:00', '10:45'),
    (d3, c3, '2026-08-29', '09:00', '09:45'),

    -- Dr. Garcia (Cataract). 3 slots
    (d4, c4, '2026-08-20', '13:00', '13:45'),
    (d4, c4, '2026-08-23', '09:00', '09:45'),
    (d4, c4, '2026-08-28', '14:00', '14:45'),

    -- Dr. Mendoza (Glaucoma). 4 slots
    (d5, c5, '2026-08-19', '08:00', '08:45'),
    (d5, c5, '2026-08-24', '10:00', '10:45'),
    (d5, c5, '2026-08-27', '08:00', '08:45'),
    (d5, c5, '2026-08-31', '13:00', '13:45'),

    -- Dr. Lim (Glaucoma). 3 slots
    (d6, c6, '2026-08-21', '13:00', '13:45'),
    (d6, c6, '2026-08-25', '09:00', '09:45'),
    (d6, c6, '2026-08-29', '14:00', '14:45'),

    -- Dr. Tan (Pediatric Ophthalmology). 4 slots
    (d7, c7, '2026-08-19', '09:00', '09:45'),
    (d7, c7, '2026-08-22', '10:00', '10:45'),
    (d7, c7, '2026-08-26', '09:00', '09:45'),
    (d7, c7, '2026-09-01', '13:00', '13:45'),

    -- Dr. Aquino (Pediatric Ophthalmology). 3 slots
    (d8, c8, '2026-08-20', '08:00', '08:45'),
    (d8, c8, '2026-08-24', '13:00', '13:45'),
    (d8, c8, '2026-08-28', '09:00', '09:45');

END $$;
