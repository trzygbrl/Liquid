import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------
// deterministic PRNG (mulberry32)
// ---------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260818);

function randomUUID() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rand() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pad = (n) => String(n).padStart(2, '0');

const ROSTER = [
  ['General Medicine', 10, []],
  ['Child Care & Pediatrics', 8, ['Sick & Premature Newborns', 'Pediatric Pulmonology', 'Adolescent Medicine']],
  ['Elderly Care & Geriatrics', 7, ['Geriatric Cardiology', 'Geriatric Rheumatology', 'Palliative Geriatrics']],
  ['Terminal Care & Hospice', 5, ['Palliative Care', 'Pediatric Hospice', 'Adult Hospice Care']],
  ['OB-GYN & Women\'s Health', 8, ['Maternal-Fetal Medicine', 'Reproductive Endocrinology & Infertility', 'Urogynecology']],
  ['Diabetes & Endocrinology', 6, ['Diabetology', 'Thyroidology', 'Lipidology']],
  ['Eye, Vision, & Ophthalmology', 5, ['Cornea & External Disease', 'Glaucoma', 'Retina & Vitreous']],
  ['Heart & Cardiology', 8, ['Interventional Cardiology', 'Electrophysiology', 'Heart Failure & Transplant Cardiology', 'Echocardiography']],
  ['Skin & Dermatology', 7, ['Dermatopathology', 'Cosmetic Dermatology', 'Mohs Micrographic Surgery']],
  ['Lung, Chest, & Pulmonology', 9, ['Interventional Pulmonology', 'Cystic Fibrosis', 'Lung Transplantation']],
  ['Stomach, Digestion, & Gastroenterology', 7, ['Advanced Endoscopy', 'Inflammatory Bowel Disease', 'Neurogastroenterology']],
  ['Ears, Nose, & Throat', 4, ['Laryngology']],
  ['Hearing & Otolaryngology', 3, ['Audiology', 'Otology']],
  ['Kidney, Urine, & Nephrology', 6, ['Transplant Nephrology', 'Interventional Nephrology', 'Dialysis Medicine']],
  ['Liver, Pancreas, & Hepatology', 6, ['Transplant Hepatology', 'Pancreatobiliary Medicine']],
  ['Colon, Rectum, & Proctology', 4, ['Colon & Rectal Surgery', 'Anorectal Surgery', 'Pelvic Floor Disorders']],
  ['Brain, Nerves, & Neurology', 6, ['Epilepsy', 'Neuromuscular Medicine', 'Movement Disorders', 'Neurocritical Care']],
  ['Blood & Hematology', 3, ['Coagulation', 'Hematologic Malignancies', 'Transfusion Medicine']],
  ['Imaging & Radiology', 5, ['Diagnostic Radiology', 'Interventional Radiology']],
  ['Bones, Muscles, Joints, & Orthopedics', 6, ['Sports Medicine', 'Orthopedic Surgery', 'Orthopedic Oncology', 'Hand Surgery']],
  ['Dentistry', 9, ['Orthodontics', 'Periodontics', 'Endodontics', 'Oral & Maxillofacial Surgery', 'Pediatric Dentistry']],
  ['Foot & Podiatry', 4, ['Podiatric Surgery', 'Sports Podiatry', 'Diabetic Foot Care', 'Pediatric Podiatry']],
  ['Anesthesiology', 10, ['Pain Medicine', 'Cardiothoracic Anesthesiology', 'Obstetric Anesthesiology']],
  ['Surgery', 10, ['General Surgery', 'Cardiothoracic Surgery', 'Neurosurgery', 'Plastic Surgery', 'Pediatric Surgery']],
  ['Aesthetics', 3, ['Cosmetic Surgery', 'Aesthetic Medicine', 'Facial Rejuvenation']],
  ['Cancer & Oncology', 5, ['Medical Oncology', 'Surgical Oncology', 'Radiation Oncology', 'Pediatric Oncology']],
  ['Poisoning & Toxicology', 4, ['Medical Toxicology', 'Clinical Toxicology', 'Forensic Toxicology', 'Environmental Toxicology']],
  ['Physical Therapy', 6, ['Orthopedic Physical Therapy', 'Neurological Rehabilitation', 'Pediatric Physical Therapy', 'Sports Physical Therapy']],
  ['Occupational Therapy', 4, ['Hand Therapy', 'Pediatric Occupational Therapy', 'Geriatric Occupational Therapy', 'Neurorehabilitation']],
  ['Diet & Nutrition Therapy', 6, ['Clinical Dietetics', 'Sports Nutrition']],
  ['Mental Health', 10, ['Addiction Psychiatry', 'Forensic Psychiatry', 'Clinical Psychology']],
  ['Alternative Medicine', 3, ['Acupuncture', 'Chiropractic', 'Herbal Medicine']],
  ['Veterinary', 5, ['Veterinary Surgery', 'Veterinary Internal Medicine', 'Veterinary Oncology', 'Veterinary Dermatology']],
];

