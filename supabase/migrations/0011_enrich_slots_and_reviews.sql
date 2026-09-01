-- ============================================================================
-- 0011_enrich_slots_and_reviews.sql
-- Civic Access / KayApp (Team Liquid)
--
-- Enriches the database with:
-- 1. Sample patient auth users & patient profiles.
-- 2. Dynamic upcoming schedule slots for all verified doctors over the next 30 days.
-- 3. Past completed visits and authentic patient reviews (English, Tagalog, Taglish).
-- ============================================================================

DO $$
DECLARE
  demo_pw text;
  
  -- 10 Deterministic Sample Patient UUIDs
  p1  uuid := '88888888-0001-0001-0001-000000000001';
  p2  uuid := '88888888-0002-0002-0002-000000000002';
  p3  uuid := '88888888-0003-0003-0003-000000000003';
  p4  uuid := '88888888-0004-0004-0004-000000000004';
  p5  uuid := '88888888-0005-0005-0005-000000000005';
  p6  uuid := '88888888-0006-0006-0006-000000000006';
  p7  uuid := '88888888-0007-0007-0007-000000000007';
  p8  uuid := '88888888-0008-0008-0008-000000000008';
  p9  uuid := '88888888-0009-0009-0009-000000000009';
  p10 uuid := '88888888-0010-0010-0010-000000000010';

  pat_ids uuid[] := ARRAY[p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];

  doc RECORD;
  cln RECORD;
  day_offset INT;
  slot_date DATE;
  slot_hour INT;
  start_t TIME;
  end_t TIME;
  status_val public.slot_status;
  rand_val FLOAT;
  dow INT;

  selected_pat_id UUID;
  dummy_clinic_id UUID;
  dummy_slot_id UUID;
  new_appt_id UUID;
  review_count INT;
  rev_idx INT;
  days_ago INT;
  selected_rating SMALLINT;
  selected_comment TEXT;
  selected_symptom TEXT;

  -- Authentic bilingual patient review comments
  review_comments TEXT[] := ARRAY[
    'Sobrang bait at approachable ni Doc! Inexplain niya nang maigi sa amin ang condition ko at naintindihan agad ng family ko.',
    'Very thorough and attentive. Hindi minamadali ang consultation at sinagot lahat ng questions ko tungkol sa lab results.',
    'Smooth at mabilis ang appointment. Tinanggap ang Maxicare card ko nang walang extra charges. Malinis din ang clinic.',
    'Accurate diagnosis! After 3 days ng iniresetang gamot, gumaan agad ang pakiramdam ko. Highly recommended specialist.',
    'Doctor was very professional and on-time. Binigyan din ako ng personalized health and dietary advice para sa recovery.',
    'Magaling mag-explain lalo na sa Tagalog para madaling maintindihan ng senior parent ko. Maraming salamat Doc!',
    'Great bedside manner. Na-relieve ang anxiety ko after explaining the treatment plan clearly. Will definitely book again.',
    'Staff and doctor were very accommodating. Convenient location and on schedule ang consultation.',
    'Very experienced specialist. Na-diagnose agad ang cause ng recurrent symptoms ko with clear follow-up instructions.',
    'Mabilis ang pila at maayos ang schedule management. Recommended lalo na for patients with HMO.'
  ];

  symptom_summaries TEXT[] := ARRAY[
    'Persistent chest discomfort and palpitations during exertion',
    'Severe upper abdominal pain radiating to back with nausea',
    'Chronic lower back pain with stiffness upon waking',
    'Frequent acid reflux and burning sensation after meals',
    'Severe migraines with visual aura and photophobia',
    'Skin rash with severe itching on arms and neck',
    'Recurrent fever with persistent productive cough',
    'Chronic knee pain and joint swelling during movement'
  ];

