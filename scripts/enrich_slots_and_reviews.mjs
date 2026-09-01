import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Deterministic PRNG
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
const rand = mulberry32(20260901);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');

// Authentic bilingual review corpus
const REVIEW_COMMENTS = [
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

const SYMPTOM_SUMMARIES = [
  'Persistent chest discomfort and palpitations during exertion',
  'Severe upper abdominal pain radiating to back with nausea',
  'Chronic lower back pain with stiffness upon waking',
  'Frequent acid reflux and burning sensation after meals',
  'Severe migraines with visual aura and photophobia',
  'Skin rash with severe itching on arms and neck',
  'Recurrent fever with persistent productive cough',
  'Chronic knee pain and joint swelling during movement'
];

const SAMPLE_PATIENTS = [
  { name: 'Maria Cristina Santos', age: 34, sex: 'female', location: 'Angeles City, Pampanga', hmo_provider: 'Maxicare' },
  { name: 'Juan Carlos Dela Cruz', age: 45, sex: 'male', location: 'San Fernando City, Pampanga', hmo_provider: 'Medicard' },
  { name: 'Carmela Joy Reyes', age: 28, sex: 'female', location: 'Malolos City, Bulacan', hmo_provider: 'Intellicare' },
  { name: 'Roberto Dizon Jr.', age: 58, sex: 'male', location: 'Guagua, Pampanga', hmo_provider: 'PhilCare' },
  { name: 'Liza Bautista-Tan', age: 41, sex: 'female', location: 'Mabalacat City, Pampanga', hmo_provider: 'Maxicare' },
  { name: 'Mark Kenneth Gonzales', age: 24, sex: 'male', location: 'Tarlac City, Tarlac', hmo_provider: null },
  { name: 'Elena Ocampo', age: 67, sex: 'female', location: 'Meycauayan City, Bulacan', hmo_provider: 'Medicard' },
  { name: 'Patricia Marie Rivera', age: 31, sex: 'female', location: 'Clark, Pampanga', hmo_provider: 'Intellicare' },
  { name: 'Gabriel Fernandez', age: 52, sex: 'male', location: 'Baliwag, Bulacan', hmo_provider: 'Maxicare' },
  { name: 'Arlene Manalo', age: 39, sex: 'female', location: 'San Jose del Monte City, Bulacan', hmo_provider: 'PhilCare' }
];

async function batchInsert(table, rows, batchSize = 250) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await admin.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting into ${table} (batch ${i}..${i + chunk.length}):`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Enriching schedule slots & verified reviews for demo...');

  // 1. Ensure sample patients exist
  console.log('1. Checking/creating sample patient accounts...');
  const { data: existingPatients } = await admin.from('patients').select('id, name');
  let patientIds = (existingPatients ?? []).map((p) => p.id);

  if (patientIds.length < 5) {
    const patientRows = SAMPLE_PATIENTS.map((p) => ({
      id: randomUUID(),
      ...p
    }));
    await batchInsert('patients', patientRows);
    patientIds = patientRows.map((p) => p.id);
  }
  console.log(`✓ ${patientIds.length} sample patients available`);

  // 2. Fetch verified doctors and clinics
  console.log('2. Fetching verified doctors and clinics...');
  const { data: doctors, error: docErr } = await admin
    .from('doctors')
    .select('id, name, verification_status, clinics ( id, name, location )')
    .eq('verification_status', 'verified');

  if (docErr || !doctors || doctors.length === 0) {
    console.error('No verified doctors found:', docErr);
    process.exit(1);
  }
  console.log(`✓ Loaded ${doctors.length} verified doctors`);

  // 3. Generate dynamic upcoming schedule slots (Next 30 days)
  console.log('3. Generating upcoming schedule slots...');
  const today = new Date();
  const newSlots = [];

  for (const doc of doctors) {
    const clinics = doc.clinics ?? [];
    if (clinics.length === 0) continue;

    for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
      const slotDate = new Date(today);
      slotDate.setDate(slotDate.getDate() + dayOffset);
      const dow = slotDate.getDay(); // 0 = Sun, 6 = Sat
      if (dow === 0 || (dow === 6 && dayOffset % 2 === 0)) continue; // Skip Sunday & some Sats

      const dateStr = slotDate.toISOString().slice(0, 10);
      const clinic = clinics[dayOffset % clinics.length];

      // Morning Session (09:00 - 12:00)
      for (let hour = 9; hour < 12; hour++) {
        for (let min = 0; min < 60; min += 30) {
          const endMin = min + 30;
          const endHour = endMin === 60 ? hour + 1 : hour;
          const finalEndMin = endMin === 60 ? 0 : endMin;

          const r = rand();
          const is_booked = r < 0.70 ? 'available' : r < 0.90 ? 'booked' : 'doctor_on_leave';

          newSlots.push({
            id: randomUUID(),
            doctor_id: doc.id,
            clinic_id: clinic.id,
            date: dateStr,
            start_time: `${pad(hour)}:${pad(min)}:00`,
            end_time: `${pad(endHour)}:${pad(finalEndMin)}:00`,
            is_booked
          });
        }
      }

      // Afternoon Session (13:30 - 16:30)
      for (let hour = 13; hour < 17; hour++) {
        for (let min = 0; min < 60; min += 30) {
          if (hour === 13 && min === 0) continue; // Start 13:30
          if (hour === 16 && min === 30) continue; // End 16:30

          const endMin = min + 30;
          const endHour = endMin === 60 ? hour + 1 : hour;
          const finalEndMin = endMin === 60 ? 0 : endMin;

          const r = rand();
          const is_booked = r < 0.75 ? 'available' : 'booked';

          newSlots.push({
            id: randomUUID(),
            doctor_id: doc.id,
            clinic_id: clinic.id,
            date: dateStr,
            start_time: `${pad(hour)}:${pad(min)}:00`,
            end_time: `${pad(endHour)}:${pad(finalEndMin)}:00`,
            is_booked
          });
        }
      }
    }
  }

  console.log(`Inserting ${newSlots.length} schedule slots in batches...`);
  await batchInsert('schedule_slots', newSlots, 500);
  console.log('✓ Successfully populated upcoming schedule slots!');

  // 4. Generate past completed visits & verified reviews
  console.log('4. Generating past completed visits & verified reviews...');
  const pastSlots = [];
  const pastAppts = [];
  const newReviews = [];

  for (const doc of doctors) {
    const clinics = doc.clinics ?? [];
    if (clinics.length === 0) continue;
    const clinic = clinics[0];

    const reviewCount = 3 + Math.floor(rand() * 5); // 3 to 7 reviews per doctor

    for (let rIdx = 1; rIdx <= reviewCount; rIdx++) {
      const daysAgo = (rIdx * 4) + Math.floor(rand() * 3);
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - daysAgo);
      const dateStr = pastDate.toISOString().slice(0, 10);
      const createdAt = new Date(pastDate.getTime() + 10 * 3600 * 1000).toISOString();

      const slotId = randomUUID();
      const apptId = randomUUID();
      const reviewId = randomUUID();
      const patientId = pick(patientIds);
      const symptom = pick(SYMPTOM_SUMMARIES);
      const comment = pick(REVIEW_COMMENTS);
      const rating = rand() < 0.85 ? 5 : rand() < 0.96 ? 4 : 3;

      pastSlots.push({
        id: slotId,
        doctor_id: doc.id,
        clinic_id: clinic.id,
        date: dateStr,
        start_time: '10:00:00',
        end_time: '10:30:00',
        is_booked: 'booked',
        created_at: createdAt
      });

      pastAppts.push({
        id: apptId,
        patient_id: patientId,
        doctor_id: doc.id,
        slot_id: slotId,
        status: 'completed',
        symptom_summary: symptom,
        created_at: createdAt
      });

      newReviews.push({
        id: reviewId,
        appointment_id: apptId,
        patient_id: patientId,
        doctor_id: doc.id,
        rating,
        comment,
        created_at: createdAt
      });
    }
  }

  console.log(`Inserting ${pastSlots.length} past slots, ${pastAppts.length} appointments, and ${newReviews.length} reviews...`);
  await batchInsert('schedule_slots', pastSlots, 300);
  await batchInsert('appointments', pastAppts, 300);
  await batchInsert('reviews', newReviews, 300);
  console.log('✓ Successfully created past appointments and verified reviews!');

  console.log('\n🎉 Demo enrichment complete! Doctors now have upcoming schedule slots and verified review ratings.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