const SPECIALTY_META = {
  'General Medicine': { degree: 'MD', board: 'FPAFP', fee: [350, 650], niche: false },
  'Child Care & Pediatrics': { degree: 'MD', board: 'FPPS', fee: [600, 1000], niche: false },
  'Elderly Care & Geriatrics': { degree: 'MD', board: 'FPCP', fee: [800, 1400], niche: true },
  'Terminal Care & Hospice': { degree: 'MD', board: 'FPCP', fee: [700, 1200], niche: true },
  'OB-GYN & Women\'s Health': { degree: 'MD', board: 'FPOGS', fee: [800, 1400], niche: false },
  'Diabetes & Endocrinology': { degree: 'MD', board: 'FPCP', fee: [900, 1500], niche: false },
  'Eye, Vision, & Ophthalmology': { degree: 'MD', board: 'FPAO', fee: [700, 1300], niche: false },
  'Heart & Cardiology': { degree: 'MD', board: 'FPCC', fee: [1300, 2400], niche: true },
  'Skin & Dermatology': { degree: 'MD', board: 'FPDS', fee: [900, 1700], niche: true },
  'Lung, Chest, & Pulmonology': { degree: 'MD', board: 'FPCCP', fee: [1000, 1800], niche: true },
  'Stomach, Digestion, & Gastroenterology': { degree: 'MD', board: 'FPSG', fee: [1100, 1900], niche: true },
  'Ears, Nose, & Throat': { degree: 'MD', board: 'FPSO-HNS', fee: [700, 1300], niche: false },
  'Hearing & Otolaryngology': { degree: 'MD', board: 'FPSO-HNS', fee: [800, 1400], niche: true },
  'Kidney, Urine, & Nephrology': { degree: 'MD', board: 'FPSN', fee: [1200, 2000], niche: true },
  'Liver, Pancreas, & Hepatology': { degree: 'MD', board: 'FPSG', fee: [1400, 2300], niche: true },
  'Colon, Rectum, & Proctology': { degree: 'MD', board: 'FPCS', fee: [1300, 2100], niche: true },
  'Brain, Nerves, & Neurology': { degree: 'MD', board: 'FPNA', fee: [1300, 2300], niche: true },
  'Blood & Hematology': { degree: 'MD', board: 'FPSHBT', fee: [1200, 2000], niche: true },
  'Imaging & Radiology': { degree: 'MD', board: 'FPCR', fee: [900, 1700], niche: true },
  'Bones, Muscles, Joints, & Orthopedics': { degree: 'MD', board: 'FPOA', fee: [1300, 2300], niche: true },
  'Dentistry': { degree: 'DMD', board: 'PDA', fee: [500, 1200], niche: true },
  'Foot & Podiatry': { degree: 'DPM', board: 'PPMA', fee: [500, 1000], niche: true },
  'Anesthesiology': { degree: 'MD', board: 'FPBA', fee: [1200, 2000], niche: true },
  'Surgery': { degree: 'MD', board: 'FPCS', fee: [1600, 2500], niche: true },
  'Aesthetics': { degree: 'MD', board: 'PAPRAS', fee: [1600, 2500], niche: true },
  'Cancer & Oncology': { degree: 'MD', board: 'FPSMO', fee: [1600, 2500], niche: true },
  'Poisoning & Toxicology': { degree: 'MD', board: 'FPCP', fee: [1000, 1800], niche: true },
  'Physical Therapy': { degree: 'RPT', board: 'PPTA', fee: [400, 900], niche: false },
  'Occupational Therapy': { degree: 'OTRP', board: null, fee: [400, 900], niche: false },
  'Diet & Nutrition Therapy': { degree: 'RND', board: null, fee: [400, 800], niche: false },
  'Mental Health': { degree: 'MD', board: 'FPPA', fee: [900, 1700], niche: true },
  'Alternative Medicine': { degree: 'MD', board: 'PCAM', fee: [400, 900], niche: true },
  'Veterinary': { degree: 'DVM', board: 'PVMA', fee: [400, 1200], niche: true },
};

