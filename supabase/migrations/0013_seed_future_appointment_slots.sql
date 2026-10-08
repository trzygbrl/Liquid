-- ============================================================================
-- 0013_seed_future_appointment_slots.sql
-- Civic Access / KayApp (Team Liquid)
--
-- PURPOSE:
-- Generates dynamic appointment schedule slots for all verified doctors
-- across their respective clinics for 2 to 3+ weeks from now (Days 14 to 25).
--
-- FEATURES:
-- - Dynamically computed relative to CURRENT_DATE (always 2-3 weeks ahead).
-- - Realistic Monday-Saturday practice hours (skips Sundays).
-- - Morning (9:00 AM - 12:00 PM) & Afternoon (1:30 PM - 5:00 PM) 30-min slots.
-- - Healthy distribution of 'available' slots (approx 80%) with realistic 'booked' (15%) and 'doctor_on_leave' (5%).
-- - Fully idempotent (checks for existing slot at same date/time/clinic before inserting).
-- ============================================================================

DO $$
DECLARE
  doc RECORD;
  cln RECORD;
  day_offset INT;
  slot_date DATE;
  slot_hour INT;
  min_val INT;
  start_t TIME;
  end_t TIME;
  status_val public.slot_status;
  rand_val FLOAT;
  dow INT;
  total_inserted INT := 0;
BEGIN
  -- Loop through all verified doctors
  FOR doc IN 
    SELECT id, name FROM public.doctors WHERE verification_status = 'verified'
  LOOP
    -- Loop through each clinic belonging to this doctor
    FOR cln IN 
      SELECT id, name FROM public.clinics WHERE doctor_id = doc.id
    LOOP
      -- Generate slots for 2 to 3 weeks ahead (Day +14 to Day +25 from today)
      FOR day_offset IN 14..25 LOOP
        slot_date := CURRENT_DATE + (day_offset || ' days')::INTERVAL;
        dow := EXTRACT(DOW FROM slot_date); -- 0 = Sunday, 6 = Saturday

        -- Skip Sundays
        IF dow <> 0 THEN
          
          -- Distribute practice days across clinics if doctor has multiple clinics
          IF (day_offset % 2 = 0) OR (SELECT count(*) FROM public.clinics WHERE doctor_id = doc.id) = 1 THEN
            
            -- ================================================================
            -- Morning Session: 09:00 AM - 12:00 PM (30-min blocks)
            -- ================================================================
            FOR slot_hour IN 9..11 LOOP
              FOR min_val IN 0..30 BY 30 LOOP
                start_t := (LPAD(slot_hour::text, 2, '0') || ':' || LPAD(min_val::text, 2, '0') || ':00')::TIME;
                end_t := (start_t + INTERVAL '30 minutes')::TIME;
                
                -- Random status distribution (80% available, 15% booked, 5% on leave)
                rand_val := random();
                IF rand_val < 0.80 THEN
                  status_val := 'available';
                ELSIF rand_val < 0.95 THEN
                  status_val := 'booked';
                ELSE
                  status_val := 'doctor_on_leave';
                END IF;

                -- Insert slot only if it does not already exist
                IF NOT EXISTS (
                  SELECT 1 FROM public.schedule_slots s
                  WHERE s.doctor_id = doc.id
                    AND s.clinic_id = cln.id
                    AND s.date = slot_date
                    AND s.start_time = start_t
                ) THEN
                  INSERT INTO public.schedule_slots (
                    id, doctor_id, clinic_id, date, start_time, end_time, is_booked
                  ) VALUES (
                    gen_random_uuid(), doc.id, cln.id, slot_date, start_t, end_t, status_val
                  );
                  total_inserted := total_inserted + 1;
                END IF;

              END LOOP;
            END LOOP;

            -- ================================================================
            -- Afternoon Session: 01:30 PM - 05:00 PM (30-min blocks)
            -- ================================================================
            FOR slot_hour IN 13..16 LOOP
              FOR min_val IN 0..30 BY 30 LOOP
                start_t := ((LPAD(slot_hour::text, 2, '0') || ':' || LPAD(min_val::text, 2, '0') || ':00')::TIME) + INTERVAL '30 minutes';
                end_t := (start_t + INTERVAL '30 minutes')::TIME;
                
                rand_val := random();
                IF rand_val < 0.80 THEN
                  status_val := 'available';
                ELSIF rand_val < 0.95 THEN
                  status_val := 'booked';
                ELSE
                  status_val := 'doctor_on_leave';
                END IF;

                IF NOT EXISTS (
                  SELECT 1 FROM public.schedule_slots s
                  WHERE s.doctor_id = doc.id
                    AND s.clinic_id = cln.id
                    AND s.date = slot_date
                    AND s.start_time = start_t
                ) THEN
                  INSERT INTO public.schedule_slots (
                    id, doctor_id, clinic_id, date, start_time, end_time, is_booked
                  ) VALUES (
                    gen_random_uuid(), doc.id, cln.id, slot_date, start_t, end_t, status_val
                  );
                  total_inserted := total_inserted + 1;
                END IF;

              END LOOP;
            END LOOP;

          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully created % future appointment slots (2-3 weeks ahead).', total_inserted;
END $$;
