// scripts/embed_doctors.mjs
//
// Generates and upserts 768-dimensional Gemini text-embedding-004 vectors
// for every doctor profile in the Supabase `doctors` table.
//
// Each doctor's embedding is built from a structured profile string that
// includes their specialty, sub-specialty, credentials, clinic locations,
// and a plain-language description from the specialtyHelpers lookup.
//
// These vectors enable semantic specialist matching via pgvector cosine
// similarity, complementing the existing taxonomy-based exact filter.
//
// Usage:
//   npm run embed              — embeds all doctors in the database
//   npm run embed -- --dry-run — prints profile strings only; no API calls or writes
//
// Prerequisites:
//   1. Run migration 0010_pgvector_doctor_embeddings.sql in Supabase SQL Editor
//   2. Ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      and GEMINI_API_KEY

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// ─── Configuration ───────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;
const EMBEDDING_MODELS = ['gemini-embedding-001', 'gemini-embedding-2', 'text-embedding-004'];
const EMBEDDING_DIMENSIONS = 768;

// ─── Load environment variables from .env.local ───────────────────────────────
// Pattern from scripts/seed_doctors.js: no dotenv dep, manual parse.

const envText = readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let serviceRoleKey = '';
let geminiApiKey = '';

envText.split(/\r?\n/).forEach((line) => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL='))
    supabaseUrl = line.slice('NEXT_PUBLIC_SUPABASE_URL='.length).trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY='))
    serviceRoleKey = line.slice('SUPABASE_SERVICE_ROLE_KEY='.length).trim();
  if (line.startsWith('GEMINI_API_KEY='))
    geminiApiKey = line.slice('GEMINI_API_KEY='.length).trim();
});

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[embed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!geminiApiKey && !DRY_RUN) {
  console.error('[embed] Missing GEMINI_API_KEY in .env.local');
  process.exit(1);
}

// ─── SPECIALTY_PLAIN_MAP (inlined from src/lib/specialtyHelpers.ts) ───────────
// Dynamic import of a TS source file from a plain .mjs script is unreliable
// without ts-node/esm loaders, so the relevant lookup is copied inline here.
// Keep in sync with src/lib/specialtyHelpers.ts.