BEGIN
  demo_pw := crypt('DemoPass2024!', gen_salt('bf'));

  -- ==========================================================================
  -- 1. Create Sample Patient Users in auth.users (to satisfy foreign key)
  -- ==========================================================================
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, created_at, updated_at
  ) VALUES
    (p1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+santos@civicaccess.demo',    demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+delacruz@civicaccess.demo',  demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p3,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+reyes@civicaccess.demo',     demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p4,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+dizon@civicaccess.demo',     demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p5,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+bautista@civicaccess.demo',  demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p6,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+gonzales@civicaccess.demo',  demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p7,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+ocampo@civicaccess.demo',    demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p8,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+rivera@civicaccess.demo',    demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p9,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+fernandez@civicaccess.demo', demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now()),
    (p10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient+manalo@civicaccess.demo',    demo_pw, now(), now(), '{"role":"patient"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ==========================================================================
  -- 2. Create Patient Profiles in public.patients
  -- ==========================================================================
  INSERT INTO public.patients (id, name, age, sex, location, hmo_provider)
  VALUES
    (p1,  'Maria Cristina Santos', 34, 'female', 'Angeles City, Pampanga', 'Maxicare'),
    (p2,  'Juan Carlos Dela Cruz', 45, 'male', 'San Fernando City, Pampanga', 'Medicard'),
    (p3,  'Carmela Joy Reyes', 28, 'female', 'Malolos City, Bulacan', 'Intellicare'),
    (p4,  'Roberto Dizon Jr.', 58, 'male', 'Guagua, Pampanga', 'PhilCare'),
    (p5,  'Liza Bautista-Tan', 41, 'female', 'Mabalacat City, Pampanga', 'Maxicare'),
    (p6,  'Mark Kenneth Gonzales', 24, 'male', 'Tarlac City, Tarlac', NULL),
    (p7,  'Elena Ocampo', 67, 'female', 'Meycauayan City, Bulacan', 'Medicard'),
    (p8,  'Patricia Marie Rivera', 31, 'female', 'Clark, Pampanga', 'Intellicare'),
    (p9,  'Gabriel Fernandez', 52, 'male', 'Baliwag, Bulacan', 'Maxicare'),
    (p10, 'Arlene Manalo', 39, 'female', 'San Jose del Monte City, Bulacan', 'PhilCare')
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      location = EXCLUDED.location,
      hmo_provider = EXCLUDED.hmo_provider;

  -- ==========================================================================
  -- 3. Generate Dynamic Upcoming Schedule Slots (Next 30 Days)
  -- ==========================================================================
  FOR doc IN 
    SELECT id FROM public.doctors WHERE verification_status = 'verified' 
  LOOP
    FOR cln IN 
      SELECT id FROM public.clinics WHERE doctor_id = doc.id 
    LOOP
      FOR day_offset IN 1..30 LOOP
        slot_date := CURRENT_DATE + day_offset;
        dow := EXTRACT(DOW FROM slot_date); -- 0 = Sun, 6 = Sat

        -- Skip Sundays and half of Saturdays
        IF dow <> 0 AND NOT (dow = 6 AND (day_offset % 2 = 0)) THEN
          
          -- Clinic day assignment
          IF (day_offset % 2 = 0) OR (SELECT count(*) FROM public.clinics WHERE doctor_id = doc.id) = 1 THEN
            
            -- Morning Session: 09:00 AM - 12:00 PM (30-min blocks)
            FOR slot_hour IN 9..11 LOOP
              FOR min_val IN 0..30 BY 30 LOOP
                start_t := (slot_hour || ':' || LPAD(min_val::text, 2, '0') || ':00')::TIME;
                end_t := (start_t + INTERVAL '30 minutes')::TIME;
                
                rand_val := random();
                IF rand_val < 0.70 THEN
                  status_val := 'available';
                ELSIF rand_val < 0.90 THEN
                  status_val := 'booked';
                ELSE
                  status_val := 'doctor_on_leave';
                END IF;

                INSERT INTO public.schedule_slots (id, doctor_id, clinic_id, date, start_time, end_time, is_booked)
                VALUES (gen_random_uuid(), doc.id, cln.id, slot_date, start_t, end_t, status_val)
                ON CONFLICT DO NOTHING;
              END LOOP;
            END LOOP;

            -- Afternoon Session: 01:30 PM - 05:00 PM (30-min blocks)
            FOR slot_hour IN 13..16 LOOP
              FOR min_val IN 0..30 BY 30 LOOP
                start_t := ((slot_hour || ':' || LPAD(min_val::text, 2, '0') || ':00')::TIME) + INTERVAL '30 minutes';
                end_t := (start_t + INTERVAL '30 minutes')::TIME;
                
                rand_val := random();
                IF rand_val < 0.75 THEN
                  status_val := 'available';
                ELSIF rand_val < 0.93 THEN
                  status_val := 'booked';
                ELSE
                  status_val := 'doctor_on_leave';
                END IF;

                INSERT INTO public.schedule_slots (id, doctor_id, clinic_id, date, start_time, end_time, is_booked)
                VALUES (gen_random_uuid(), doc.id, cln.id, slot_date, start_t, end_t, status_val)
                ON CONFLICT DO NOTHING;
              END LOOP;
            END LOOP;

          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ==========================================================================
  -- 4. Generate Past Completed Visits & Verified Reviews
  -- ==========================================================================
  FOR doc IN 
    SELECT id FROM public.doctors WHERE verification_status = 'verified' 
  LOOP
    -- Only seed reviews if doctor doesn't have at least 2 reviews yet
    IF (SELECT count(*) FROM public.reviews WHERE doctor_id = doc.id) < 2 THEN
      
      SELECT id INTO dummy_clinic_id 
      FROM public.clinics 
      WHERE doctor_id = doc.id 
      LIMIT 1;

      IF dummy_clinic_id IS NOT NULL THEN
        review_count := 3 + floor(random() * 5)::INT; -- 3 to 7 reviews
        
        FOR rev_idx IN 1..review_count LOOP
          days_ago := (rev_idx * 4) + floor(random() * 3)::INT;
          selected_pat_id := pat_ids[1 + floor(random() * array_length(pat_ids, 1))::INT];
          selected_symptom := symptom_summaries[1 + floor(random() * array_length(symptom_summaries, 1))::INT];
          selected_comment := review_comments[1 + floor(random() * array_length(review_comments, 1))::INT];
          
          IF random() < 0.85 THEN
            selected_rating := 5;
          ELSIF random() < 0.96 THEN
            selected_rating := 4;
          ELSE
            selected_rating := 3;
          END IF;

          -- 1. Create past schedule slot
          INSERT INTO public.schedule_slots (id, doctor_id, clinic_id, date, start_time, end_time, is_booked, created_at)
          VALUES (
            gen_random_uuid(),
            doc.id,
            dummy_clinic_id,
            CURRENT_DATE - days_ago,
            '10:00:00',
            '10:30:00',
            'booked',
            NOW() - (days_ago || ' days')::INTERVAL
          )
          RETURNING id INTO dummy_slot_id;

          -- 2. Create completed appointment
          INSERT INTO public.appointments (id, patient_id, doctor_id, slot_id, status, symptom_summary, created_at)
          VALUES (
            gen_random_uuid(),
            selected_pat_id,
            doc.id,
            dummy_slot_id,
            'completed',
            selected_symptom,
            NOW() - (days_ago || ' days')::INTERVAL
          )
          RETURNING id INTO new_appt_id;

          -- 3. Attach verified review
          INSERT INTO public.reviews (id, appointment_id, patient_id, doctor_id, rating, comment, created_at)
          VALUES (
            gen_random_uuid(),
            new_appt_id,
            selected_pat_id,
            doc.id,
            selected_rating,
            selected_comment,
            NOW() - (days_ago || ' days')::INTERVAL + INTERVAL '2 hours'
          )
          ON CONFLICT DO NOTHING;

        END LOOP;
      END IF;
    END IF;
  END LOOP;

END $$;
