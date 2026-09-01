'use client';

// src/components/MatchResultView.tsx
//
// Specialist Recommendation, Emergency Advisory & Clarification Flow
// Task 5.3: Plain-language descriptions, nurse-tone guidance, large touch targets,
// and accessible typography for elderly and low-literacy users.

import { useState } from 'react';
import type { MatchApiResult, MatchResult, ClarifyResult, EmergencyResult } from '@/lib/matchApi';
import type { IntakeCompleteData } from '@/components/IntakeFlow';
import { getPlainSpecialtyInfo } from '@/lib/specialtyHelpers';
import { IconStethoscope, IconWarning, IconChat, IconCheck, IconInfo } from '@/components/Icons';

interface MatchResultViewProps {
  result: MatchApiResult;
  patientData: IntakeCompleteData;
  onClarifySubmit?: (answer: string) => Promise<void>;
  // Returns to the symptoms step with prior answers intact (edit-in-place).
  onEditSymptoms: () => void;
  // Full reset back to a blank Step 1.
  onRestart: () => void;
  isLoadingClarification?: boolean;
}

export default function MatchResultView({
  result,
  patientData,
  onClarifySubmit,
  onEditSymptoms,
  onRestart,
  isLoadingClarification = false,
}: MatchResultViewProps) {
  const [clarifyAnswer, setClarifyAnswer] = useState('');

  // STATE 1: Match Found
  if (result.type === 'match') {
    const match = result as MatchResult;
    const plainInfo = getPlainSpecialtyInfo(match.specialty);
    const findDoctorsUrl = `/patient/doctors?specialty=${encodeURIComponent(
      match.specialty
    )}&sub_specialty=${encodeURIComponent(
      match.sub_specialty || ''
    )}&hmo=${encodeURIComponent(patientData.hmoProvider || '')}&location=${encodeURIComponent(
      patientData.location || ''
    )}&symptoms=${encodeURIComponent(
      patientData.symptomText || ''
    )}`;

    return (
      <div className="animate-fade-slide-up flex flex-col gap-6">
        {/* Pipeline reasoning stepper */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
            Clinical AI Matching Pipeline
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-bold text-slate-700 shadow-xs border border-slate-200/80">
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> Symptoms parsed
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-bold text-slate-700 shadow-xs border border-slate-200/80">
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> Specialty matched
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 font-bold text-white shadow-sm">
              Recommendation ready
            </span>
          </div>
        </div>

        {/* Side-by-side Layout: Left (Specialist Card), Right ("Why this specialist?" Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT: Main Specialist Card */}
          <div className="lg:col-span-7 animate-slide-in-left flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div>
              <div className="flex items-start gap-4">
                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/25 mt-0.5">
                  <IconStethoscope className="h-6.5 w-6.5" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 border border-brand-200/80 shadow-xs">
                    Recommended Specialist
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                    {match.sub_specialty
                      ? `${match.specialty}: ${match.sub_specialty}`
                      : match.specialty}
                  </h2>
                  {/* Plain-language subtitle & Tagalog translation */}
                  {plainInfo && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-brand-700">
                        {plainInfo.plainName}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="italic text-slate-600 font-medium">
                        {plainInfo.tagalogName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Patient context recap */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
                <span>Patient:</span>
                <strong className="text-slate-900 font-bold">{patientData.name}</strong>
                {patientData.isForFamilyMember && (
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                    Family Member
                  </span>
                )}
              </span>
              <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
                Age {patientData.age} • {patientData.sex}
              </span>
              <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
                HMO:{' '}
                <strong className="text-brand-700 font-bold">
                  {patientData.hmoProvider || 'None (Cash)'}
                </strong>
              </span>
              {patientData.location && (
                <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
                  {patientData.location}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Dedicated "Why this specialist?" Section */}
          <div className="lg:col-span-5 animate-slide-in-right flex flex-col justify-between rounded-2xl border-l-4 border-l-brand-600 border border-brand-200/80 bg-brand-50/70 p-6 sm:p-7 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-900">
                  <IconInfo className="h-3.5 w-3.5 text-brand-700" />
                  Referral Rationale
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Why this specialist was recommended
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-800 font-medium">
                {match.reason}
              </p>
              {match.vectorSearchApplied && (
                <p className="mt-2.5 text-xs text-brand-800 font-medium bg-brand-100/60 p-2.5 rounded-xl border border-brand-200/60">
                  {/[\b\s](ang|ng|mga|sa|ko|mo|siya|kami|tayo|sila|ito|iyan|iyon|may|mayroon|wala|hindi|masakit|lagnat|ubo|sipon|tiyan|ulo|katawan|nahihilo|nanghihina)[\b\s]/i.test(
                    ` ${patientData.symptomText || ''} `
                  )
                    ? 'Ang mga doktor ay inayos ayon sa kung gaano kagaling ang pagtutugma sa iyong inilarawan.'
                    : 'Doctors are ranked by how closely their expertise matches your description.'}
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-brand-200/60 pt-3.5 text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <span>💡</span>
              <span>Matched directly to the specific symptoms and keywords you described.</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <a
            id="find-doctors-btn"
            href={findDoctorsUrl}
            className="fluid-hover w-full sm:flex-1 text-center rounded-2xl bg-brand-600 px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            Find Doctors in this Field
          </a>
          <button
            type="button"
            onClick={onEditSymptoms}
            className="fluid-hover w-full sm:w-auto card px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Edit symptoms
          </button>
        </div>
      </div>
    );
  }

  // STATE 2: Emergency Gate Triggered
  if (result.type === 'emergency') {
    const emergency = result as EmergencyResult;

    return (
      <div className="flex flex-col gap-6">
        {/* Calm Advisory Banner (PRD 8.2: calm, not alarming) */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-7 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm mt-0.5">
              <IconWarning className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
                Urgent Medical Notice
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Please seek prompt medical attention
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-700 font-medium">
                {emergency.message}
              </p>

              {emergency.matchedCriteria && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 border border-amber-200 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Clinical note: {emergency.matchedCriteria}</span>
                </div>
              )}
            </div>
          </div>

          {/* Hotline & ER Info */}
          <div className="mt-6 rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">
              Emergency Hotlines (Philippines)
            </h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="text-xs text-slate-500 block font-medium">National Emergency Hotline</span>
                <span className="font-bold text-slate-900 text-lg">911</span>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="text-xs text-slate-500 block font-medium">Philippine Red Cross</span>
                <span className="font-bold text-slate-900 text-lg">143 / (02) 8790-2300</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              If you or your family member are experiencing severe symptoms, worsening pain, or breathing difficulty, please proceed immediately to the nearest hospital emergency room.
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onEditSymptoms}
            className="card px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Return to symptom check
          </button>
        </div>
      </div>
    );
  }

  // STATE 3: Follow-up Question Container (when AI determines symptoms require clinical clarification)
  if (result.type === 'clarify') {
    const clarify = result as ClarifyResult;

    async function handleClarify(e: React.FormEvent) {
      e.preventDefault();
      if (!clarifyAnswer.trim() || isLoadingClarification || !onClarifySubmit) return;
      await onClarifySubmit(clarifyAnswer.trim());
      setClarifyAnswer('');
    }

    return (
      <form onSubmit={handleClarify} className="animate-fade-slide-up flex flex-col gap-6">
        <div className="rounded-2xl border border-brand-200/80 bg-white p-7 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
              <IconChat className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-100">
                Clinical Follow-up Question
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                We need a bit more detail to match accurately
              </h2>
            </div>
          </div>

          {/* AI Clinical Follow-up Question Card */}
          <div className="mt-5 rounded-2xl border border-brand-200/70 bg-brand-50/80 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-900 mb-1">
              Triage Nurse / AI Follow-up
            </p>
            <p className="text-base font-semibold text-slate-800 leading-relaxed">
              &ldquo;{clarify.question}&rdquo;
            </p>
          </div>

          {/* Patient Answer Input */}
          <div className="mt-5 flex flex-col gap-2">
            <label htmlFor="clarify-answer" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Your Answer (English or Tagalog)
            </label>
            <textarea
              id="clarify-answer"
              rows={4}
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              placeholder="e.g. Masakit po ang likod ko kapag yumuyuko, at nagsimula ito kahapon..."
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onEditSymptoms}
              disabled={isLoadingClarification}
              className="fluid-hover w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
            >
              Back to symptoms
            </button>
            <button
              type="button"
              onClick={onRestart}
              disabled={isLoadingClarification}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 transition disabled:opacity-50 px-2 py-3"
            >
              Start over
            </button>
          </div>

          <button
            id="clarify-submit-btn"
            type="submit"
            disabled={!clarifyAnswer.trim() || isLoadingClarification}
            className="fluid-hover w-full sm:w-auto rounded-2xl bg-brand-600 px-8 py-4 min-h-[48px] text-base font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {isLoadingClarification ? 'Analyzing details…' : 'Continue with this detail'}
          </button>
        </div>
      </form>
    );
  }

  return null;
}
