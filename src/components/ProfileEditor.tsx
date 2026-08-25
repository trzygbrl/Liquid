'use client';

// src/components/ProfileEditor.tsx
//
// Lets a doctor update their profile (name, credentials, specialty,
// sub-specialty, HMO accreditations) after initial onboarding is complete
// (Task: Doctor Portal Profile Editing). Reuses profile-setup/page.tsx's
// field set and specialty/sub-specialty taxonomy pattern, but writes via
// `update` (the row already exists) instead of the onboarding `upsert`.
// Collapsed by default behind an "Edit Profile" toggle.

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { findOrCreateTaxonomyEntry } from '@/lib/taxonomySelfService';

type TaxonomyRow = { specialty: string; sub_specialty: string };

// Sentinel selected value for "+ Other (please specify)" in the specialty
// and sub-specialty dropdowns (Task 7.3 -- doctor self-service taxonomy).
const OTHER_VALUE = '__other__';

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
  // Real required text (Task 7.2) -- the PRC license number this app checks
  // via HITL review lives in this field; there is no separate
  // license_number column.
  const [credentials, setCredentials] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subSpecialty, setSubSpecialty] = useState('');
  // Free-text names entered when specialty/sub-specialty is OTHER_VALUE
  // (Task 7.3 -- doctor self-service taxonomy addition).
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [customSubSpecialty, setCustomSubSpecialty] = useState('');
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
        setCredentials(doctorRes.data.credentials ?? '');
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

  // Derive unique specialty list straight from taxonomy -- specialties with no
  // sub-specialty entries (e.g. 'General Medicine') already surface correctly
  // from this fetch, no hardcoded prepend needed.
  const specialties = Array.from(new Set(taxonomy.map((t) => t.specialty)));
  const subSpecialties = taxonomy
    .filter((t) => t.specialty === specialty)
    .map((t) => t.sub_specialty);

  const isNewSpecialty = specialty === OTHER_VALUE;
  const isNewSubSpecialty = subSpecialty === OTHER_VALUE;
  const isGeneralPractice = !isNewSpecialty && specialty !== '' && subSpecialties.length === 0;

  function handleSpecialtyChange(value: string) {
    setSpecialty(value);
    setSubSpecialty('');
    setCustomSpecialty('');
    setCustomSubSpecialty('');
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

    const subSpecialtyRequired = !isNewSpecialty && !isGeneralPractice;
    if (
      !name.trim() ||
      !credentials.trim() ||
      !specialty ||
      (isNewSpecialty && !customSpecialty.trim()) ||
      (!isNewSpecialty && subSpecialtyRequired && !subSpecialty) ||
      (!isNewSpecialty && isNewSubSpecialty && !customSubSpecialty.trim())
    ) {
      setSaveError(
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

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaveError('Your session expired. Please log in again.');
      setSaving(false);
      return;
    }

    // Resolve any "+ Other (please specify)" entry into a real
    // specialty_taxonomy row *before* the doctors update below -- the
    // check_doctor_specialty_taxonomy trigger (migration 0005) validates the
    // (specialty, sub_specialty) pair against that table on every update
    // (Task 7.3).
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
        setSaveError(err instanceof Error ? err.message : 'Could not save the new specialty. Please try again.');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('doctors')
      .update({
        name: name.trim(),
        credentials: credentials.trim(),
        specialty: resolvedSpecialty,
        sub_specialty: resolvedSubSpecialty,
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
        {loadError}
      </div>
    );
  }

  return (
    <section className="card p-6 sm:p-7">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">Practitioner Profile</h2>
          <p className="text-sm text-slate-600 mt-1">
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Credentials / PRC license number */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-doctor-credentials" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Credentials & PRC License Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="edit-doctor-credentials"
              type="text"
              placeholder="PRC Lic. No. 123456 | MD, FPAFP"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="text-xs text-slate-500">
              Changing this does not affect your current verification status.
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Select specialty</option>
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={OTHER_VALUE}>+ Other (please specify)</option>
            </select>
          </div>

          {/* New specialty name, shown instead of the sub-specialty picker below
              when "+ Other" is selected above -- a brand-new specialty has no
              existing sub-specialty entries to pick from. */}
          {isNewSpecialty && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-doctor-custom-specialty" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                New specialty name <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-doctor-custom-specialty"
                type="text"
                placeholder="e.g. Sports Medicine"
                value={customSpecialty}
                onChange={(e) => setCustomSpecialty(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
              <label htmlFor="edit-doctor-custom-sub-specialty" className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                Sub-specialty
                <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="edit-doctor-custom-sub-specialty"
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
                onChange={(e) => {
                  setSubSpecialty(e.target.value);
                  if (e.target.value !== OTHER_VALUE) setCustomSubSpecialty('');
                }}
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
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
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
              className="rounded-2xl bg-brand-600 px-6 py-3.5 min-h-[48px] text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
