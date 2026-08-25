// scripts/seed_doctors.js
// Seeds the 8 demo Ophthalmology doctors through Supabase GoTrue Admin API
// and populates public.doctors, public.clinics, and public.schedule_slots.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', serviceKey = '', anonKey = '';
env.split(/\r?\n/).forEach((l) => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL='))
    url = l.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim();
  if (l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))
    serviceKey = l.replace('SUPABASE_SERVICE_ROLE_KEY=', '').trim();
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))
    anonKey = l.replace('NEXT_PUBLIC_SUPABASE_ANON_KEY=', '').trim();
});

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(url, anonKey);

const doctorsData = [
  {
    id: '11111111-0001-0001-0001-000000000001',
    email: 'doctor+reyes@civicaccess.demo',
    name: 'Dr. Maria Luisa Reyes',
    credentials:
      'PRC Lic. No. 0123456 | MD, University of Santo Tomas (2010) | Fellow, Philippine Academy of Ophthalmology | Vitreoretinal Fellowship, Asian Eye Institute | 14 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Retina',
    hmo_accreditations: ['Maxicare', 'Medicard', 'Intellicare'],
    verified: true,
    clinic: {
      id: '22222222-0001-0001-0001-000000000001',
      name: 'Angeles Medical Eye Center',
      room_details: 'Room 302, 3rd Floor',
      location: 'Holy Family Hospital, McArthur Highway, Angeles City, Pampanga',
      consultation_fee: 1200.0,
    },
    slots: [
      { date: '2026-08-20', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-08-20', start_time: '10:00:00', end_time: '10:45:00' },
      { date: '2026-08-25', start_time: '14:00:00', end_time: '14:45:00' },
      { date: '2026-09-01', start_time: '09:00:00', end_time: '09:45:00' },
    ],
  },
  {
    id: '11111111-0002-0002-0002-000000000002',
    email: 'doctor+dela-cruz@civicaccess.demo',
    name: 'Dr. Jose Antonio Dela Cruz',
    credentials:
      'PRC Lic. No. 0234567 | MD, Far Eastern University-NRMF (2015) | Fellow, Vitreo-Retina Society of the Philippines | 9 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Retina',
    hmo_accreditations: ['Maxicare', 'PhilCare'],
    verified: true,
    clinic: {
      id: '22222222-0002-0002-0002-000000000002',
      name: 'Pampanga Retina and Eye Specialists',
      room_details: 'Suite 104, Ground Floor',
      location:
        'Pampanga Doctors Hospital, 12 Oliva Street, San Fernando City, Pampanga',
      consultation_fee: 1000.0,
    },
    slots: [
      { date: '2026-08-21', start_time: '08:00:00', end_time: '08:45:00' },
      { date: '2026-08-21', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-08-27', start_time: '13:00:00', end_time: '13:45:00' },
    ],
  },
  {
    id: '11111111-0003-0003-0003-000000000003',
    email: 'doctor+santos@civicaccess.demo',
    name: 'Dr. Ana Corazon Santos',
    credentials:
      'PRC Lic. No. 0345678 | MD, University of the Philippines-Manila (2007) | Diplomate, Philippine Board of Ophthalmology | Phacoemulsification Training, Aravind Eye Hospital (India) | 17 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Cataract',
    hmo_accreditations: ['Medicard', 'PhilCare', 'Intellicare'],
    verified: true,
    clinic: {
      id: '22222222-0003-0003-0003-000000000003',
      name: 'ClaroVis Ophthalmology Clinic',
      room_details: 'Room 207, 2nd Floor',
      location:
        'Sacred Heart Medical Center, Don Juico Avenue, Angeles City, Pampanga',
      consultation_fee: 1500.0,
    },
    slots: [
      { date: '2026-08-19', start_time: '10:00:00', end_time: '10:45:00' },
      { date: '2026-08-22', start_time: '14:00:00', end_time: '14:45:00' },
      { date: '2026-08-26', start_time: '10:00:00', end_time: '10:45:00' },
      { date: '2026-08-29', start_time: '09:00:00', end_time: '09:45:00' },
    ],
  },
  {
    id: '11111111-0004-0004-0004-000000000004',
    email: 'doctor+garcia@civicaccess.demo',
    name: 'Dr. Ramon Emmanuel Garcia',
    credentials:
      'PRC Lic. No. 0456789 | MD, Ateneo School of Medicine and Public Health (2013) | Fellow, Philippine Academy of Ophthalmology | Anterior Segment Surgery Training, Singapore National Eye Centre | 11 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Cataract',
    hmo_accreditations: ['Maxicare', 'Medicard'],
    verified: true,
    clinic: {
      id: '22222222-0004-0004-0004-000000000004',
      name: 'Eagle Eye Surgical and Laser Center',
      room_details: 'Unit 3B, Medical Arts Building',
      location:
        'Ospital ning Angeles, Sto. Rosario Street, Angeles City, Pampanga',
      consultation_fee: 1100.0,
    },
    slots: [
      { date: '2026-08-20', start_time: '13:00:00', end_time: '13:45:00' },
      { date: '2026-08-23', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-08-28', start_time: '14:00:00', end_time: '14:45:00' },
    ],
  },
  {
    id: '11111111-0005-0005-0005-000000000005',
    email: 'doctor+mendoza@civicaccess.demo',
    name: 'Dr. Fe Consolacion Mendoza',
    credentials:
      'PRC Lic. No. 0567890 | MD, De La Salle Medical and Health Sciences Institute (2011) | Fellow, Glaucoma Society of the Philippines | 13 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Glaucoma',
    hmo_accreditations: ['Intellicare', 'PhilCare'],
    verified: true,
    clinic: {
      id: '22222222-0005-0005-0005-000000000005',
      name: 'San Fernando Eye and Glaucoma Institute',
      room_details: 'Room 110, 1st Floor',
      location:
        'Metro Clark Medical Center, M.A. Roxas Highway, Clark Freeport Zone, Pampanga',
      consultation_fee: 1300.0,
    },
    slots: [
      { date: '2026-08-19', start_time: '08:00:00', end_time: '08:45:00' },
      { date: '2026-08-24', start_time: '10:00:00', end_time: '10:45:00' },
      { date: '2026-08-27', start_time: '08:00:00', end_time: '08:45:00' },
      { date: '2026-08-31', start_time: '13:00:00', end_time: '13:45:00' },
    ],
  },
  {
    id: '11111111-0006-0006-0006-000000000006',
    email: 'doctor+lim@civicaccess.demo',
    name: 'Dr. Benjamin Patrick Lim',
    credentials:
      'PRC Lic. No. 0678901 | MD, Cebu Institute of Medicine (2016) | Diplomate, Philippine Board of Ophthalmology | Glaucoma Fellowship, Institut Curie Paris (France) | 8 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Glaucoma',
    hmo_accreditations: ['Maxicare', 'Medicard', 'PhilCare'],
    verified: true,
    clinic: {
      id: '22222222-0006-0006-0006-000000000006',
      name: 'InVision Glaucoma Clinic',
      room_details: 'Suite 205, Medical Plaza',
      location:
        'Jose B. Lingad Memorial Regional Hospital, San Fernando City, Pampanga',
      consultation_fee: 900.0,
    },
    slots: [
      { date: '2026-08-21', start_time: '13:00:00', end_time: '13:45:00' },
      { date: '2026-08-25', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-08-29', start_time: '14:00:00', end_time: '14:45:00' },
    ],
  },
  {
    id: '11111111-0007-0007-0007-000000000007',
    email: 'doctor+tan@civicaccess.demo',
    name: 'Dr. Rosario Milagros Tan',
    credentials:
      'PRC Lic. No. 0789012 | MD, University of Santo Tomas (2008) | Fellow, Philippine Society of Pediatric Ophthalmology and Strabismus | Pediatric Ophthalmology Fellowship, Childrens Hospital Los Angeles | 16 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Pediatric Ophthalmology',
    hmo_accreditations: ['Maxicare', 'Intellicare'],
    verified: true,
    clinic: {
      id: '22222222-0007-0007-0007-000000000007',
      name: 'Little Eyes Pediatric Ophthalmology Center',
      room_details: 'Room 401, 4th Floor',
      location:
        'Angeles University Medical Center, MacArthur Highway, Angeles City, Pampanga',
      consultation_fee: 1200.0,
    },
    slots: [
      { date: '2026-08-19', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-08-22', start_time: '10:00:00', end_time: '10:45:00' },
      { date: '2026-08-26', start_time: '09:00:00', end_time: '09:45:00' },
      { date: '2026-09-01', start_time: '13:00:00', end_time: '13:45:00' },
    ],
  },
  {
    id: '11111111-0008-0008-0008-000000000008',
    email: 'doctor+aquino@civicaccess.demo',
    name: 'Dr. Leonardo Cruz Aquino',
    credentials:
      'PRC Lic. No. 0890123 | MD, University of the East-Ramon Magsaysay Memorial Medical Center (2017) | Fellow, Philippine Academy of Ophthalmology | 7 yrs experience',
    specialty: 'Ophthalmology',
    sub_specialty: 'Pediatric Ophthalmology',
    hmo_accreditations: ['Medicard', 'PhilCare', 'Intellicare'],
    verified: true,
    clinic: {
      id: '22222222-0008-0008-0008-000000000008',
      name: 'Kapampangan Childrens Eye Clinic',
      room_details: 'Room 101, Ground Floor',
      location:
        'Pampanga Adventist Hospital, Magalang Road, San Fernando City, Pampanga',
      consultation_fee: 850.0,
    },
    slots: [
      { date: '2026-08-20', start_time: '08:00:00', end_time: '08:45:00' },
      { date: '2026-08-24', start_time: '13:00:00', end_time: '13:45:00' },
      { date: '2026-08-28', start_time: '09:00:00', end_time: '09:45:00' },
    ],
  },
];

async function seed() {
  console.log('Seeding 8 demo doctor accounts via Supabase Admin API...');

  for (const doc of doctorsData) {
    // 1. Create auth user
    console.log(`\nCreating auth user: ${doc.name} (${doc.email})...`);
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      id: doc.id,
      email: doc.email,
      password: 'DemoPass2024!',
      email_confirm: true,
      user_metadata: { role: 'doctor' },
    });

    if (userError) {
      console.warn(`User creation note for ${doc.email}:`, userError.message);
    } else {
      console.log(`OK: Auth user created: ${userData.user.id}`);
    }

    // 2. Upsert public.doctors
    const { error: docError } = await admin.from('doctors').upsert({
      id: doc.id,
      name: doc.name,
      credentials: doc.credentials,
      specialty: doc.specialty,
      sub_specialty: doc.sub_specialty,
      hmo_accreditations: doc.hmo_accreditations,
      verified: doc.verified,
    });
    if (docError) console.error(`Error saving doctor ${doc.name}:`, docError);
    else console.log(`OK: Doctor record saved: ${doc.name}`);

    // 3. Upsert clinic
    const { error: clinicError } = await admin.from('clinics').upsert({
      id: doc.clinic.id,
      doctor_id: doc.id,
      name: doc.clinic.name,
      room_details: doc.clinic.room_details,
      location: doc.clinic.location,
      consultation_fee: doc.clinic.consultation_fee,
    });
    if (clinicError) console.error(`Error saving clinic:`, clinicError);
    else console.log(`OK: Clinic saved: ${doc.clinic.name}`);

    // 4. Insert schedule slots
    for (const slot of doc.slots) {
      await admin.from('schedule_slots').insert({
        doctor_id: doc.id,
        clinic_id: doc.clinic.id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: 'available',
      });
    }
    console.log(`OK: Schedule slots saved (${doc.slots.length} slots)`);
  }

  // Verify login for Dr. Reyes
  console.log('\n--- Testing login for Dr. Reyes (doctor+reyes@civicaccess.demo) ---');
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: 'doctor+reyes@civicaccess.demo',
    password: 'DemoPass2024!',
  });

  if (loginError) {
    console.error('FAILED: Login test failed:', loginError);
  } else {
    console.log('Login test SUCCEEDED! Logged in as:', loginData.user.email);
  }
}

seed();