const SPECIALTY_PLAIN_MAP = {
  'Anesthesiology': { description: 'Specializes in pain relief and patient care before, during, and after surgeries.' },
  'Cardiology': { description: 'Treats chest pain, high blood pressure, heart rhythm issues, and cardiovascular health.' },
  'Dermatology': { description: 'Helps with rashes, acne, eczema, skin infections, allergies, and suspicious moles.' },
  'Emergency Medicine': { description: 'Provides urgent treatment for sudden, severe illnesses and injuries.' },
  'Endocrinology': { description: 'Manages blood sugar, diabetes, thyroid disorders, and metabolism.' },
  'Family Medicine': { description: 'Comprehensive general health care for patients of all ages, from children to seniors.' },
  'Gastroenterology': { description: 'Treats acid reflux, stomach pain, bowel issues, ulcer, liver, and digestive problems.' },
  'General Practice': { description: 'Primary checkups, common illnesses, cough, fever, and routine medical advice.' },
  'General Surgery': { description: 'Performs surgeries for appendicitis, gallstones, hernias, lumps, and soft tissue.' },
  'Geriatric Medicine': { description: 'Focuses on the unique healthcare needs, mobility, memory, and wellness of elderly adults.' },
  'Hematology': { description: 'Treats anemia, bleeding or clotting disorders, low platelets, and blood conditions.' },
  'Infectious Diseases': { description: 'Diagnoses and treats complex infections, dengue, tuberculosis, fever of unknown origin, and viral illnesses.' },
  'Internal Medicine': { description: 'Expert medical care for chronic and complex illnesses in adults.' },
  'Nephrology': { description: 'Treats kidney stones, chronic kidney disease, swelling, and abnormal urine tests.' },
  'Neurology': { description: 'Helps with frequent headaches, numbness, seizures, stroke recovery, tremors, and nerve pain.' },
  'Neurosurgery': { description: 'Performs surgeries on the brain, spine, spinal cord, and central nervous system.' },
  'Nuclear Medicine': { description: 'Uses specialized safe scans for organ function, bone scans, and thyroid radioactive iodine therapy.' },
  'Obstetrics and Gynecology': { description: 'Care for pregnancy, childbirth, menstruation issues, PCOS, and female reproductive health.' },
  'Occupational Medicine': { description: 'Provides fit-to-work clearances, workplace injury management, and employee health.' },
  'Ophthalmology': { description: 'Treats blurry vision, cataracts, glaucoma, eye redness, eye pain, and vision correction.' },
  'Orthopedics': { description: 'Helps with fractures, arthritis, joint pain, back pain, sports injuries, and spine conditions.' },
  'Otolaryngology': { description: 'Treats hearing problems, ear infections, sinus issues, sore throat, hoarseness, and tonsils.' },
  'Pain Medicine': { description: 'Helps relieve chronic nerve pain, back pain, and long-lasting body discomfort.' },
  'Pathology': { description: 'Analyzes blood tests, biopsies, and tissue samples to accurately identify diseases.' },
  'Pediatrics': { description: 'Comprehensive health care, growth monitoring, immunizations, and illnesses in infants, children, and teens.' },
  'Physical Medicine and Rehabilitation': { description: 'Restores movement, function, and strength after stroke, injuries, surgeries, or chronic pain.' },
  'Plastic Surgery': { description: 'Performs reconstructive surgery for burns, scars, wound repair, and aesthetic enhancements.' },
  'Psychiatry': { description: 'Provides medical evaluation and treatment for anxiety, depression, sleep issues, and mental health.' },
  'Pulmonology': { description: 'Treats asthma, chronic cough, pneumonia, shortness of breath, and lung conditions.' },
  'Radiation Oncology': { description: 'Treats cancer using targeted radiation therapy.' },
  'Radiology': { description: 'Interprets medical imaging such as X-rays, Ultrasounds, CT scans, and MRIs.' },
  'Rheumatology': { description: 'Treats gout, rheumatoid arthritis, joint inflammation, lupus, and autoimmune disorders.' },
  'Urology': { description: 'Treats urinary tract infections, kidney/bladder stones, and prostate health.' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the structured profile string used for embedding a doctor's profile.
 * Must stay in sync with src/lib/vectorMatch.ts buildDoctorProfileString().
 */
function buildProfileString(doctor) {
  const subSpecialtyPart = doctor.sub_specialty
    ? `, sub-specialty: ${doctor.sub_specialty}`
    : '';

  const credentials = doctor.credentials?.trim() || 'Not specified';

  const clinicList = (doctor.clinics ?? [])
    .map((c) => `${c.name} in ${c.location}`)
    .join(', ') || 'Not specified';

  const focusEntry = SPECIALTY_PLAIN_MAP[doctor.specialty];
  const medicalFocus = focusEntry?.description ?? doctor.specialty;

  return [
    `${doctor.name} is a ${doctor.specialty} specialist${subSpecialtyPart}.`,
    `Credentials: ${credentials}.`,
    `Clinic(s): ${clinicList}.`,
    `Medical focus: ${medicalFocus}`,
  ].join(' ');
}

/** Sleep for `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '[embed] DRY RUN — no API calls or writes will happen.\n' : '');

  // Supabase service-role client (bypasses RLS, same as match/route.ts)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Gemini client (not instantiated in dry-run mode)
  const ai = DRY_RUN ? null : new GoogleGenAI({ apiKey: geminiApiKey });

  // Fetch all doctors with their clinic locations
  console.log('[embed] Fetching doctors from Supabase...');
  const { data: doctors, error: fetchError } = await supabase
    .from('doctors')
    .select('id, name, credentials, specialty, sub_specialty, clinics(name, location)');

  if (fetchError) {
    console.error('[embed] Failed to fetch doctors:', fetchError.message);
    process.exit(1);
  }

  const total = doctors.length;
  console.log(`[embed] Found ${total} doctors. Processing in batches of ${BATCH_SIZE}...\n`);

  let embeddedCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = doctors.slice(batchStart, batchStart + BATCH_SIZE);

    for (let i = 0; i < batch.length; i++) {
      const doctor = batch[i];
      const globalIndex = batchStart + i + 1;
      const profileString = buildProfileString(doctor);

      console.log(`[embed] Doctor ${globalIndex}/${total}: ${doctor.name}`);

      if (DRY_RUN) {
        console.log(`  Profile string:\n  "${profileString}"\n`);
        embeddedCount++;
        continue;
      }

      try {
        let vector = null;
        let lastEmbedError = null;

        for (const model of EMBEDDING_MODELS) {
          try {
            const response = await ai.models.embedContent({
              model,
              contents: profileString,
              config: {
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: EMBEDDING_DIMENSIONS,
              },
            });

            const vals = response.embeddings?.[0]?.values;
            if (vals && vals.length === EMBEDDING_DIMENSIONS) {
              vector = vals;
              break;
            }
          } catch (err) {
            lastEmbedError = err;
          }
        }

        if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Failed to generate ${EMBEDDING_DIMENSIONS}-dim embedding with available models: ${lastEmbedError?.message ?? 'no values'}`
          );
        }

        // Upsert embedding back to the doctors table
        const { error: updateError } = await supabase
          .from('doctors')
          .update({ embedding: vector })
          .eq('id', doctor.id);

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        embeddedCount++;
      } catch (err) {
        failedCount++;
        console.error(
          `  [embed] FAILED for doctor ${doctor.id} (${doctor.name}): ${err.message}`
        );
        // Continue to next doctor — never abort the whole run for a single failure
      }
    }

    // Rate-limit pause between batches (skip after the last batch)
    if (batchStart + BATCH_SIZE < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`[embed] Dry run complete. Reviewed ${embeddedCount} doctor profile strings.`);
  } else {
    console.log(`[embed] Done. Embedded ${embeddedCount} doctors.`);
    if (failedCount > 0) {
      console.warn(`[embed] ${failedCount} doctors failed — check errors above and re-run to retry.`);
    }
  }
}

main().catch((err) => {
  console.error('[embed] Unexpected fatal error:', err);
  process.exit(1);
});
