-- =============================================================
-- fix_auth_identities.sql
-- Civic Access (Team Liquid) — Auth Repair Script
--
-- In this Supabase database version:
--   * auth.identities.id is of type UUID
--   * auth.identities.provider_id is of type TEXT (must equal user_id::text)
--   * auth.users.confirmed_at is a generated column (set email_confirmed_at = now())
--
-- HOW TO RUN:
-- Paste this entire snippet into the Supabase SQL Editor and click "Run".
-- =============================================================

DO $$
DECLARE
  demo_pw text := crypt('DemoPass2024!', gen_salt('bf'));
  d1 uuid := '11111111-0001-0001-0001-000000000001';
  d2 uuid := '11111111-0002-0002-0002-000000000002';
  d3 uuid := '11111111-0003-0003-0003-000000000003';
  d4 uuid := '11111111-0004-0004-0004-000000000004';
  d5 uuid := '11111111-0005-0005-0005-000000000005';
  d6 uuid := '11111111-0006-0006-0006-000000000006';
  d7 uuid := '11111111-0007-0007-0007-000000000007';
  d8 uuid := '11111111-0008-0008-0008-000000000008';
BEGIN
  -- 1. Remove mismatched identities
  DELETE FROM auth.identities WHERE user_id IN (d1, d2, d3, d4, d5, d6, d7, d8);

  -- 2. Update auth.users with full GoTrue fields
  UPDATE auth.users
  SET 
    encrypted_password = demo_pw,
    email_confirmed_at = now(),
    last_sign_in_at = now(),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = '{"role":"doctor"}'::jsonb,
    aud = 'authenticated',
    role = 'authenticated',
    is_sso_user = false
  WHERE id IN (d1, d2, d3, d4, d5, d6, d7, d8);

  -- 3. Re-insert valid auth.identities (id is UUID, provider_id is TEXT)
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

END $$;
