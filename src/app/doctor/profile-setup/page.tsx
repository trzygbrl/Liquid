'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import { findOrCreateTaxonomyEntry } from '@/lib/taxonomySelfService';

type TaxonomyRow = { specialty: string; sub_specialty: string };

// Sentinel selected value for "+ Other (please specify)" in the specialty
// and sub-specialty dropdowns (Task 7.3 -- doctor self-service taxonomy).
const OTHER_VALUE = '__other__';

interface ClinicFormRow {
  name: string;
  roomDetails: string;
  location: string;
  consultationFee: string;
}

const BLANK_CLINIC: ClinicFormRow = { name: '', roomDetails: '', location: '', consultationFee: '' };

function ProfileSetupForm() {
  const router = useRouter();
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Doctor fields
  const [name, setName] = useState('');
  // Real required text now (Task 7.2) -- was a file-upload-filename stub.
  // The PRC license number this app checks via HITL review lives in this
  // field; there is no separate license_number column.
  const [credentials, setCredentials] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subSpecialty, setSubSpecialty] = useState('');
  // Free-text names entered when specialty/sub-specialty is OTHER_VALUE
  // (Task 7.3 -- doctor self-service taxonomy addition).
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [customSubSpecialty, setCustomSubSpecialty] = useState('');

  // Clinic fields -- a repeatable list so a doctor can register more than
  // one practice location right from onboarding, not just the dashboard.
  const [clinics, setClinics] = useState<ClinicFormRow[]>([{ ...BLANK_CLINIC }]);

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
          // Both a doctors row and a clinics row exist, so the doctor is fully onboarded.
          router.replace('/doctor/dashboard');
          return;
        }

        // Doctor row exists but no clinic yet. Likely a prior attempt where the
        // clinic insert failed. Pre-fill what's already saved so they don't retype it.
        setName(existingDoctor.name ?? '');
        setSpecialty(existingDoctor.specialty ?? '');
        setSubSpecialty(existingDoctor.sub_specialty ?? '');
        setCredentials(existingDoctor.credentials ?? '');
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

  // Derive unique specialty list straight from taxonomy -- specialties with no
  // sub-specialty entries (e.g. 'General Medicine') already surface correctly
  // from this fetch, no hardcoded prepend needed.
  const specialties = Array.from(new Set(taxonomy.map((t) => t.specialty)));
  const subSpecialties = taxonomy
    .filter((t) => t.specialty === specialty)
    .map((t) => t.sub_specialty);

  const isNewSpecialty = specialty === OTHER_VALUE;
  const isNewSubSpecialty = subSpecialty === OTHER_VALUE;

  // True when the selected (existing) specialty has no sub-specialty entries in
  // the taxonomy. Used to hide the sub-specialty field and skip the
  // sub-specialty validation requirement. Not meaningful for a brand-new
  // specialty (isNewSpecialty), which always gets an optional free-text
  // sub-specialty field instead.
  const isGeneralPractice = !isNewSpecialty && specialty !== '' && subSpecialties.length === 0;

  function handleSpecialtyChange(value: string) {
    setSpecialty(value);
    setSubSpecialty(''); // reset sub when specialty changes
    setCustomSpecialty('');
    setCustomSubSpecialty('');
  }

  function updateClinicField(index: number, field: keyof ClinicFormRow, value: string) {
    setClinics((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addClinicRow() {
    setClinics((prev) => [...prev, { ...BLANK_CLINIC }]);
  }

  function removeClinicRow(index: number) {
    setClinics((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Sub-specialty is only required when the selected specialty has taxonomy entries.
    // Specialties like 'General Medicine' have no sub-specialties and submit sub_specialty = null.
    // A brand-new specialty (isNewSpecialty) never requires a sub-specialty.
    const subSpecialtyRequired = !isNewSpecialty && !isGeneralPractice;
    if (
      !name.trim() ||
      !credentials.trim() ||
      !specialty ||
      (isNewSpecialty && !customSpecialty.trim()) ||
      (!isNewSpecialty && subSpecialtyRequired && !subSpecialty) ||
      (!isNewSpecialty && isNewSubSpecialty && !customSubSpecialty.trim())
    ) {
      setError(
        !credentials.trim()
          ? 'Please enter your credentials, including your PRC license number.'
          : isNewSpecialty
          ? 'Please fill in your name and the new specialty name.'
          : subSpecialtyRequired
          ? 'Please fill in your name, specialty, and sub-specialty.'
          : 'Please fill in your name and specialty.'
      );
      return;
    }

    for (let i = 0; i < clinics.length; i++) {
      const clinic = clinics[i];
      if (!clinic.name.trim() || !clinic.location.trim() || !clinic.consultationFee) {
        setError(`Please fill in the name, location, and consultation fee for clinic #${i + 1}.`);
        return;
      }
      const fee = parseFloat(clinic.consultationFee);
      if (Number.isNaN(fee) || fee < 0) {
        setError(`Consultation fee for clinic #${i + 1} must be a positive number.`);
        return;
      }
    }

    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError('Your session expired. Please log in again.');
      setSubmitting(false);
      return;
    }

    // Resolve any "+ Other (please specify)" entry into a real
    // specialty_taxonomy row *before* the doctors upsert below -- the
    // check_doctor_specialty_taxonomy trigger (migration 0005) validates the
    // (specialty, sub_specialty) pair against that table on every insert, so
    // the taxonomy row has to exist first (Task 7.3).
    let resolvedSpecialty = specialty;
    let resolvedSubSpecialty: string | null = subSpecialty || null;

    if (isNewSpecialty || isNewSubSpecialty) {
      try {
        const entry = await findOrCreateTaxonomyEntry(
          supabase,
          isNewSpecialty ? customSpecialty : specialty,
          isNewSpecialty ? customSubSpecialty || null : isNewSubSpecialty ? customSubSpecialty : subSpecialty || null
        );
        resolvedSpecialty = entry.specialty;
        resolvedSubSpecialty = entry.sub_specialty;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the new specialty. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    // upsert, not insert, so it is safe to re-run if a previous attempt saved the doctor
    // row but failed on the clinic insert below (no cross-table transaction available
    // through the Supabase JS client).
    const { error: doctorError } = await supabase.from('doctors').upsert({
      id: session.user.id, // must equal auth.uid(), required by doctors_insert_own RLS policy
      name: name.trim(),
      credentials: credentials.trim(),
      specialty: resolvedSpecialty,
      // Send null (not an empty string) when there is no sub-specialty --
      // validated (both the null and non-null case) by the
      // check_doctor_specialty_taxonomy trigger from migration 0005.
      sub_specialty: resolvedSubSpecialty,
      // hmo_accreditations left to DB default '{}', seeded via Task 1.4
      // verification_status left to DB default 'pending' (migration 0008)
    });

    if (doctorError) {
      setError(doctorError.message);
      setSubmitting(false);
      return;
    }

    const { error: clinicError } = await supabase.from('clinics').insert(
      clinics.map((c) => ({
        doctor_id: session.user.id,
        name: c.name.trim(),
        room_details: c.roomDetails.trim() || null,
        location: c.location.trim(),
        consultation_fee: parseFloat(c.consultationFee),
      }))
    );

    setSubmitting(false);

    if (clinicError) {
      setError(
        `Your profile saved, but the clinic details didn't: ${clinicError.message}. Please submit again.`
      );
      return;
    }

    router.replace('/doctor/dashboard');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="border-b border-slate-200/80 pb-6 mb-8">
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-100">
            Doctor Onboarding
          </span>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Set up your practitioner profile</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            This is a one-time setup. Your profile will appear in the patient directory once our team verifies your PRC license.
          </p>
        </div>

        {/* Card */}
        <div className="card p-7 sm:p-9">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Doctor details */}
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">Practitioner Details</h2>
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
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {/* Credentials / PRC license number */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doctor-credentials" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Credentials & PRC License Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="doctor-credentials"
                type="text"
                placeholder="PRC Lic. No. 123456 | MD, FPAFP"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                required
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="text-xs text-slate-500">
                Include your PRC license number here -- a member of our team manually verifies it against{' '}
                <a
                  href="https://verification.prc.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 underline hover:text-brand-900"
                >
                  the PRC's public verification portal
                </a>{' '}
                before your profile appears in the patient directory.
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
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
              >
                <option value="">Select specialty</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value={OTHER_VALUE}>+ Other (please specify)</option>
              </select>
              {specialties.length === 0 && !error && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  No specialties found. Make sure taxonomy is loaded.
                </p>
              )}
            </div>

            {/* New specialty name, shown instead of the sub-specialty picker below
                when "+ Other" is selected above -- a brand-new specialty has no
                existing sub-specialty entries to pick from. */}
            {isNewSpecialty && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="doctor-custom-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  New specialty name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="doctor-custom-specialty"
                  type="text"
                  placeholder="e.g. Sports Medicine"
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  required
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                />
                <label htmlFor="doctor-custom-sub-specialty" className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Sub-specialty
                  <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
                </label>
                <input
                  id="doctor-custom-sub-specialty"
                  type="text"
                  placeholder="Leave blank if this specialty has none"
                  value={customSubSpecialty}
                  onChange={(e) => setCustomSubSpecialty(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                />
                <p className="text-xs text-slate-500">
                  This becomes available for every doctor to select going forward.
                </p>
              </div>
            )}

            {/* Sub-specialty (existing specialty selected) */}
            {!isNewSpecialty && !isGeneralPractice && (
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
                  onChange={(e) => {
                    setSubSpecialty(e.target.value);
                    if (e.target.value !== OTHER_VALUE) setCustomSubSpecialty('');
                  }}
                  required={subSpecialties.length > 0}
                  disabled={!specialty}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {specialty ? 'Select sub-specialty' : 'Pick a specialty first'}
                  </option>
                  {subSpecialties.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value={OTHER_VALUE}>+ Other (please specify)</option>
                </select>
                {isNewSubSpecialty && (
                  <input
                    type="text"
                    placeholder="New sub-specialty name"
                    value={customSubSpecialty}
                    onChange={(e) => setCustomSubSpecialty(e.target.value)}
                    required
                    className="mt-1 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                  />
                )}
              </div>
            )}
            {!isNewSpecialty && isGeneralPractice && (
              <p className="text-xs text-slate-500 -mt-1">
                This specialty has no sub-specialty, so this field will be left blank.
              </p>
            )}

            {/* Clinic details */}

            <div className="mt-3 border-t border-slate-100 pt-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">Practice Clinics</h2>
              <p className="mt-1 text-sm text-slate-600">
                Add every location you practice at. You can also add, edit, or remove clinics later from your dashboard.
              </p>
            </div>

            {clinics.map((clinic, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Clinic #{index + 1}
                  </span>
                  {clinics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeClinicRow(index)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Clinic / practice name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`clinic-name-${index}`} className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Clinic / Hospital Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`clinic-name-${index}`}
                    type="text"
                    placeholder="e.g. Angeles University Foundation Medical Center"
                    value={clinic.name}
                    onChange={(e) => updateClinicField(index, 'name', e.target.value)}
                    required
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                {/* Room / suite details */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`clinic-room-${index}`} className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Room / Suite Details
                    <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
                  </label>
                  <input
                    id={`clinic-room-${index}`}
                    type="text"
                    placeholder="e.g. 3rd Floor, Suite 210"
                    value={clinic.roomDetails}
                    onChange={(e) => updateClinicField(index, 'roomDetails', e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                {/* Clinic location */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`clinic-location-${index}`} className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    City / Province Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`clinic-location-${index}`}
                    type="text"
                    placeholder="e.g. MacArthur Highway, Angeles City, Pampanga"
                    value={clinic.location}
                    onChange={(e) => updateClinicField(index, 'location', e.target.value)}
                    required
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                {/* Consultation fee */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`clinic-fee-${index}`} className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Consultation Fee (PHP) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                    <input
                      id={`clinic-fee-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="500.00"
                      value={clinic.consultationFee}
                      onChange={(e) => updateClinicField(index, 'consultationFee', e.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-8 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addClinicRow}
              className="self-start text-xs font-bold text-brand-700 hover:text-brand-900 transition"
            >
              + Add another clinic
            </button>

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
              className="mt-2 min-h-[48px] rounded-2xl bg-brand-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {submitting ? 'Saving profile…' : 'Save profile and continue'}
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
