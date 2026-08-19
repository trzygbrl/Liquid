import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------
// deterministic PRNG (mulberry32) so re-runs are reproducible
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

// deterministic UUIDv4 (RFC 4122 version/variant bits set), driven by `rand`
// so re-running this script with no source changes reproduces identical IDs
// and `ON CONFLICT DO NOTHING` re-seeds stay true no-ops.
function randomUUID() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rand() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
// Sampling without replacement -- also doubles as a full shuffle when n === arr.length.
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pad = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------
// Specialty roster: [specialty, count, [sub_specialties] | [] for none]
// ---------------------------------------------------------------
const ROSTER = [
  ["General Medicine", 10, []],
  ["Child Care & Pediatrics", 8, ["Sick & Premature Newborns", "Pediatric Pulmonology", "Adolescent Medicine"]],
  ["Elderly Care & Geriatrics", 7, ["Geriatric Cardiology", "Geriatric Rheumatology", "Palliative Geriatrics"]],
  ["Terminal Care & Hospice", 5, ["Palliative Care", "Pediatric Hospice", "Adult Hospice Care"]],
  ["OB-GYN & Women's Health", 8, ["Maternal-Fetal Medicine", "Reproductive Endocrinology & Infertility", "Urogynecology"]],
  ["Diabetes & Endocrinology", 6, ["Diabetology", "Thyroidology", "Lipidology"]],
  ["Eye, Vision, & Ophthalmology", 5, ["Cornea & External Disease", "Glaucoma", "Retina & Vitreous"]],
  ["Heart & Cardiology", 8, ["Interventional Cardiology", "Electrophysiology", "Heart Failure & Transplant Cardiology", "Echocardiography"]],
  ["Skin & Dermatology", 7, ["Dermatopathology", "Cosmetic Dermatology", "Mohs Micrographic Surgery"]],
  ["Lung, Chest, & Pulmonology", 9, ["Interventional Pulmonology", "Cystic Fibrosis", "Lung Transplantation"]],
  ["Stomach, Digestion, & Gastroenterology", 7, ["Advanced Endoscopy", "Inflammatory Bowel Disease", "Neurogastroenterology"]],
  ["Ears, Nose, & Throat", 4, ["Laryngology"]],
  ["Hearing & Otolaryngology", 3, ["Audiology", "Otology"]],
  ["Kidney, Urine, & Nephrology", 6, ["Transplant Nephrology", "Interventional Nephrology", "Dialysis Medicine"]],
  ["Liver, Pancreas, & Hepatology", 6, ["Transplant Hepatology", "Pancreatobiliary Medicine"]],
  ["Colon, Rectum, & Proctology", 4, ["Colon & Rectal Surgery", "Anorectal Surgery", "Pelvic Floor Disorders"]],
  ["Brain, Nerves, & Neurology", 6, ["Epilepsy", "Neuromuscular Medicine", "Movement Disorders", "Neurocritical Care"]],
  ["Blood & Hematology", 3, ["Coagulation", "Hematologic Malignancies", "Transfusion Medicine"]],
  ["Imaging & Radiology", 5, ["Diagnostic Radiology", "Interventional Radiology"]],
  ["Bones, Muscles, Joints, & Orthopedics", 6, ["Sports Medicine", "Orthopedic Surgery", "Orthopedic Oncology", "Hand Surgery"]],
  ["Dentistry", 9, ["Orthodontics", "Periodontics", "Endodontics", "Oral & Maxillofacial Surgery", "Pediatric Dentistry"]],
  ["Foot & Podiatry", 4, ["Podiatric Surgery", "Sports Podiatry", "Diabetic Foot Care", "Pediatric Podiatry"]],
  ["Anesthesiology", 10, ["Pain Medicine", "Cardiothoracic Anesthesiology", "Obstetric Anesthesiology"]],
  ["Surgery", 10, ["General Surgery", "Cardiothoracic Surgery", "Neurosurgery", "Plastic Surgery", "Pediatric Surgery"]],
  ["Aesthetics", 3, ["Cosmetic Surgery", "Aesthetic Medicine", "Facial Rejuvenation"]],
  ["Cancer & Oncology", 5, ["Medical Oncology", "Surgical Oncology", "Radiation Oncology", "Pediatric Oncology"]],
  ["Poisoning & Toxicology", 4, ["Medical Toxicology", "Clinical Toxicology", "Forensic Toxicology", "Environmental Toxicology"]],
  ["Physical Therapy", 6, ["Orthopedic Physical Therapy", "Neurological Rehabilitation", "Pediatric Physical Therapy", "Sports Physical Therapy"]],
  ["Occupational Therapy", 4, ["Hand Therapy", "Pediatric Occupational Therapy", "Geriatric Occupational Therapy", "Neurorehabilitation"]],
  ["Diet & Nutrition Therapy", 6, ["Clinical Dietetics", "Sports Nutrition"]],
  ["Mental Health", 10, ["Addiction Psychiatry", "Forensic Psychiatry", "Clinical Psychology"]],
  ["Alternative Medicine", 3, ["Acupuncture", "Chiropractic", "Herbal Medicine"]],
  ["Veterinary", 5, ["Veterinary Surgery", "Veterinary Internal Medicine", "Veterinary Oncology", "Veterinary Dermatology"]],
];

