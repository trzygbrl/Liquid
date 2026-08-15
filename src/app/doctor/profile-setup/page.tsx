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

  const [name, setName] = useState('');
  const [credentialFileName, setCredentialFileName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subSpecialty, setSubSpecialty] = useState('');
  const [rate, setRate] = useState('');
  const [location, setLocation] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return; // RequireRole already handles this redirect

      // One-time onboarding step, not an edit screen — skip straight to the
      // dashboard if this doctor already has a profile.
      const { data: existing } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (existing) {
        router.replace('/doctor/dashboard');
        return;
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

  const specialties = Array.from(new Set(taxonomy.map((t) => t.specialty)));
  const subSpecialties = taxonomy
    .filter((t) => t.specialty === specialty)
    .map((t) => t.sub_specialty);

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

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!specialty || !subSpecialty) {
      setError('Please select both a specialty and a sub-specialty.');
      return;
    }

    const parsedRate = parseFloat(rate);
    if (!rate || Number.isNaN(parsedRate) || parsedRate < 0) {
      setError('Rate must be a positive number.');
      return;
    }

    if (!location.trim()) {
      setError('Please enter your clinic location.');
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

    const { error: insertError } = await supabase.from('doctors').insert({
      id: session.user.id, // must equal auth.uid() — required by doctors_insert_own RLS policy
      name: name.trim(),
      credentials: credentialFileName || null,
      specialty,
      sub_specialty: subSpecialty,
      rate: parsedRate,
      location: location.trim(),
      // hmo_accreditations left to DB default '{}' — seeded via Task 1.4
      // verified left to DB default true
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.replace('/doctor/dashboard');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 mb-8">
        <span className="text-lg font-bold text-white">
          <span className="text-indigo-400">Civic</span>Access
        </span>
        <h1 className="mt-1 text-2xl font-semibold text-white">Set up your doctor profile</h1>
        <p className="mt-1 text-sm text-slate-400">
          This is a one-time step. You&apos;ll land on your dashboard every time after this.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-lg flex-col gap-5"
      >
        {/* Full name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-name" className="text-sm font-medium text-slate-300">
            Full name <span className="text-red-400">*</span>
          </label>
          <input
            id="doctor-name"
            type="text"
            placeholder="Dr. Maria Santos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition"
          />
        </div>

        {/* Credential file */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-credentials" className="text-sm font-medium text-slate-300">
            Credential file
            <span className="ml-1.5 text-xs font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="doctor-credentials"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-400
              file:mr-4 file:rounded-lg file:border-0
              file:bg-slate-700 file:px-4 file:py-2 file:text-sm
              file:font-medium file:text-slate-200
              hover:file:bg-slate-600 file:cursor-pointer file:transition"
          />
          {credentialFileName && (
            <p className="text-xs text-slate-400">Selected: <span className="text-white">{credentialFileName}</span></p>
          )}
          <p className="text-xs text-slate-500">
            Demo mode — only the filename is stored. No actual file is uploaded anywhere.
          </p>
        </div>

        {/* Specialty */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-specialty" className="text-sm font-medium text-slate-300">
            Specialty <span className="text-red-400">*</span>
          </label>
          <select
            id="doctor-specialty"
            value={specialty}
            onChange={(e) => handleSpecialtyChange(e.target.value)}
            required
            className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition disabled:opacity-50"
          >
            <option value="">Select specialty</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {specialties.length === 0 && !error && (
            <p className="text-xs text-amber-400">
              No specialties found — make sure the taxonomy table has been seeded.
            </p>
          )}
        </div>

        {/* Sub-specialty */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-sub-specialty" className="text-sm font-medium text-slate-300">
            Sub-specialty <span className="text-red-400">*</span>
          </label>
          <select
            id="doctor-sub-specialty"
            value={subSpecialty}
            onChange={(e) => setSubSpecialty(e.target.value)}
            required
            disabled={!specialty}
            className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {specialty ? 'Select sub-specialty' : 'Pick a specialty first'}
            </option>
            {subSpecialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Rate */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-rate" className="text-sm font-medium text-slate-300">
            Consultation rate (PHP) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">₱</span>
            <input
              id="doctor-rate"
              type="number"
              min="0"
              step="0.01"
              placeholder="500.00"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-800/60 py-2.5 pl-8 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition"
            />
          </div>
        </div>

        {/* Clinic location */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctor-location" className="text-sm font-medium text-slate-300">
            Clinic location <span className="text-red-400">*</span>
          </label>
          <input
            id="doctor-location"
            type="text"
            placeholder="e.g. 3rd Floor, XYZ Medical Center, Angeles City"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          id="doctor-profile-submit"
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {submitting ? 'Saving…' : 'Save profile and continue →'}
        </button>
      </form>
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
