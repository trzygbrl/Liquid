-- =============================================================
-- 0012_enrich_ent_taxonomy.sql
-- Civic Access (Team Liquid)
--
-- PURPOSE:
-- 1. Enrich "Ears, Nose, & Throat" with comprehensive ENT subspecialties
--    (Otology, Audiology, Rhinology, Laryngology, Head & Neck Surgery,
--    Pediatric Otolaryngology).
-- 2. Allow nullable (NULL) sub_specialty rows for all specialties in
--    specialty_taxonomy to represent general consultations / non-subspecialty
--    referrals without forcing inaccurate subspecialty classification.
-- 3. Rebalance demo ENT doctor subspecialties (Otology, Rhinology, Laryngology).
-- =============================================================

-- 1. Add ENT subspecialties to specialty_taxonomy
INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
VALUES
  ('Ears, Nose, & Throat', 'Otology'),
  ('Ears, Nose, & Throat', 'Audiology'),
  ('Ears, Nose, & Throat', 'Rhinology'),
  ('Ears, Nose, & Throat', 'Laryngology'),
  ('Ears, Nose, & Throat', 'Head & Neck Surgery'),
  ('Ears, Nose, & Throat', 'Pediatric Otolaryngology')
ON CONFLICT (specialty, sub_specialty) DO NOTHING;

-- 2. Add NULL sub_specialty rows to allow general practice / general referrals across specialties
INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
VALUES
  ('General Medicine', NULL),
  ('General Practice', NULL),
  ('Ears, Nose, & Throat', NULL),
  ('Dentistry', NULL),
  ('Child Care & Pediatrics', NULL),
  ('Elderly Care & Geriatrics', NULL),
  ('Terminal Care & Hospice', NULL),
  ('OB-GYN & Women''s Health', NULL),
  ('Diabetes & Endocrinology', NULL),
  ('Eye, Vision, & Ophthalmology', NULL),
  ('Heart & Cardiology', NULL),
  ('Skin & Dermatology', NULL),
  ('Lung, Chest, & Pulmonology', NULL),
  ('Stomach, Digestion, & Gastroenterology', NULL),
  ('Hearing & Otolaryngology', NULL),
  ('Kidney, Urine, & Nephrology', NULL),
  ('Liver, Pancreas, & Hepatology', NULL),
  ('Colon, Rectum, & Proctology', NULL),
  ('Brain, Nerves, & Neurology', NULL),
  ('Blood & Hematology', NULL),
  ('Imaging & Radiology', NULL),
  ('Bones, Muscles, Joints, & Orthopedics', NULL),
  ('Foot & Podiatry', NULL),
  ('Anesthesiology', NULL),
  ('Surgery', NULL),
  ('Aesthetics', NULL),
  ('Cancer & Oncology', NULL),
  ('Poisoning & Toxicology', NULL),
  ('Physical Therapy', NULL),
  ('Occupational Therapy', NULL),
  ('Diet & Nutrition Therapy', NULL),
  ('Mental Health', NULL),
  ('Alternative Medicine', NULL),
  ('Veterinary', NULL),
  ('Ophthalmology', NULL)
ON CONFLICT (specialty) WHERE sub_specialty IS NULL DO NOTHING;

-- 3. Update existing ENT demo doctors to represent different subspecialties
UPDATE public.doctors
SET sub_specialty = 'Otology',
    credentials = 'PRC Lic. No. 195868 | MD, FPSO-HNS, Fellow in Otology'
WHERE id = '791548e9-77e7-49cd-84be-c195ad04c85a';

UPDATE public.doctors
SET sub_specialty = 'Rhinology',
    credentials = 'PRC Lic. No. 169841 | MD, FPSO-HNS, Fellow in Rhinology'
WHERE id = '9d07d3c1-f80a-4622-bbd1-b3784e817278';