// ---------------------------------------------------------------
// Per-specialty metadata: consultation fee band, primary board/fellow
// credential, professional degree, and whether it's a niche/difficult
// field. Niche specialties get a second, sub-specialty-specific
// fellowship credential layered on top of the base board -- reflecting
// the extra fellowship training those fields actually require -- and
// price toward the top of a higher fee band. Fee bands scale with that
// same complexity, so specialty and cost move together.
// ---------------------------------------------------------------
const SPECIALTY_META = {
  "General Medicine": { degree: "MD", board: "FPAFP", fee: [350, 650], niche: false },
  "Child Care & Pediatrics": { degree: "MD", board: "FPPS", fee: [600, 1000], niche: false },
  "Elderly Care & Geriatrics": { degree: "MD", board: "FPCP", fee: [800, 1400], niche: true },
  "Terminal Care & Hospice": { degree: "MD", board: "FPCP", fee: [700, 1200], niche: true },
  "OB-GYN & Women's Health": { degree: "MD", board: "FPOGS", fee: [800, 1400], niche: false },
  "Diabetes & Endocrinology": { degree: "MD", board: "FPCP", fee: [900, 1500], niche: false },
  "Eye, Vision, & Ophthalmology": { degree: "MD", board: "FPAO", fee: [700, 1300], niche: false },
  "Heart & Cardiology": { degree: "MD", board: "FPCC", fee: [1300, 2400], niche: true },
  "Skin & Dermatology": { degree: "MD", board: "FPDS", fee: [900, 1700], niche: true },
  "Lung, Chest, & Pulmonology": { degree: "MD", board: "FPCCP", fee: [1000, 1800], niche: true },
  "Stomach, Digestion, & Gastroenterology": { degree: "MD", board: "FPSG", fee: [1100, 1900], niche: true },
  "Ears, Nose, & Throat": { degree: "MD", board: "FPSO-HNS", fee: [700, 1300], niche: false },
  "Hearing & Otolaryngology": { degree: "MD", board: "FPSO-HNS", fee: [800, 1400], niche: true },
  "Kidney, Urine, & Nephrology": { degree: "MD", board: "FPSN", fee: [1200, 2000], niche: true },
  "Liver, Pancreas, & Hepatology": { degree: "MD", board: "FPSG", fee: [1400, 2300], niche: true },
  "Colon, Rectum, & Proctology": { degree: "MD", board: "FPCS", fee: [1300, 2100], niche: true },
  "Brain, Nerves, & Neurology": { degree: "MD", board: "FPNA", fee: [1300, 2300], niche: true },
  "Blood & Hematology": { degree: "MD", board: "FPSHBT", fee: [1200, 2000], niche: true },
  "Imaging & Radiology": { degree: "MD", board: "FPCR", fee: [900, 1700], niche: true },
  "Bones, Muscles, Joints, & Orthopedics": { degree: "MD", board: "FPOA", fee: [1300, 2300], niche: true },
  "Dentistry": { degree: "DMD", board: "PDA", fee: [500, 1200], niche: true },
  "Foot & Podiatry": { degree: "DPM", board: "PPMA", fee: [500, 1000], niche: true },
  "Anesthesiology": { degree: "MD", board: "FPBA", fee: [1200, 2000], niche: true },
  "Surgery": { degree: "MD", board: "FPCS", fee: [1600, 2500], niche: true },
  "Aesthetics": { degree: "MD", board: "PAPRAS", fee: [1600, 2500], niche: true },
  "Cancer & Oncology": { degree: "MD", board: "FPSMO", fee: [1600, 2500], niche: true },
  "Poisoning & Toxicology": { degree: "MD", board: "FPCP", fee: [1000, 1800], niche: true },
  "Physical Therapy": { degree: "RPT", board: "PPTA", fee: [400, 900], niche: false },
  "Occupational Therapy": { degree: "OTRP", board: null, fee: [400, 900], niche: false },
  "Diet & Nutrition Therapy": { degree: "RND", board: null, fee: [400, 800], niche: false },
  "Mental Health": { degree: "MD", board: "FPPA", fee: [900, 1700], niche: true },
  "Alternative Medicine": { degree: "MD", board: "PCAM", fee: [400, 900], niche: true },
  "Veterinary": { degree: "DVM", board: "PVMA", fee: [400, 1200], niche: true },
};

