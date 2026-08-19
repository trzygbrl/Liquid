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
          className={`h-2.5 rounded-full transition-all duration-200 ${
            n === step
              ? 'bg-violet-600 w-6'
              : n < step
              ? 'bg-violet-300 w-2.5'
              : 'bg-slate-200 w-2.5'
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
            className={`min-w-[6.5rem] flex-1 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition active:scale-[0.97] focus:outline-none ${
              isSelected
                ? 'border-violet-600 bg-violet-50 text-violet-800 ring-2 ring-violet-500/20 shadow-sm'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
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
      }

      setPrefillLoading(false);
    }

    prefill();
  }, []);

  // ── Switch between Myself and Family Member
  function handleTargetChange(target: ConsultationTarget) {
    if (target === consultationTarget) return;

    if (consultationTarget === 'myself') {
      setSavedUserProfile({ name, age, sex, location, hmoProvider });
      setName(savedFamilyData.name);
      setAge(savedFamilyData.age);
      setSex(savedFamilyData.sex);
      setLocation(savedFamilyData.location);
      setHmoProvider(savedFamilyData.hmoProvider);
    } else {
      setSavedFamilyData({ name, age, sex, location, hmoProvider });
      setName(savedUserProfile.name);
      setAge(savedUserProfile.age);
      setSex(savedUserProfile.sex);
      setLocation(savedUserProfile.location);
      setHmoProvider(savedUserProfile.hmoProvider);
    }

    setConsultationTarget(target);
    setStepError(null);
  }

  // ── Validation per step
  function validateStep(s: 1 | 2 | 3): boolean {
    setStepError(null);

    if (s === 1) {
      if (!name.trim()) {
        setStepError(
          consultationTarget === 'family_member'
            ? 'Please enter the family member’s name.'
            : 'Please enter your name.'
        );
        return false;
      }
      const ageNum = parseInt(age, 10);
      if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 129) {
        setStepError('Please enter a valid age between 1 and 129.');
        return false;
      }
      if (!sex) {
        setStepError('Please select a sex.');
        return false;
      }
      if (!location.trim()) {
        setStepError('Please enter a location (city or province).');
        return false;
      }
      return true;
    }

    if (s === 2) {
      if (hmoProvider === undefined) {
        setStepError('Please select an HMO option or choose "None or Cash".');
        return false;
      }
      return true;
    }

    if (s === 3) {
      if (!symptomText.trim() || symptomText.trim().length < 3) {
        setStepError('Please describe what symptoms are being experienced.');
        return false;
      }
      return true;
    }

    return true;
  }

  function handleNext() {
    if (!validateStep(step)) return;
    if (step < 3) setStep((s) => (s + 1) as 2 | 3);
  }

  function handleBack() {
    setStepError(null);
    if (step > 1) setStep((s) => (s - 1) as 1 | 2);
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload: IntakeCompleteData = {
      name: name.trim(),
      age: parseInt(age, 10),
      sex: sex!,
      location: location.trim(),
      hmoProvider: hmoProvider ?? null,
      symptomText: symptomText.trim(),
      isForFamilyMember: consultationTarget === 'family_member',
    };

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && consultationTarget === 'myself') {
        const { error: upsertError } = await supabase
          .from('patients')
          .upsert(
            {
              id: session.user.id,
              name: payload.name,
              age: payload.age,
              sex: payload.sex,
              location: payload.location,
              hmo_provider: payload.hmoProvider,
            },
            { onConflict: 'id' }
          );

        if (upsertError) {
          console.warn('[IntakeFlow] Profile save warning:', upsertError.message);
        }
      }

      setDone(true);
      onComplete?.(payload);
    } catch (err: any) {
      console.error('[IntakeFlow] Submit error:', err);
      setSubmitError('Unable to complete intake. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render states ───────────────────────────────────────────────────────

  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl shadow-sm">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-900">Got it — we're on it.</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your information has been saved. We're matching you with the right specialist now.
        </p>
      </div>
    );
  }

  const isFamily = consultationTarget === 'family_member';

  return (
    <div className="flex flex-col gap-6">
      {/* ── Step indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Step {step} of 3</span>
        <StepDots step={step} />
      </div>

      {/* ── Step 1: Basics & Family Member Toggle (Task 5.2) ──────────────── */}
      {step === 1 && (
        <div key="step-1" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Let's start with a few basics</h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              This helps our clinical AI match the right pediatric, adult, or geriatric specialist.
            </p>
          </div>

          {/* ── "Who is this for?" Toggle (Task 5.2) ── */}
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-3">
              Who is this consultation for?
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="intake-target-myself"
                type="button"
                onClick={() => handleTargetChange('myself')}
                className={`fluid-hover flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold focus:outline-none ${
                  !isFamily
                    ? 'border-transparent bg-[#2A2338] text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>👤 Myself</span>
              </button>

              <button
                id="intake-target-family"
                type="button"
                onClick={() => handleTargetChange('family_member')}
                className={`fluid-hover flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold focus:outline-none ${
                  isFamily
                    ? 'border-transparent bg-[#2A2338] text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>👨‍👩‍👧 A family member</span>
              </button>
            </div>

            {isFamily && (
              <div className="mt-3.5 rounded-2xl border border-violet-200/70 bg-violet-50/90 p-3.5 text-xs leading-relaxed text-violet-900 flex items-start gap-2.5 animate-fade-slide-up">
                <span className="text-sm">ℹ</span>
                <span className="font-medium">
                  Enter the details of your family member (e.g. child or parent). Our AI will tailor specialty mapping specifically to their age and demographics.
                </span>
              </div>
            )}
          </div>

          {/* Full name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="intake-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isFamily ? "Family member's full name" : 'Your full name'}
            </label>
            <input
              id="intake-name"
              type="text"
              placeholder={isFamily ? "e.g. Ramon Santos (Father) or Chloe Santos (Daughter)" : 'e.g. Maria Santos'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* Age */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="intake-age" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isFamily ? "Family member's age" : 'Your age'}
              </label>
              {isFamily && (
                <span className="text-xs text-violet-700 font-bold">
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Sex — button group */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
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
            <label htmlFor="intake-location" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isFamily ? 'City or Province' : 'Location'}
              <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">(city or province)</span>
            </label>
            <input
              id="intake-location"
              type="text"
              placeholder="e.g. Angeles City, Pampanga"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: HMO ────────────────────────────────────────────────── */}
      {step === 2 && (
        <div key="step-2" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {isFamily ? 'Does your family member have HMO coverage?' : 'Do you have HMO coverage?'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {isFamily
                ? 'This helps us show doctors accredited with their HMO, or cash consultation rates.'
                : 'This helps us show doctors who accept your HMO.'}
            </p>
          </div>

          {/* HMO button group */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Select one</span>
            <ButtonGroup
              options={HMO_OPTIONS}
              value={hmoProvider as string | null | undefined}
              onChange={(v) => setHmoProvider(v as string | null)}
              idPrefix="intake-hmo"
            />
          </div>

          {hmoProvider === null && (
            <p className="text-xs text-slate-600 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200 font-medium animate-fade-slide-up">
              No problem — we'll show you doctors with direct cash consultation rates.
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Symptoms ────────────────────────────────────────────── */}
      {step === 3 && (
        <div key="step-3" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {isFamily ? `What is ${name || 'your family member'} feeling?` : 'What are you feeling?'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Tell us in your own words (English or Tagalog).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="intake-symptoms" className="text-xs font-bold uppercase tracking-wider text-slate-700">
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 resize-none leading-relaxed"
            />
          </div>

          {submitError && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-medium text-rose-700">
              {submitError}
            </p>
          )}
        </div>
      )}

      {/* ── Per-step inline validation error */}
      {stepError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-medium text-rose-700">
          {stepError}
        </p>
      )}

      {/* ── Navigation buttons ─────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 pt-2 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
        {step > 1 && (
          <button
            id="intake-back"
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="fluid-hover rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
          >
            ← Back
          </button>
        )}

        {step < 3 ? (
          <button
            id={`intake-next-step${step}`}
            type="button"
            onClick={handleNext}
            className="fluid-hover rounded-2xl bg-[#2A2338] px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md hover:bg-[#1E192C] focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            Continue →
          </button>
        ) : (
          <button
            id="intake-submit"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || symptomText.trim().length < 3}
            className="fluid-hover rounded-2xl bg-[#2A2338] px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md hover:bg-[#1E192C] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            {submitting ? 'Matching Specialist…' : 'Find the Right Doctor →'}
          </button>
        )}
      </div>
    </div>
  );
}
