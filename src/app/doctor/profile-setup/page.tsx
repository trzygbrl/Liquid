'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

type TaxonomyRow = { specialty: string; sub_specialty: string };

function ProfileSetupForm() {
  const router = useRouter();
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Doctor fields
  const [name, setName] = useState('');
  const [credentialFileName, setCredentialFileName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subSpecialty, setSubSpecialty] = useState('');

  // Clinic fields
  const [clinicName, setClinicName] = useState('');
  const [roomDetails, setRoomDetails] = useState('');
  const [clinicLocation, setClinicLocation] = useState('');
  const [consultationFee, setConsultationFee] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return; // RequireRole already handles this redirect

      const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (existingDoctor) {
        const { data: existingClinics } = await supabase
          .from('clinics')
          .select('id')
          .eq('doctor_id', session.user.id)
          .limit(1);

        if (existingClinics && existingClinics.length > 0) {
          // Both a doctors row and a clinics row exist — fully onboarded.
          router.replace('/doctor/dashboard');
          return;
        }

        // Doctor row exists but no clinic yet — likely a prior attempt where the
        // clinic insert failed. Pre-fill what's already saved so they don't retype it.
        setName(existingDoctor.name ?? '');
        setSpecialty(existingDoctor.specialty ?? '');
        setSubSpecialty(existingDoctor.sub_specialty ?? '');
        setCredentialFileName(existingDoctor.credentials ?? '');
      }

      const { data: taxonomyRows, error: taxonomyError } = await supabase
        .from('specialty_taxonomy')
        .select('specialty, sub_specialty')
        .order('specialty')
        .order('sub_specialty');

      if (taxonomyError) {
        setError('Could not load the specialty list. Refresh and try again.');
      } else {
        setTaxonomy(taxonomyRows ?? []);
      }
      setLoading(false);
    }

    init();
  }, [router]);

  // Derive unique specialty list from taxonomy, plus 'General Practice' which has no
  // sub-specialty entries and therefore won't appear in the taxonomy-derived list.
  const specialties = [
    'General Practice',
    ...Array.from(new Set(taxonomy.map((t) => t.specialty))),
  ];
  const subSpecialties = taxonomy
    .filter((t) => t.specialty === specialty)
    .map((t) => t.sub_specialty);

  // True when the selected specialty has no sub-specialty entries in the taxonomy.
  // Used to hide the sub-specialty field and skip the sub-specialty validation requirement.
  const isGeneralPractice = specialty !== '' && subSpecialties.length === 0;

  function handleSpecialtyChange(value: string) {
    setSpecialty(value);
    setSubSpecialty(''); // reset sub when specialty changes
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCredentialFileName(file.name);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Sub-specialty is only required when the selected specialty has taxonomy entries.
    // Specialties like 'General Practice' have no sub-specialties and submit sub_specialty = null.
    const subSpecialtyRequired = !isGeneralPractice;
    if (!name.trim() || !specialty || (subSpecialtyRequired && !subSpecialty) || !clinicName.trim() || !clinicLocation.trim() || !consultationFee) {
      setError(
        subSpecialtyRequired
          ? 'Please fill in your name, specialty, sub-specialty, clinic name, clinic location, and consultation fee.'
          : 'Please fill in your name, specialty, clinic name, clinic location, and consultation fee.'
      );
      return;
    }

    const parsedFee = parseFloat(consultationFee);
    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setError('Consultation fee must be a positive number.');
      return;
    }

    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError('Your session expired — please log in again.');
      setSubmitting(false);
      return;
    }

    // upsert, not insert — safe to re-run if a previous attempt saved the doctor
    // row but failed on the clinic insert below (no cross-table transaction available
    // through the Supabase JS client).
    const { error: doctorError } = await supabase.from('doctors').upsert({
      id: session.user.id, // must equal auth.uid() — required by doctors_insert_own RLS policy
      name: name.trim(),
      credentials: credentialFileName || null,
      specialty,
      // Send null (not an empty string) when there is no sub-specialty.
      // An empty string would not satisfy the composite FK to specialty_taxonomy.
      // null is correct: the composite FK uses MATCH SIMPLE and skips validation
      // when sub_specialty is null; the new doctors_specialty_fk still validates specialty.
      sub_specialty: subSpecialty || null,
      // hmo_accreditations left to DB default '{}' — seeded via Task 1.4
      // verified left to DB default true
    });

    if (doctorError) {
      setError(doctorError.message);
      setSubmitting(false);
      return;
    }

    const { error: clinicError } = await supabase.from('clinics').insert({
      doctor_id: session.user.id,
      name: clinicName.trim(),
      room_details: roomDetails.trim() || null,
      location: clinicLocation.trim(),
      consultation_fee: parsedFee,
    });

    setSubmitting(false);

    if (clinicError) {
      setError(
        `Your profile saved, but the clinic details didn't — ${clinicError.message}. Please submit again.`
      );
      return;
    }

    router.replace('/doctor/dashboard');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F8F7FA] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="border-b border-slate-200/80 pb-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-extrabold text-slate-900">
              Civic<span className="text-violet-600">Access</span>
            </span>
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-100">
              Doctor Onboarding
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Set up your practitioner profile</h1>
          <p className="mt-1 text-xs text-slate-500">
            This is a one-time setup. Once completed, your profile and clinics will be visible in the directory.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-100 bg-white p-7 sm:p-9 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* ── Doctor details ──────────────────────────────────────── */}
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-violet-700">Practitioner Details</h2>
            </div>

            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doctor-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Full name <span className="text-rose-500">*</span>
              </label>
              <input
                id="doctor-name"
                type="text"
                placeholder="Dr. Maria Santos, MD"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Credential file */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doctor-credentials" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Credential File (License or Certificate)
                <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="doctor-credentials"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500
                  file:mr-4 file:rounded-xl file:border-0
                  file:bg-slate-100 file:px-4 file:py-2.5 file:text-xs
                  file:font-bold file:text-slate-700
                  hover:file:bg-slate-200 file:cursor-pointer file:transition"
              />
              {credentialFileName && (
                <p className="text-xs text-violet-700 font-medium">Selected: <span>{credentialFileName}</span></p>
              )}
              <p className="text-xs text-slate-400">
                Demo mode — only the filename is stored. No actual file is uploaded.
              </p>
            </div>

            {/* Specialty */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doctor-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Primary Specialty <span className="text-rose-500">*</span>
              </label>
              <select
                id="doctor-specialty"
                value={specialty}
                onChange={(e) => handleSpecialtyChange(e.target.value)}
                required
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
              >
                <option value="">Select specialty</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {specialties.length === 0 && !error && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  No specialties found — make sure taxonomy is loaded.
                </p>
              )}
            </div>

            {/* Sub-specialty */}
            {!isGeneralPractice && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="doctor-sub-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Sub-specialty{' '}
                  {specialty && subSpecialties.length > 0 ? (
                    <span className="text-rose-500">*</span>
                  ) : (
                    <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
                  )}
                </label>
                <select
                  id="doctor-sub-specialty"
                  value={subSpecialty}
                  onChange={(e) => setSubSpecialty(e.target.value)}
                  required={subSpecialties.length > 0}
                  disabled={!specialty}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {specialty ? 'Select sub-specialty' : 'Pick a specialty first'}
                  </option>
                  {subSpecialties.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {isGeneralPractice && (
              <p className="text-xs text-slate-500 -mt-1">
                General Practice has no sub-specialty — this field will be left blank.
              </p>
            )}

            {/* ── Clinic details ──────────────────────────────────────── */}

            <div className="mt-3 border-t border-slate-100 pt-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-violet-700">Primary Practice Clinic</h2>
              <p className="mt-1 text-xs text-slate-400 font-medium">
                You&apos;ll be able to add more clinics later in your dashboard.
              </p>
            </div>

            {/* Clinic / practice name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="clinic-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Clinic / Hospital Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="clinic-name"
                type="text"
                placeholder="e.g. Angeles University Foundation Medical Center"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                required
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Room / suite details */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="clinic-room" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Room / Suite Details
                <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="clinic-room"
                type="text"
                placeholder="e.g. 3rd Floor, Suite 210"
                value={roomDetails}
                onChange={(e) => setRoomDetails(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Clinic location */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="clinic-location" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                City / Province Location <span className="text-rose-500">*</span>
              </label>
              <input
                id="clinic-location"
                type="text"
                placeholder="e.g. MacArthur Highway, Angeles City, Pampanga"
                value={clinicLocation}
                onChange={(e) => setClinicLocation(e.target.value)}
                required
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Consultation fee */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="clinic-fee" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Consultation Fee (PHP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                <input
                  id="clinic-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500.00"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-8 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              id="doctor-profile-submit"
              type="submit"
              disabled={submitting}
              className="mt-2 min-h-[48px] rounded-2xl bg-[#2A2338] px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#1E192C] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {submitting ? 'Saving profile…' : 'Save profile and continue →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function DoctorProfileSetupPage() {
  return (
    <RequireRole role="doctor">
      <ProfileSetupForm />
    </RequireRole>
  );
}