const HMOS = ["Maxicare", "Intellicare", "Medicard", "PhilCare"];

const CLINICS = [
  { name: "Jose B. Lingad Memorial General Hospital", location: "San Fernando, Pampanga" },
  { name: "Angeles University Foundation Medical Center", location: "Angeles City, Pampanga" },
  { name: "The Medical City Clark", location: "Clark Freeport Zone, Pampanga" },
  { name: "Mother Teresa of Calcutta Medical Center", location: "San Fernando, Pampanga" },
  { name: "Our Lady of Mt. Carmel Medical Center", location: "San Fernando, Pampanga" },
  { name: "Mabalacat Doctors' Medical Arts Center", location: "Mabalacat, Pampanga" },
  { name: "Bacolor Community General Hospital", location: "Bacolor, Pampanga" },
  { name: "Guagua District Hospital", location: "Guagua, Pampanga" },
  { name: "Magalang Family Care Clinic", location: "Magalang, Pampanga" },
  { name: "Apalit Wellness & Diagnostic Center", location: "Apalit, Pampanga" },
  { name: "Porac Rural Health & Medical Clinic", location: "Porac, Pampanga" },
  { name: "Floridablanca Medical Arts Building", location: "Floridablanca, Pampanga" },
  { name: "Tarlac Provincial Specialists Clinic", location: "Tarlac City, Tarlac" },
  { name: "Bulacan Central Medical Plaza", location: "Malolos, Bulacan" },
];

// ---------------------------------------------------------------
// Filipino name generator
// ---------------------------------------------------------------
const FIRST_NAMES = [
  "Miguel", "Clarisse", "Jose", "Maria", "Antonio", "Isabella", "Rafael", "Angelica",
  "Francisco", "Katrina", "Eduardo", "Bianca", "Ramon", "Patricia", "Carlos", "Denise",
  "Andres", "Marielle", "Gabriel", "Camille", "Emmanuel", "Kristine", "Vicente", "Alyssa",
  "Nathaniel", "Josefina", "Leandro", "Marianne", "Renato", "Charmaine", "Bernardo", "Michelle",
  "Alfonso", "Gemma", "Roberto", "Teresa", "Diego", "Veronica", "Julio", "Cassandra",
  "Marco", "Erika", "Paolo", "Samantha", "Ignacio", "Bettina", "Domingo", "Elaine",
];
const LAST_NAMES = [
  "Santos", "Mendoza", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Torres",
  "Del Rosario", "Villanueva", "Aquino", "Fernandez", "Ramos", "Castillo", "Navarro", "Salazar",
  "Gonzales", "Pascual", "Manalo", "Aguilar", "Domingo", "Lim", "Tan", "Sarmiento",
  "Ignacio", "Valdez", "Roxas", "Espiritu", "Dizon", "Rivera",
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

// Niche/difficult specialties carry the base board credential PLUS a
// sub-specialty fellowship (two lines of training); standard specialties
// usually just carry the base board, occasionally a lighter "diplomate"
// note for their sub-specialty.
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

  return `PRC Lic. No. ${licNo} | ${parts.join(", ")}`;
}

