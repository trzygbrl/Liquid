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

interface MatchResultViewProps {
  result: MatchApiResult;
  patientData: IntakeCompleteData;
  onClarifySubmit: (answer: string) => Promise<void>;
  onRestart: () => void;
  isLoadingClarification?: boolean;
}

export default function MatchResultView({
  result,
  patientData,
  onClarifySubmit,
  onRestart,
  isLoadingClarification = false,
}: MatchResultViewProps) {
  const [clarifyAnswer, setClarifyAnswer] = useState('');

  // ─── STATE 1: Match Found ──────────────────────────────────────────────────
  if (result.type === 'match') {
    const match = result as MatchResult;
    const plainInfo = getPlainSpecialtyInfo(match.specialty);
    const findDoctorsUrl = `/patient/doctors?specialty=${encodeURIComponent(
      match.specialty
    )}&sub_specialty=${encodeURIComponent(
      match.sub_specialty || ''
    )}&hmo=${encodeURIComponent(patientData.hmoProvider || '')}`;

    return (
      <div className="flex flex-col gap-6">
        {/* Pipeline reasoning stepper */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
            ✨ Clinical AI Matching Pipeline
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm border border-slate-200/60">
              <span className="text-emerald-600">✓</span> Symptoms parsed
            </span>
            <span className="text-slate-400">→</span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm border border-slate-200/60">
              <span className="text-emerald-600">✓</span> Specialty: {match.specialty}
            </span>
            <span className="text-slate-400">→</span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-bold text-white shadow-sm">
              Sub-specialty: {match.sub_specialty || 'General'}
            </span>
          </div>
        </div>

        {/* Main Recommendation Card */}
        <div className="rounded-3xl border border-violet-100 bg-white p-7 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl shadow-sm mt-0.5">
              🩺
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700 border border-violet-100">
                Recommended Specialist
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                {match.sub_specialty
                  ? `${match.specialty} — ${match.sub_specialty}`
                  : match.specialty}
              </h2>
              {/* Plain-language subtitle & Tagalog translation */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-violet-700">
                  {plainInfo.plainName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="italic text-slate-500 font-medium">
                  {plainInfo.tagalogName}
                </span>
              </div>
            </div>
          </div>

          {/* Reasoning box (Nurse-tone explanation) */}
          <div className="mt-6 rounded-2xl border-l-4 border-violet-600 bg-violet-50/80 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-900">
              Why this specialist is right for you
            </p>
            <p className="mt-2 text-base leading-relaxed text-slate-800 font-medium">
              {match.reason}
            </p>
          </div>

          {/* Patient context recap */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
              <span>Patient:</span>
              <strong className="text-slate-900 font-bold">{patientData.name}</strong>
              {patientData.isForFamilyMember && (
                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700">
                  Family Member
                </span>
              )}
            </span>
            <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
              Age {patientData.age} • {patientData.sex}
            </span>
            <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
              HMO:{' '}
              <strong className="text-violet-700 font-bold">
                {patientData.hmoProvider || 'None (Cash)'}
              </strong>
            </span>
            {patientData.location && (
              <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-700 border border-slate-200/60 font-medium">
                📍 {patientData.location}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <a
            id="find-doctors-btn"
            href={findDoctorsUrl}
            className="w-full sm:flex-1 text-center rounded-2xl bg-[#2A2338] px-8 py-4 text-base font-semibold text-white shadow-md transition hover:bg-[#1E192C] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            Find Doctors in this Field →
          </a>
          <button
            type="button"
            onClick={onRestart}
            className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
          >
            ← Edit symptoms
          </button>
        </div>
      </div>
    );
  }

  // ─── STATE 2: Emergency Gate Triggered ─────────────────────────────────────
  if (result.type === 'emergency') {
    const emergency = result as EmergencyResult;

    return (
      <div className="flex flex-col gap-6">
        {/* Calm Advisory Banner (PRD 8.2: calm, not alarming) */}
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-7 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 text-2xl shadow-sm mt-0.5">
              ⚠️
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
                <span className="font-bold text-slate-900 text-lg">📞 911</span>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="text-xs text-slate-500 block font-medium">Philippine Red Cross</span>
                <span className="font-bold text-slate-900 text-lg">📞 143 / (02) 8790-2300</span>
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
            onClick={onRestart}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
          >
            ← Return to symptom check
          </button>
        </div>
      </div>
    );
  }

  // ─── STATE 3: Clarifying Question ──────────────────────────────────────────
  if (result.type === 'clarify') {
    const clarify = result as ClarifyResult;

    async function handleClarify(e: React.FormEvent) {
      e.preventDefault();
      if (!clarifyAnswer.trim() || isLoadingClarification) return;
      await onClarifySubmit(clarifyAnswer.trim());
      setClarifyAnswer('');
    }

    return (
      <form onSubmit={handleClarify} className="flex flex-col gap-6">
        <div className="rounded-3xl border border-violet-100 bg-white p-7 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-xl shadow-sm">
              💬
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                Follow-up Question
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                We need a bit more detail to match accurately
              </h2>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
            <p className="text-base font-bold text-violet-950 leading-relaxed">
              &ldquo;{clarify.question}&rdquo;
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <label htmlFor="clarify-answer" className="text-sm font-semibold text-slate-700">
              Your answer (English or Tagalog)
            </label>
            <textarea
              id="clarify-answer"
              rows={4}
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              placeholder="e.g. Malabo po ang paningin ko lalo na sa malayo, at medyo nanunuyo ang mata ko..."
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onRestart}
            disabled={isLoadingClarification}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 transition disabled:opacity-50"
          >
            ← Start over
          </button>

          <button
            id="clarify-submit-btn"
            type="submit"
            disabled={!clarifyAnswer.trim() || isLoadingClarification}
            className="rounded-2xl bg-[#2A2338] px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#1E192C] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            {isLoadingClarification ? 'Analyzing details…' : 'Continue with this detail →'}
          </button>
        </div>
      </form>
    );
  }

  return null;
}
