'use client';

// src/components/ProfileEditor.tsx
//
// Lets a doctor update their profile (name, credentials, specialty,
// sub-specialty, HMO accreditations) after initial onboarding is complete
// (Task: Doctor Portal Profile Editing). Reuses profile-setup/page.tsx's
// field set and specialty/sub-specialty taxonomy pattern, but writes via
// `update` (the row already exists) instead of the onboarding `upsert`.
// Collapsed by default behind an "Edit Profile" toggle.

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

type TaxonomyRow = { specialty: string; sub_specialty: string };

// Same canonical HMO list used across intake/seeding (IntakeFlow.tsx's
// HMO_OPTIONS, scripts/gen_seed.mjs's HMOS) -- hmo_accreditations has no
// prior editing UI anywhere in the app, so this is the first place it's set.
const HMO_OPTIONS = ['Maxicare', 'Intellicare', 'Medicard', 'PhilCare'];

export default function ProfileEditor() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([]);

  const [name, setName] = useState('');
  const [credentialFileName, setCredentialFileName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subSpecialty, setSubSpecialty] = useState('');
  const [hmoAccreditations, setHmoAccreditations] = useState<string[]>([]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const [doctorRes, taxonomyRes] = await Promise.all([
        supabase
          .from('doctors')
          .select('name, credentials, specialty, sub_specialty, hmo_accreditations')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('specialty_taxonomy')
          .select('specialty, sub_specialty')
          .order('specialty')
          .order('sub_specialty'),
      ]);

      if (doctorRes.error) {
        setLoadError(`Could not load your profile: ${doctorRes.error.message}`);
        setLoading(false);
        return;
      }
      if (taxonomyRes.error) {
        setLoadError('Could not load the specialty list.');
        setLoading(false);
        return;
      }

      if (doctorRes.data) {
        setName(doctorRes.data.name ?? '');
        setCredentialFileName(doctorRes.data.credentials ?? '');
        setSpecialty(doctorRes.data.specialty ?? '');
        setSubSpecialty(doctorRes.data.sub_specialty ?? '');
        setHmoAccreditations(
          Array.isArray(doctorRes.data.hmo_accreditations) ? doctorRes.data.hmo_accreditations : []
        );
      }
      setTaxonomy(taxonomyRes.data ?? []);
      setLoading(false);
    }

    load();
  }, []);

  // Derive unique specialty list from taxonomy, plus 'General Practice' which has no
  // sub-specialty entries and therefore won't appear in the taxonomy-derived list.
  const specialties = [
    'General Practice',
    ...Array.from(new Set(taxonomy.map((t) => t.specialty))),
  ];
  const subSpecialties = taxonomy
    .filter((t) => t.specialty === specialty)
    .map((t) => t.sub_specialty);
  const isGeneralPractice = specialty !== '' && subSpecialties.length === 0;

  function handleSpecialtyChange(value: string) {
    setSpecialty(value);
    setSubSpecialty('');
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCredentialFileName(file.name);
  }

  function toggleHmo(hmo: string) {
    setHmoAccreditations((prev) =>
      prev.includes(hmo) ? prev.filter((h) => h !== hmo) : [...prev, hmo]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const subSpecialtyRequired = !isGeneralPractice;
    if (!name.trim() || !specialty || (subSpecialtyRequired && !subSpecialty)) {
      setSaveError(
        subSpecialtyRequired
          ? 'Please fill in your name, specialty, and sub-specialty.'
          : 'Please fill in your name and specialty.'
      );
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaveError('Your session expired — please log in again.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('doctors')
      .update({
        name: name.trim(),
        credentials: credentialFileName || null,
        specialty,
        sub_specialty: subSpecialty || null,
        hmo_accreditations: hmoAccreditations,
      })
      .eq('id', session.user.id);

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaveSuccess(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">Practitioner Profile</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Update your name, credentials, specialty, and HMO accreditations.
          </p>
        </div>
        <span className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
          {expanded ? 'Hide' : 'Edit Profile'}
        </span>
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4.5 border-t border-slate-100 pt-6">
          {/* Full name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-doctor-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Full name <span className="text-rose-500">*</span>
            </label>
            <input
              id="edit-doctor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* Credential file */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-doctor-credentials" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Credential File (License or Certificate)
              <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
            </label>
            <input
              id="edit-doctor-credentials"
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
              <p className="text-xs text-violet-700 font-medium">Current: <span>{credentialFileName}</span></p>
            )}
            <p className="text-xs text-slate-400">
              Demo mode — only the filename is stored. No actual file is uploaded.
            </p>
          </div>

          {/* Specialty */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-doctor-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Primary Specialty <span className="text-rose-500">*</span>
            </label>
            <select
              id="edit-doctor-specialty"
              value={specialty}
              onChange={(e) => handleSpecialtyChange(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Select specialty</option>
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sub-specialty */}
          {!isGeneralPractice && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-doctor-sub-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Sub-specialty{' '}
                {specialty && subSpecialties.length > 0 ? (
                  <span className="text-rose-500">*</span>
                ) : (
                  <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
                )}
              </label>
              <select
                id="edit-doctor-sub-specialty"
                value={subSpecialty}
                onChange={(e) => setSubSpecialty(e.target.value)}
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

          {/* HMO accreditations */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              HMO Accreditations
              <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {HMO_OPTIONS.map((hmo) => {
                const selected = hmoAccreditations.includes(hmo);
                return (
                  <button
                    key={hmo}
                    type="button"
                    onClick={() => toggleHmo(hmo)}
                    className={`rounded-2xl border px-4 py-2.5 text-xs font-bold transition ${
                      selected
                        ? 'border-violet-600 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {hmo}
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && (
            <p className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-700">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-medium text-emerald-700">
              Profile updated.
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              id="save-profile-submit"
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[#2A2338] px-6 py-3.5 min-h-[48px] text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E192C] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
