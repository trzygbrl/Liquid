-- =============================================================
-- 0001_initial_schema.sql
-- Civic Access (Team Liquid) — PRD Section 6 data models
--
-- Design assumptions documented in the task brief:
--   * patients and doctors use auth.users(id) as their PK (no separate auth_user_id)
--   * doctors rows are created at profile-setup time (Task 2.1), so NOT NULL on name/specialty/rate
--   * composite FK doctors(specialty, sub_specialty) -> specialty_taxonomy enforces taxonomy at DB level
--   * one active appointment per slot enforced via partial unique index
--   * one review per appointment enforced via unique constraint on appointment_id
-- =============================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. Specialty Taxonomy -- seed/reference table, not user-editable
-- =========================================================
create table public.specialty_taxonomy (
  id uuid primary key default gen_random_uuid(),
  specialty text not null,
  sub_specialty text not null,
  created_at timestamptz not null default now(),
  unique (specialty, sub_specialty)
);

create index idx_specialty_taxonomy_specialty on public.specialty_taxonomy (specialty);

-- =========================================================
-- 2. Patients ("User (Patient)" in the PRD)
-- =========================================================
create table public.patients (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  age integer check (age > 0 and age < 130),
  sex text check (sex in ('male', 'female', 'other')),
  location text,
  hmo_provider text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 3. Doctors
-- =========================================================
create table public.doctors (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  credentials text,
  specialty text not null,
  sub_specialty text not null,
  rate numeric(10, 2) not null check (rate >= 0),
  hmo_accreditations text[] not null default '{}',
  location text,
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (specialty, sub_specialty)
    references public.specialty_taxonomy (specialty, sub_specialty)
);

create index idx_doctors_specialty_sub on public.doctors (specialty, sub_specialty);
create index idx_doctors_hmo_accreditations on public.doctors using gin (hmo_accreditations);

-- =========================================================
-- 4. Schedule Slots
-- =========================================================
create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index idx_schedule_slots_doctor_date on public.schedule_slots (doctor_id, date);
create index idx_schedule_slots_available on public.schedule_slots (doctor_id, date)
  where is_booked = false;

-- =========================================================
-- 5. Appointments
-- =========================================================
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  slot_id uuid not null references public.schedule_slots (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'completed', 'cancelled')),
  symptom_summary text,
  created_at timestamptz not null default now()
);

-- one *active* appointment per slot (cancelled/declined don't block rebooking)
create unique index idx_appointments_active_slot
  on public.appointments (slot_id)
  where status in ('pending', 'confirmed', 'completed');

create index idx_appointments_patient on public.appointments (patient_id);
create index idx_appointments_doctor_status on public.appointments (doctor_id, status);

-- =========================================================
-- 6. Reviews -- verified-visit-only, per PRD Section 8.6
-- =========================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_reviews_doctor on public.reviews (doctor_id);

-- =============================================================
-- Row-Level Security
-- Tables created via SQL Editor are NOT RLS-protected by default.
-- =============================================================
alter table public.specialty_taxonomy enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;

-- Specialty taxonomy: public read; writes only via service-role key (seeding)
create policy "specialty_taxonomy_read_all" on public.specialty_taxonomy
  for select using (true);

-- Doctors: public read (patients browse before logging in); doctors manage their own row
create policy "doctors_read_all" on public.doctors for select using (true);
create policy "doctors_insert_own" on public.doctors for insert with check (auth.uid() = id);
create policy "doctors_update_own" on public.doctors for update using (auth.uid() = id);

-- Patients: visible to themselves, and to a doctor they have an appointment with
create policy "patients_select_own" on public.patients for select using (auth.uid() = id);
create policy "patients_select_by_doctor" on public.patients for select
  using (
    exists (
      select 1 from public.appointments a
      where a.patient_id = patients.id and a.doctor_id = auth.uid()
    )
  );
create policy "patients_insert_own" on public.patients for insert with check (auth.uid() = id);
create policy "patients_update_own" on public.patients for update using (auth.uid() = id);

-- Schedule slots: public read (needed to show availability); doctor manages their own
create policy "slots_read_all" on public.schedule_slots for select using (true);
create policy "slots_manage_own" on public.schedule_slots for all
  using (auth.uid() = doctor_id) with check (auth.uid() = doctor_id);

-- Appointments: visible to and editable by the patient or doctor involved
create policy "appointments_select_own" on public.appointments for select
  using (auth.uid() = patient_id or auth.uid() = doctor_id);
create policy "appointments_insert_patient" on public.appointments for insert
  with check (auth.uid() = patient_id);
create policy "appointments_update_involved" on public.appointments for update
  using (auth.uid() = patient_id or auth.uid() = doctor_id);
-- TODO (Task 4.2/2.3): tighten this -- patients should only cancel, doctors should only
-- accept/decline/complete. Implement per-column restrictions once the actual update
-- call shapes are known.

-- Reviews: public read; only the involved patient can post one
create policy "reviews_read_all" on public.reviews for select using (true);
create policy "reviews_insert_patient" on public.reviews for insert
  with check (auth.uid() = patient_id);
-- NOTE (Task 5.1): "only if appointment.status = 'completed'" is enforced at app level
-- (check status before showing the review form). Add a DB trigger later if you want it
-- enforced against direct API calls too.
