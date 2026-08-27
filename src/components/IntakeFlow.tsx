'use client';

// src/components/IntakeFlow.tsx
//
// Patient Intake Flow. 3-Step Guided Intake
//
// Task 5.2: "Booking for a family member" toggle in Step 1.
// Supports booking for self vs. a family member (e.g. child or elderly parent).
// Clinical triage and specialist matching depends on the person's actual age and sex.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { IconCheck, IconInfo, IconMic, IconWarning, IconShield } from '@/components/Icons';
import { evaluateSymptomPlausibility, type SymptomValidationResult } from '@/lib/symptomValidation';
import { useVoiceInput } from '@/hooks/useVoiceInput';

// Types
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
  // When set, the wizard seeds its fields from this data instead of the blank
  // defaults / DB prefill -- used to return the user directly to a given step
  // (e.g. symptoms) with their prior answers intact, instead of a full reset.
  initialData?: IntakeCompleteData | null;
  initialStep?: 1 | 2 | 3;
  onRestart?: () => void;
}

// Constants
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

// Helpers
// Step dot indicator
function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`h-2.5 rounded-full transition-all duration-200 ${
            n === step
              ? 'bg-brand-600 w-6'
              : n < step
              ? 'bg-brand-300 w-2.5'
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
                ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20 shadow-sm'
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

// Component
export default function IntakeFlow({ onComplete, initialData = null, initialStep = 1, onRestart }: IntakeFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);

  // Target toggle (Myself vs Family Member). Task 5.2
  const [consultationTarget, setConsultationTarget] = useState<ConsultationTarget>(
    initialData?.isForFamilyMember ? 'family_member' : 'myself'
  );

  // Stored state for switching cleanly back and forth. Seeded from
  // initialData (keyed by which target it belonged to) so backing up to
  // Step 1 and toggling Myself/Family still round-trips correctly on an
  // edit-in-place re-entry.
  const blankProfile = { name: '', age: '', sex: undefined as Sex | undefined, location: '', hmoProvider: undefined as HmoSelection };
  const [savedUserProfile, setSavedUserProfile] = useState<{
    name: string;
    age: string;
    sex: Sex | undefined;
    location: string;
    hmoProvider: HmoSelection;
  }>(
    initialData && !initialData.isForFamilyMember
      ? { name: initialData.name, age: String(initialData.age), sex: initialData.sex, location: initialData.location, hmoProvider: initialData.hmoProvider }
      : blankProfile
  );

  const [savedFamilyData, setSavedFamilyData] = useState<{
    name: string;
    age: string;
    sex: Sex | undefined;
    location: string;
    hmoProvider: HmoSelection;
  }>(
    initialData && initialData.isForFamilyMember
      ? { name: initialData.name, age: String(initialData.age), sex: initialData.sex, location: initialData.location, hmoProvider: initialData.hmoProvider }
      : blankProfile
  );

  // Active form fields
  const [name, setName] = useState(initialData?.name ?? '');
  const [age, setAge] = useState(initialData ? String(initialData.age) : '');
  const [sex, setSex] = useState<Sex | undefined>(initialData?.sex);
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [hmoProvider, setHmoProvider] = useState<HmoSelection>(initialData ? initialData.hmoProvider : undefined);
  const [symptomText, setSymptomText] = useState(initialData?.symptomText ?? '');

  // Per-step inline validation errors
  const [stepError, setStepError] = useState<string | null>(null);

  // AI Guardrail states (Strike 1 warning & Strike 2 disqualification)
  const [invalidAttempts, setInvalidAttempts] = useState<number>(0);
  const [plausibilityWarning, setPlausibilityWarning] = useState<SymptomValidationResult | null>(null);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset all state back to clean step 1
  function handleFullReset() {
    setStep(1);
    setInvalidAttempts(0);
    setPlausibilityWarning(null);
    setIsDisqualified(false);
    setSymptomText('');
    setStepError(null);
    setSubmitError(null);
    onRestart?.();
  }

  // Prefill flag -- skipped entirely when initialData is already supplied
  const [prefillLoading, setPrefillLoading] = useState(!initialData);

  // Voice Input (Web Speech API) - Feature 1.1 upgraded for cross-device support
  const {
    isSupported: isSpeechSupported,
    isListening,
    error: speechError,
    toggleListening,
    stopListening,
    clearError: clearSpeechError,
  } = useVoiceInput({
    onTranscriptChange: (text) => {
      setSymptomText(text);
      if (plausibilityWarning) {
        setPlausibilityWarning(null);
      }
    },
    currentText: symptomText,
  });

  // Stop listening helper on step change
  useEffect(() => {
    stopListening();
  }, [step, stopListening]);

  // Prefill user profile from existing patients row on mount
  useEffect(() => {
    // Already have known-good values (edit-in-place re-entry) -- re-fetching
    // from the DB here would overwrite them and, critically, drop symptomText
    // (which isn't stored server-side).
    if (initialData) return;

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

  // Switch between Myself and Family Member
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

  // Validation per step
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

    // AI Guardrail Plausibility Check (Zero-Token Leakage)
    const plausibility = evaluateSymptomPlausibility(symptomText);
    if (!plausibility.isPlausible) {
      const nextAttempts = invalidAttempts + 1;
      setInvalidAttempts(nextAttempts);

      if (nextAttempts >= 2) {
        // Strike 2: Disqualification termination screen
        setIsDisqualified(true);
        setPlausibilityWarning(null);
        return;
      }

      // Strike 1: Warning banner on the symptom prompt container
      setPlausibilityWarning(plausibility);
      return;
    }

    // Input is plausible: clear warning and proceed
    setPlausibilityWarning(null);

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

  // Render states
  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
          <IconCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Got it. We're on it.</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your information has been saved. We're matching you with the right specialist now.
        </p>
      </div>
    );
  }

  const isFamily = consultationTarget === 'family_member';

  // Strike 2: Dedicated Out-of-Scope Termination Screen
  if (isDisqualified) {
    return (
      <div id="intake-out-of-scope-screen" className="animate-fade-slide-up flex flex-col gap-6 py-2">
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-7 sm:p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
            <IconWarning className="h-7 w-7" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
            Out of Scope
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-3 tracking-tight">
            This app is not what you are looking for
          </h2>
          <p className="italic text-xs text-slate-500 mt-0.5">
            Hindi ito ang serbisyong hinahanap mo
          </p>

          <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            <strong>KayApp</strong> is an AI clinical triage and specialist referral service built exclusively for patients experiencing physical symptoms. To preserve healthcare resources, prevent token misuse, and maintain clinical safety, unrelated or non-medical queries cannot be processed.
          </p>

          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 text-left max-w-md mx-auto shadow-2xs">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-900">
              <IconShield className="h-4 w-4 shrink-0 text-rose-700" />
              Medical Safety Advisory
            </p>
            <p className="leading-relaxed text-rose-700">
              If you or someone else is experiencing an acute life-threatening emergency (such as severe chest pain, stroke symptoms, or severe breathing difficulty), please proceed immediately to the nearest hospital emergency room.
            </p>
          </div>
        </div>

        {/* Recovery Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            id="out-of-scope-restart-btn"
            type="button"
            onClick={handleFullReset}
            className="fluid-hover w-full sm:w-auto rounded-2xl bg-brand-600 px-8 py-4 min-h-[48px] text-sm font-bold text-white shadow-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            Start Over
          </button>
          <a
            id="out-of-scope-dashboard-link"
            href="/patient/dashboard"
            className="fluid-hover w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-center transition"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Step {step} of 3</span>
        <StepDots step={step} />
      </div>

      {/* Step 1: Basics & Family Member Toggle (Task 5.2) */}
      {step === 1 && (
        <div key="step-1" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Let's start with a few basics</h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              This helps our clinical AI match the right pediatric, adult, or geriatric specialist.
            </p>
          </div>

          {/* "Who is this for?" Toggle (Task 5.2) */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 shadow-xs">
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
                    ? 'border-transparent bg-brand-600 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Myself</span>
              </button>

              <button
                id="intake-target-family"
                type="button"
                onClick={() => handleTargetChange('family_member')}
                className={`fluid-hover flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold focus:outline-none ${
                  isFamily
                    ? 'border-transparent bg-brand-600 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>A family member</span>
              </button>
            </div>

            {isFamily && (
              <div className="mt-3.5 rounded-2xl border border-brand-200/70 bg-brand-50/90 p-3.5 text-xs leading-relaxed text-brand-900 flex items-start gap-2.5 animate-fade-slide-up">
                <IconInfo className="h-4 w-4 shrink-0 mt-0.5" />
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Age */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="intake-age" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isFamily ? "Family member's age" : 'Your age'}
              </label>
              {isFamily && (
                <span className="text-xs text-brand-700 font-bold">
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Sex button group */}
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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      )}

      {/* Step 2: HMO */}
      {step === 2 && (
        <div key="step-2" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
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
              No problem. We'll show you doctors with direct cash consultation rates.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Symptoms */}
      {step === 3 && (
        <div key="step-3" className="animate-fade-slide-up flex flex-col gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isFamily ? `What is ${name || 'your family member'} feeling?` : 'What are you feeling?'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Tell us in your own words (English or Tagalog).
            </p>
          </div>

          {/* Strike 1: Inline Warning Banner on Symptoms Prompt Container */}
          {plausibilityWarning && (
            <div
              id="symptom-guardrail-warning"
              role="alert"
              className="rounded-2xl border border-amber-300/90 bg-amber-50/90 p-4 sm:p-5 shadow-xs animate-fade-slide-up flex items-start gap-3.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 mt-0.5">
                <IconWarning className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {plausibilityWarning.detectedLanguage === 'tl' ? 'Pansin: Hindi Sintomas' : 'Warning: Unrecognized Symptoms'}
                  </span>
                  <span className="text-[11px] font-bold text-amber-700">
                    (Attempt 1 of 2)
                  </span>
                </div>
                <h3 className="text-sm font-bold text-amber-950 mt-1">
                  {plausibilityWarning.detectedLanguage === 'tl'
                    ? 'Ang inilagay na mga salita ay hindi proper na sintomas ng sakit.'
                    : 'The words entered were not proper symptoms at all.'}
                </h3>
                <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                  {plausibilityWarning.detectedLanguage === 'tl'
                    ? 'Mangyaring ilarawan kung ano ang nararamdaman mo sa iyong katawan o kung saan ang sumasakit, at subukan muli.'
                    : 'Please retry and type the physical symptoms or bodily discomfort being experienced.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="intake-symptoms" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Describe symptoms
              </label>
              {isSpeechSupported && (
                <button
                  id="voice-dictation-btn"
                  type="button"
                  onClick={toggleListening}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice recording' : 'Speak symptoms with voice input'}
                  className={`fluid-hover inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                    isListening
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 ring-2 ring-rose-500/20 shadow-xs animate-pulse'
                      : 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200'
                  }`}
                >
                  {isListening ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                      <IconMic className="h-3.5 w-3.5 text-rose-600" />
                      <span>Listening… (Tap to stop)</span>
                    </>
                  ) : (
                    <>
                      <IconMic className="h-3.5 w-3.5 text-slate-500" />
                      <span>Voice Input</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {speechError && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <IconWarning className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{speechError}</span>
                </div>
                <button
                  type="button"
                  onClick={clearSpeechError}
                  className="text-rose-600 hover:text-rose-900 font-bold px-1.5 py-0.5"
                  aria-label="Dismiss speech error"
                >
                  ✕
                </button>
              </div>
            )}

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
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 resize-none leading-relaxed"
            />

            {isListening && (
              <p className="text-xs text-rose-700 bg-rose-50/80 p-2.5 rounded-xl border border-rose-200/80 font-medium flex items-center gap-2 animate-fade-slide-up">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Transcribing live… Speak clearly. You can edit the text before submitting.</span>
              </p>
            )}
          </div>

          {submitError && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-medium text-rose-700">
              {submitError}
            </p>
          )}
        </div>
      )}

      {/* Per-step inline validation error */}
      {stepError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-medium text-rose-700">
          {stepError}
        </p>
      )}

      {/* Navigation buttons */}
      <div className={`flex items-center gap-3 pt-2 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
        {step > 1 && (
          <button
            id="intake-back"
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="fluid-hover rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
          >
            Back
          </button>
        )}

        {step < 3 ? (
          <button
            id={`intake-next-step${step}`}
            type="button"
            onClick={handleNext}
            className="fluid-hover rounded-2xl bg-brand-600 px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            Continue
          </button>
        ) : (
          <button
            id="intake-submit"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || symptomText.trim().length < 3}
            className="fluid-hover rounded-2xl bg-brand-600 px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {submitting ? 'Matching Specialist…' : 'Find the Right Doctor'}
          </button>
        )}
      </div>
    </div>
  );
}