const HMOS = ['Maxicare', 'Intellicare', 'Medicard', 'PhilCare'];

const CLINICS = [
  { name: 'Jose B. Lingad Memorial General Hospital', location: 'San Fernando, Pampanga' },
  { name: 'Angeles University Foundation Medical Center', location: 'Angeles City, Pampanga' },
  { name: 'The Medical City Clark', location: 'Clark Freeport Zone, Pampanga' },
  { name: 'Mother Teresa of Calcutta Medical Center', location: 'San Fernando, Pampanga' },
  { name: 'Our Lady of Mt. Carmel Medical Center', location: 'San Fernando, Pampanga' },
  { name: 'Mabalacat Doctors\' Medical Arts Center', location: 'Mabalacat, Pampanga' },
  { name: 'Bacolor Community General Hospital', location: 'Bacolor, Pampanga' },
  { name: 'Guagua District Hospital', location: 'Guagua, Pampanga' },
  { name: 'Magalang Family Care Clinic', location: 'Magalang, Pampanga' },
  { name: 'Apalit Wellness & Diagnostic Center', location: 'Apalit, Pampanga' },
  { name: 'Porac Rural Health & Medical Clinic', location: 'Porac, Pampanga' },
  { name: 'Floridablanca Medical Arts Building', location: 'Floridablanca, Pampanga' },
  { name: 'Tarlac Provincial Specialists Clinic', location: 'Tarlac City, Tarlac' },
  { name: 'Bulacan Central Medical Plaza', location: 'Malolos, Bulacan' },
];

