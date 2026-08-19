'use client';

// src/components/IntakeFlow.tsx
//
// Patient Intake Flow — 3-Step Guided Intake
//
// Task 5.2: "Booking for a family member" toggle in Step 1.
// Supports booking for self vs. a family member (e.g. child or elderly parent).
// Clinical triage and specialist matching depends on the person's actual age and sex.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type Sex = 'male' | 'female' | 'other';
type ConsultationTarget = 'myself' | 'family_member';

// null = patient chose "no HMO"; undefined = hasn't answered yet
type HmoSelection = string | null | undefined;

export interface IntakeCompleteData {
  name: string;
  age: number;
  sex: Sex;
  location: string;
  hmoProvider: string | null;
  symptomText: string;
  isForFamilyMember?: boolean;
}

interface IntakeFlowProps {
  onComplete?: (data: IntakeCompleteData) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HMO_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'Maxicare', value: 'Maxicare' },
  { label: 'Intellicare', value: 'Intellicare' },
  { label: 'Medicard', value: 'Medicard' },
  { label: 'PhilCare', value: 'PhilCare' },
  { label: 'None or Cash', value: null },
];

const SEX_OPTIONS: { label: string; value: Sex }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Step dot indicator
function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`h-2 w-2 rounded-full transition-all duration-200 ${
            n === step
              ? 'bg-teal-400 scale-125'
              : n < step
              ? 'bg-teal-600'
              : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

// Reusable large-tap button group
function ButtonGroup<T extends string | null>({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: { label: string; value: T }[];
  value: T | undefined;
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => {
        const key = opt.value ?? '__null__';
        const isSelected = value === opt.value;
        return (
          <button
            key={key}
            id={`${idPrefix}-${key}`}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`min-w-[6rem] flex-1 rounded-xl border px-5 py-4 text-base font-medium transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
              isSelected
                ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IntakeFlow({ onComplete }: IntakeFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Target toggle (Myself vs Family Member) — Task 5.2
  const [consultationTarget, setConsultationTarget] = useState<ConsultationTarget>('myself');

  // Stored state for switching cleanly back and forth
  const [savedUserProfile, setSavedUserProfile] = useState<{
    name: string;
    age: string;
    sex: Sex | undefined;
    location: string;
    hmoProvider: HmoSelection;
  }>({
    name: '',
    age: '',
    sex: undefined,
    location: '',
    hmoProvider: undefined,
  });

  const [savedFamilyData, setSavedFamilyData] = useState<{
    name: string;
    age: string;
    sex: Sex | undefined;
    location: string;
    hmoProvider: HmoSelection;
  }>({
    name: '',
    age: '',
    sex: undefined,
    location: '',
    hmoProvider: undefined,
  });

  // Active form fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [hmoProvider, setHmoProvider] = useState<HmoSelection>(undefined);
  const [symptomText, setSymptomText] = useState('');

  // Per-step inline validation errors
  const [stepError, setStepError] = useState<string | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Prefill flag
  const [prefillLoading, setPrefillLoading] = useState(true);

  // ── Prefill user profile from existing patients row on mount
  useEffect(() => {
    async function prefill() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPrefillLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from('patients')
        .select('name, age, sex, location, hmo_provider')
        .eq('id', session.user.id)
        .maybeSingle();

      if (existing) {
        const prof = {
          name: existing.name || '',
          age: existing.age ? String(existing.age) : '',
          sex: existing.sex && ['male', 'female', 'other'].includes(existing.sex)
            ? (existing.sex as Sex)
            : undefined,
          location: existing.location || '',
          hmoProvider: 'hmo_provider' in existing ? (existing.hmo_provider as string | null) : undefined,
        };

        setSavedUserProfile(prof);
        setName(prof.name);
        setAge(prof.age);
        setSex(prof.sex);
        setLocation(prof.location);
        setHmoProvider(prof.hmoProvider);

        // Pre-fill location default for family member too
        if (existing.location) {
          setSavedFamilyData((prev) => ({ ...prev, location: existing.location }));
        }
      }
      setPrefillLoading(false);
    }
    prefill();
  }, []);

  // ── Toggle Handler between Myself and Family Member (Task 5.2)
  function handleTargetChange(target: ConsultationTarget) {
    if (target === consultationTarget) return;

    if (consultationTarget === 'myself') {
      // Save current input values into savedUserProfile
      setSavedUserProfile({ name, age, sex, location, hmoProvider });
      // Switch to family member inputs
      setName(savedFamilyData.name);
      setAge(savedFamilyData.age);
      setSex(savedFamilyData.sex);
      setLocation(savedFamilyData.location || location);
      setHmoProvider(savedFamilyData.hmoProvider);
    } else {
      // Save current input values into savedFamilyData
      setSavedFamilyData({ name, age, sex, location, hmoProvider });
      // Restore user's personal profile
      setName(savedUserProfile.name);
      setAge(savedUserProfile.age);
      setSex(savedUserProfile.sex);
      setLocation(savedUserProfile.location);
      setHmoProvider(savedUserProfile.hmoProvider);
    }

    setConsultationTarget(target);
    setStepError(null);
  }

  // ── Per-step validation helpers
  function validateStep1(): string | null {
    const isFamily = consultationTarget === 'family_member';
    if (!name.trim()) {
      return isFamily ? "Please enter your family member's full name." : 'Please enter your full name.';
    }
    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 129) {
      return isFamily
        ? "Please enter your family member's age (1–129)."
        : 'Please enter your age (1–129).';
    }
    if (!sex) {
      return isFamily ? "Please select your family member's sex." : 'Please select your sex.';
    }
    if (!location.trim()) {
      return 'Please enter a city or province location.';
    }
    return null;
  }

  function validateStep2(): string | null {
    if (hmoProvider === undefined) {
      return consultationTarget === 'family_member'
        ? "Please select your family member's HMO or choose \"None or Cash.\""
        : 'Please select your HMO or choose "None or Cash."';
    }
    return null;
  }

  function validateStep3(): string | null {
    if (symptomText.trim().length < 3) {
      return 'Please tell us what you or your family member are feeling (at least a few words).';
    }
    return null;
  }

  // ── Navigation
  function handleNext() {
    setStepError(null);
    const err = step === 1 ? validateStep1() : validateStep2();
    if (err) {
      setStepError(err);
      return;
    }
    setStep((s) => (s === 1 ? 2 : 3) as 1 | 2 | 3);
  }

  function handleBack() {
    setStepError(null);
    setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3);
  }

  // ── Final submit
  async function handleSubmit() {
    setSubmitError(null);
    const err = validateStep3();
    if (err) {
      setStepError(err);
      return;
    }

    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSubmitError('Your session expired — please log in again.');
      setSubmitting(false);
      return;
    }

    const parsedAge = parseInt(age, 10);

    // Only update the account owner's persistent profile if booking for self
    if (consultationTarget === 'myself') {
      const { error } = await supabase.from('patients').upsert({
        id: session.user.id,
        name: name.trim(),
        age: parsedAge,
        sex: sex as Sex,
        location: location.trim(),
        hmo_provider: hmoProvider === undefined ? null : hmoProvider,
      });

      if (error) {
        setSubmitting(false);
        setSubmitError(`Something went wrong saving your info: ${error.message}. Please try again.`);
        return;
      }
    }

    setSubmitting(false);

    const completeData: IntakeCompleteData = {
      name: name.trim(),
      age: parsedAge,
      sex: sex as Sex,
      location: location.trim(),
      hmoProvider: hmoProvider === undefined ? null : hmoProvider,
      symptomText: symptomText.trim(),
      isForFamilyMember: consultationTarget === 'family_member',
    };

    if (onComplete) {
      onComplete(completeData);
    } else {
      setDone(true);
    }
  }

  // ─── Render states ───────────────────────────────────────────────────────

  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-teal-500" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-teal-500/20 bg-slate-900/60 px-8 py-12 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-teal-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Got it — we're on it.</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Your information has been saved. We're finding the right specialist for you now.
        </p>
      </div>
    );
  }

  const isFamily = consultationTarget === 'family_member';

  return (
    <div className="flex flex-col gap-6">
      {/* ── Step indicator */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">Step {step} of 3</span>
        <StepDots step={step} />
      </div>

      {/* ── Step 1: Basics & Family Member Toggle (Task 5.2) ──────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Let's start with a few basics</h2>
            <p className="mt-1 text-sm text-slate-400">
              This helps our AI navigation match the right pediatric, adult, or geriatric specialist.
            </p>
          </div>

          {/* ── "Who is this for?" Toggle (Task 5.2) ── */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
              Who is this consultation for?
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="intake-target-myself"
                type="button"
                onClick={() => handleTargetChange('myself')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition active:scale-[0.98] focus:outline-none ${
                  !isFamily
                    ? 'border-teal-500 bg-teal-500/20 text-teal-300 shadow-md ring-1 ring-teal-500/30'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span>👤 Myself</span>
              </button>

              <button
                id="intake-target-family"
                type="button"
                onClick={() => handleTargetChange('family_member')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition active:scale-[0.98] focus:outline-none ${
                  isFamily
                    ? 'border-teal-500 bg-teal-500/20 text-teal-300 shadow-md ring-1 ring-teal-500/30'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span>👨‍👩‍👧 A family member</span>
              </button>
            </div>

            {isFamily && (
              <div className="mt-3.5 rounded-xl border border-teal-500/20 bg-teal-500/10 p-3 text-xs leading-relaxed text-teal-200 flex items-start gap-2">
                <span className="text-sm">ℹ</span>
                <span>
                  Enter the details of your family member (e.g. child or parent). Our AI will tailor specialty mapping specifically to their age and demographics.
                </span>
              </div>
            )}
          </div>

          {/* Full name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="intake-name" className="text-sm font-medium text-slate-300">
              {isFamily ? "Family member's full name" : 'Your full name'}
            </label>
            <input
              id="intake-name"
              type="text"
              placeholder={isFamily ? "e.g. Ramon Santos (Father) or Chloe Santos (Daughter)" : 'e.g. Maria Santos'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-4 text-base text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition"
            />
          </div>

          {/* Age */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="intake-age" className="text-sm font-medium text-slate-300">
                {isFamily ? "Family member's age" : 'Your age'}
              </label>
              {isFamily && (
                <span className="text-[11px] text-slate-400">
                  Infants, children & seniors welcomed
                </span>
              )}
            </div>
            <input
              id="intake-age"
              type="number"
              min={1}
              max={129}
              placeholder={isFamily ? 'e.g. 5 (for child) or 72 (for parent)' : 'e.g. 45'}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-4 text-base text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Sex — button group */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-300">
              {isFamily ? "Family member's sex" : 'Your sex'}
            </span>
            <ButtonGroup
              options={SEX_OPTIONS}
              value={sex}
              onChange={setSex}
              idPrefix="intake-sex"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-2">
            <label htmlFor="intake-location" className="text-sm font-medium text-slate-300">
              {isFamily ? 'City or Province' : 'Location'}
              <span className="ml-1.5 text-xs font-normal text-slate-500">(city or province)</span>
            </label>
            <input
              id="intake-location"
              type="text"
              placeholder="e.g. Angeles City, Pampanga"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-4 text-base text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: HMO ────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isFamily ? 'Does your family member have HMO coverage?' : 'Do you have HMO coverage?'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isFamily
                ? 'This helps us show doctors accredited with their HMO, or cash consultation rates.'
                : 'This helps us show doctors who accept your HMO.'}
            </p>
          </div>

          {/* HMO button group */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-300">Select one</span>
            <ButtonGroup
              options={HMO_OPTIONS}
              value={hmoProvider as string | null | undefined}
              onChange={(v) => setHmoProvider(v as string | null)}
              idPrefix="intake-hmo"
            />
          </div>

          {hmoProvider === null && (
            <p className="text-xs text-slate-500">
              No problem — we'll show you doctors with direct cash consultation rates.
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Symptoms ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isFamily ? `What is ${name || 'your family member'} feeling?` : 'What are you feeling?'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Tell us in your own words (English or Tagalog).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="intake-symptoms" className="text-sm font-medium text-slate-300">
              Describe symptoms
            </label>
            <textarea
              id="intake-symptoms"
              rows={6}
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder={
                isFamily
                  ? `Halimbawa: "Masakit ang dibdib ng tatay ko at hirap huminga." o "May lagnat at ubo ang anak ko."\n\nYou can write in English or Tagalog.`
                  : `Sabihin mo lang kung ano ang nararamdaman mo. Halimbawa: "Malabo at namumula ang mata ko."\n\nYou can write in English or Tagalog.`
              }
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-4 text-base text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition resize-none leading-relaxed"
            />
          </div>

          {submitError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm text-red-400">
              {submitError}
            </p>
          )}
        </div>
      )}

      {/* ── Per-step inline validation error */}
      {stepError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm text-red-400">
          {stepError}
        </p>
      )}

      {/* ── Navigation buttons ─────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
        {step > 1 && (
          <button
            id="intake-back"
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="text-sm font-medium text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            ← Back
          </button>
        )}

        {step < 3 ? (
          <button
            id={`intake-next-step${step}`}
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-teal-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-teal-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            Continue
          </button>
        ) : (
          <button
            id="intake-submit"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || symptomText.trim().length < 3}
            className="rounded-xl bg-teal-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            {submitting ? 'Saving…' : 'Find the right doctor →'}
          </button>
        )}
      </div>
    </div>
  );
}