// ---------------------------------------------------------------
// Build doctors + taxonomy
// ---------------------------------------------------------------
const doctors = [];
const taxonomySet = new Set(); // "specialty|||sub_specialty" ("" for null)

for (const [specialty, count, subSpecialties] of ROSTER) {
  const meta = SPECIALTY_META[specialty];
  for (let i = 0; i < count; i++) {
    const subSpecialty = subSpecialties.length > 0 ? subSpecialties[i % subSpecialties.length] : null;
    taxonomySet.add(`${specialty}|||${subSpecialty ?? ""}`);

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

// ---------------------------------------------------------------
// Build clinics (1-3 per doctor, fee aligned to specialty) + schedule_slots
// (3-4 distinct days per doctor, each a single contiguous morning/afternoon
// block of 30-minute slots; every one of the doctor's clinics gets at
// least one of those day-blocks).
// ---------------------------------------------------------------
const clinics = [];
const scheduleSlots = [];

const TODAY = new Date("2026-08-18T00:00:00Z");
const DAY_OFFSETS = Array.from({ length: 14 }, (_, i) => i + 1); // next 2 weeks
const SESSIONS = [
  { start: 8, end: 12 }, // morning: 08:00-12:00
  { start: 13, end: 17 }, // afternoon: 13:00-17:00
];
const SLOT_STATUS_WEIGHTS = [
  ["available", 6],
  ["booked", 3],
  ["doctor_on_leave", 1],
];
function pickSlotStatus() {
  const total = SLOT_STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [status, w] of SLOT_STATUS_WEIGHTS) {
    if (r < w) return status;
    r -= w;
  }
  return "available";
}

function clinicFee(meta) {
  const [min, max] = meta.fee;
  return (Math.round(randInt(min, max) / 50) * 50).toFixed(2);
}

for (const doctor of doctors) {
  const meta = doctor._meta;
  const clinicChoices = pickN(CLINICS, randInt(1, 3));
  const doctorClinics = clinicChoices.map((c) => ({
    id: randomUUID(),
    doctor_id: doctor.id,
    name: c.name,
    room_details: `Room ${randInt(101, 499)}, ${pick(["Medical Arts Building", "OPD Annex", "Specialist Wing", "Outpatient Building"])}`,
    location: c.location,
    consultation_fee: clinicFee(meta),
  }));
  clinics.push(...doctorClinics);

  // 3-4 distinct available days. Every clinic the doctor practices at is
  // guaranteed at least one day-block; any extra days beyond clinic count
  // go to a random clinic.
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

    // Occasionally the doctor is out for the whole day-block rather than
    // half-hour-by-half-hour -- more realistic than independently rolling
    // leave status per slot.
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
        is_booked: blockOnLeave ? "doctor_on_leave" : pickSlotStatus(),
      });
    }
  });
}

// doctors carried a private `_meta` reference for credential/fee
// generation -- strip it before serializing.
for (const doctor of doctors) delete doctor._meta;