const FIRST_NAMES = [
  'Miguel', 'Clarisse', 'Jose', 'Maria', 'Antonio', 'Isabella', 'Rafael', 'Angelica',
  'Francisco', 'Katrina', 'Eduardo', 'Bianca', 'Ramon', 'Patricia', 'Carlos', 'Denise',
  'Andres', 'Marielle', 'Gabriel', 'Camille', 'Emmanuel', 'Kristine', 'Vicente', 'Alyssa',
  'Nathaniel', 'Josefina', 'Leandro', 'Marianne', 'Renato', 'Charmaine', 'Bernardo', 'Michelle',
  'Alfonso', 'Gemma', 'Roberto', 'Teresa', 'Diego', 'Veronica', 'Julio', 'Cassandra',
  'Marco', 'Erika', 'Paolo', 'Samantha', 'Ignacio', 'Bettina', 'Domingo', 'Elaine',
];
const LAST_NAMES = [
  'Santos', 'Mendoza', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Torres',
  'Del Rosario', 'Villanueva', 'Aquino', 'Fernandez', 'Ramos', 'Castillo', 'Navarro', 'Salazar',
  'Gonzales', 'Pascual', 'Manalo', 'Aguilar', 'Domingo', 'Lim', 'Tan', 'Sarmiento',
  'Ignacio', 'Valdez', 'Roxas', 'Espiritu', 'Dizon', 'Rivera',
];
const usedNames = new Set();
function generateName() {
  let name;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

function generateCredentials(meta, subSpecialty) {
  const licNo = randInt(50000, 199999);
  const parts = [meta.degree];
  if (meta.board) parts.push(meta.board);

  if (subSpecialty) {
    if (meta.niche) {
      parts.push(`Fellow in ${subSpecialty}`);
    } else if (rand() < 0.35) {
      parts.push(`Diplomate in ${subSpecialty}`);
    }
  }

  return `PRC Lic. No. ${licNo} | ${parts.join(', ')}`;
}

// Build doctors + taxonomy
const doctors = [];
const taxonomyPairs = [];
const allSpecialties = new Set();

for (const [specialty, count, subSpecialties] of ROSTER) {
  allSpecialties.add(specialty);
  const meta = SPECIALTY_META[specialty];
  for (let i = 0; i < count; i++) {
    const subSpecialty = subSpecialties.length > 0 ? subSpecialties[i % subSpecialties.length] : null;
    if (subSpecialty) {
      taxonomyPairs.push({ specialty, sub_specialty: subSpecialty });
    }

    doctors.push({
      id: randomUUID(),
      name: `Dr. ${generateName()}`,
      credentials: generateCredentials(meta, subSpecialty),
      specialty,
      sub_specialty: subSpecialty,
      hmo_accreditations: pickN(HMOS, randInt(2, 3)),
      verified: true,
      _meta: meta,
    });
  }
}

// Deduplicate taxonomy pairs
const uniqueTaxonomy = [];
const seenTax = new Set();
for (const item of taxonomyPairs) {
  const key = `${item.specialty}|||${item.sub_specialty}`;
  if (!seenTax.has(key)) {
    seenTax.add(key);
    uniqueTaxonomy.push(item);
  }
}

const clinics = [];
const scheduleSlots = [];

const TODAY = new Date('2026-08-18T00:00:00Z');
const DAY_OFFSETS = Array.from({ length: 14 }, (_, i) => i + 1);
const SESSIONS = [
  { start: 8, end: 12 },
  { start: 13, end: 17 },
];
const SLOT_STATUS_WEIGHTS = [
  ['available', 6],
  ['booked', 3],
  ['doctor_on_leave', 1],
];
function pickSlotStatus() {
  const total = SLOT_STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [status, w] of SLOT_STATUS_WEIGHTS) {
    if (r < w) return status;
    r -= w;
  }
  return 'available';
}

function clinicFee(meta) {
  const [min, max] = meta.fee;
  return Number((Math.round(randInt(min, max) / 50) * 50).toFixed(2));
}

for (const doctor of doctors) {
  const meta = doctor._meta;
  const clinicChoices = pickN(CLINICS, randInt(1, 3));
  const doctorClinics = clinicChoices.map((c) => ({
    id: randomUUID(),
    doctor_id: doctor.id,
    name: c.name,
    room_details: `Room ${randInt(101, 499)}, ${pick(['Medical Arts Building', 'OPD Annex', 'Specialist Wing', 'Outpatient Building'])}`,
    location: c.location,
    consultation_fee: clinicFee(meta),
  }));
  clinics.push(...doctorClinics);

  const dayCount = randInt(3, 4);
  const dayOffsets = pickN(DAY_OFFSETS, dayCount);
  const clinicForDay = [...doctorClinics];
  while (clinicForDay.length < dayCount) clinicForDay.push(pick(doctorClinics));
  pickN(clinicForDay, clinicForDay.length).forEach((clinic, i) => {
    const dayOffset = dayOffsets[i];
    const session = pick(SESSIONS);
    const date = new Date(TODAY);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const dateStr = date.toISOString().slice(0, 10);
    const blockOnLeave = rand() < 0.1;

    for (let minutes = session.start * 60; minutes < session.end * 60; minutes += 30) {
      const endMinutes = minutes + 30;
      const startTime = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
      const endTime = `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}:00`;

      scheduleSlots.push({
        id: randomUUID(),
        doctor_id: doctor.id,
        clinic_id: clinic.id,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        is_booked: blockOnLeave ? 'doctor_on_leave' : pickSlotStatus(),
      });
    }
  });
}