// ---------------------------------------------------------------
// Emit PL/pgSQL seed file
// ---------------------------------------------------------------
// One compact JSON object per line (rather than one field per line) --
// keeps the 1500+ records reviewable/diffable without a 14k-line file.
function formatArray(records) {
  return `[\n${records.map((r) => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
}

const seedData = { doctors, clinics, schedule_slots: scheduleSlots };
const jsonLiteral = `{
  "doctors": ${formatArray(doctors)},
  "clinics": ${formatArray(clinics)},
  "schedule_slots": ${formatArray(scheduleSlots)}
}`.replace(/'/g, "''");

const sql = `-- =========================================================
-- supabase/seed.sql
-- Task 1.4: PL/pgSQL JSON Seeder for Team Liquid
--
-- Generated by scripts/gen_seed.mjs (deterministic seed 20260818) --
-- ${doctors.length} doctors across ${ROSTER.length} specialties, ${clinics.length} clinics,
-- ${scheduleSlots.length} schedule slots. Regenerate by re-running that script rather than
-- hand-editing this file.
--
-- Requires migration 0005_nullable_sub_specialty.sql (nullable
-- doctors.sub_specialty / specialty_taxonomy.sub_specialty).
-- =========================================================

DO $$
DECLARE
  seed_data jsonb := '${jsonLiteral}';
BEGIN
  -- 1. Seed Auth Users (Required to satisfy the auth.users FK constraint)
  INSERT INTO auth.users (id)
  SELECT (doc->>'id')::uuid
  FROM jsonb_array_elements(seed_data->'doctors') AS doc
  ON CONFLICT (id) DO NOTHING;

  -- 2a. Seed Specialty Taxonomy -- pairs with a sub_specialty
  INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
  SELECT DISTINCT doc->>'specialty', doc->>'sub_specialty'
  FROM jsonb_array_elements(seed_data->'doctors') AS doc
  WHERE doc->>'sub_specialty' IS NOT NULL
  ON CONFLICT (specialty, sub_specialty) DO NOTHING;

  -- 2b. Seed Specialty Taxonomy -- specialties with no sub_specialty
  -- (matches the partial unique index added in 0005_nullable_sub_specialty.sql)
  INSERT INTO public.specialty_taxonomy (specialty, sub_specialty)
  SELECT DISTINCT doc->>'specialty', NULL
  FROM jsonb_array_elements(seed_data->'doctors') AS doc
  WHERE doc->>'sub_specialty' IS NULL
  ON CONFLICT (specialty) WHERE sub_specialty IS NULL DO NOTHING;

  -- 3. Seed Doctors
  INSERT INTO public.doctors (id, name, credentials, specialty, sub_specialty, hmo_accreditations, verified)
  SELECT
    (doc->>'id')::uuid,
    doc->>'name',
    doc->>'credentials',
    doc->>'specialty',
    doc->>'sub_specialty',
    -- Converts the JSON array of strings into a Postgres text[] array
    (SELECT array_agg(x::text) FROM jsonb_array_elements_text(doc->'hmo_accreditations') x),
    (doc->>'verified')::boolean
  FROM jsonb_array_elements(seed_data->'doctors') AS doc
  ON CONFLICT (id) DO NOTHING;

  -- 4. Seed Clinics
  INSERT INTO public.clinics (id, doctor_id, name, room_details, location, consultation_fee)
  SELECT
    (cln->>'id')::uuid,
    (cln->>'doctor_id')::uuid,
    cln->>'name',
    cln->>'room_details',
    cln->>'location',
    (cln->>'consultation_fee')::numeric
  FROM jsonb_array_elements(seed_data->'clinics') AS cln
  ON CONFLICT (id) DO NOTHING;

  -- 5. Seed Schedule Slots
  INSERT INTO public.schedule_slots (id, doctor_id, clinic_id, date, start_time, end_time, is_booked)
  SELECT
    (slot->>'id')::uuid,
    (slot->>'doctor_id')::uuid,
    (slot->>'clinic_id')::uuid,
    (slot->>'date')::date,
    (slot->>'start_time')::time,
    (slot->>'end_time')::time,
    -- Casts the string to the custom enum type
    (slot->>'is_booked')::public.slot_status
  FROM jsonb_array_elements(seed_data->'schedule_slots') AS slot
  ON CONFLICT (id) DO NOTHING;

END $$;
`;

writeFileSync(new URL("../supabase/migrations/seeds.sql", import.meta.url), sql, "utf-8");

console.log(`doctors: ${doctors.length}`);
console.log(`clinics: ${clinics.length}`);
console.log(`schedule_slots: ${scheduleSlots.length}`);
console.log(`taxonomy pairs: ${taxonomySet.size}`);
console.log("wrote seeds.sql");