// Clean up _meta from doctors
for (const doc of doctors) {
  delete doc._meta;
}

// Batch helper
async function batchInsert(table, rows, batchSize = 200) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await admin.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting into ${table} (batch ${i}..${i + chunk.length}):`, error);
      throw error;
    }
  }
}

async function runSeed() {
  console.log(`Starting seed: ${doctors.length} doctors, ${clinics.length} clinics, ${scheduleSlots.length} schedule slots.`);

  // 1. Seed specialties
  console.log('1. Seeding specialties...');
  const specialtyRows = Array.from(allSpecialties).map((s) => ({ specialty: s }));
  const { error: specError } = await admin.from('specialties').upsert(specialtyRows, { onConflict: 'specialty' });
  if (specError) console.error('Specialties upsert error:', specError);
  else console.log(`Upserted: Upserted ${specialtyRows.length} specialties`);

  // 2. Seed specialty_taxonomy (only non-null sub_specialty pairs)
  console.log('2. Seeding specialty_taxonomy...');
  for (let i = 0; i < uniqueTaxonomy.length; i += 100) {
    const chunk = uniqueTaxonomy.slice(i, i + 100);
    const { error: taxErr } = await admin.from('specialty_taxonomy').upsert(chunk, { onConflict: 'specialty,sub_specialty' });
    if (taxErr) console.error('Taxonomy upsert error:', taxErr);
  }
  console.log(`Upserted: Upserted ${uniqueTaxonomy.length} taxonomy pairs`);

  // 3. Create Auth Users for each doctor in concurrent batches
  console.log('3. Creating Auth Users for doctors in Supabase...');
  const concurrency = 10;
  for (let i = 0; i < doctors.length; i += concurrency) {
    const chunk = doctors.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (doc) => {
        const email = `doctor+${doc.id.slice(0, 8)}@civicaccess.demo`;
        const { error } = await admin.auth.admin.createUser({
          id: doc.id,
          email,
          password: 'DemoPass2024!',
          email_confirm: true,
          user_metadata: { role: 'doctor' },
        });
        if (error && !error.message.includes('already registered') && !error.message.includes('unique')) {
          console.warn(`Auth user warning for ${doc.name}:`, error.message);
        }
      })
    );
    if ((i + concurrency) % 50 === 0 || i + concurrency >= doctors.length) {
      console.log(`  Created ${Math.min(i + concurrency, doctors.length)} / ${doctors.length} auth accounts`);
    }
  }
  console.log('Done: Auth users created.');

  // 4. Seed Doctors
  console.log('4. Seeding doctors table...');
  await batchInsert('doctors', doctors, 100);
  console.log('Done: Doctors seeded.');

  // 5. Seed Clinics
  console.log('5. Seeding clinics table...');
  await batchInsert('clinics', clinics, 100);
  console.log('Done: Clinics seeded.');

  // 6. Seed Schedule Slots
  console.log('6. Seeding schedule slots table...');
  await batchInsert('schedule_slots', scheduleSlots, 500);
  console.log('Done: Schedule slots seeded.');

  console.log('\n--- VERIFICATION ---');
  const { count: finalDocCount } = await admin.from('doctors').select('*', { count: 'exact', head: true });
  const { count: finalClinicCount } = await admin.from('clinics').select('*', { count: 'exact', head: true });
  const { count: finalSlotCount } = await admin.from('schedule_slots').select('*', { count: 'exact', head: true });
  console.log(`Final Database Counts:
  - Doctors: ${finalDocCount}
  - Clinics: ${finalClinicCount}
  - Schedule Slots: ${finalSlotCount}
`);
}

runSeed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
