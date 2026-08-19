'use client';

import { useState } from 'react';
import type { MatchApiResult, MatchResult, ClarifyResult, EmergencyResult } from '@/lib/matchApi';
import type { IntakeCompleteData } from '@/components/IntakeFlow';

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
    const findDoctorsUrl = `/patient/doctors?specialty=${encodeURIComponent(
      match.specialty
    )}&sub_specialty=${encodeURIComponent(
      match.sub_specialty || ''
    )}&hmo=${encodeURIComponent(patientData.hmoProvider || '')}`;

    return (
      <div className="flex flex-col gap-6">
        {/* Pipeline reasoning stepper (PRD 8.1) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Clinical AI Navigation Pipeline
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-1 text-teal-300">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Symptoms parsed
            </span>
            <span className="text-slate-600">→</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-1 text-teal-300">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Specialty: {match.specialty}
            </span>
            <span className="text-slate-600">→</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-400/20 px-2 py-1 font-semibold text-teal-200">
              Sub-specialty: {match.sub_specialty || 'General'}
            </span>
          </div>
        </div>

        {/* Main Recommendation Card */}
        <div className="rounded-2xl border border-teal-500/30 bg-slate-900/80 p-7 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Recommended Specialist
              </p>
              <h2 className="text-2xl font-bold text-white">
                {match.sub_specialty
                  ? `${match.specialty} — ${match.sub_specialty}`
                  : match.specialty}
              </h2>
            </div>
          </div>

          {/* Reasoning box */}
          <div className="mt-6 rounded-xl border-l-4 border-teal-500 bg-slate-800/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              Why this specialist
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
              {match.reason}
            </p>
          </div>

          {/* Patient context recap */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-5 text-xs text-slate-400">
            <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
              Patient: <strong className="text-white">{patientData.name}</strong>
            </span>
            <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
              Age {patientData.age} • {patientData.sex}
            </span>
            <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
              HMO:{' '}
              <strong className="text-teal-300">
                {patientData.hmoProvider || 'None (Cash)'}
              </strong>
            </span>
            {patientData.location && (
              <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
                📍 {patientData.location}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <a
            id="find-doctors-btn"
            href={findDoctorsUrl}
            className="w-full sm:flex-1 text-center rounded-xl bg-teal-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            Find Doctors in this Sub-specialty →
          </a>
          <button
            type="button"
            onClick={onRestart}
            className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
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
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-7 shadow-xl backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <span className="inline-block rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
                Urgent Care Recommended
              </span>
              <h2 className="mt-1 text-xl font-bold text-white">
                Please seek immediate medical attention
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-200">
                {emergency.message}
              </p>

              {emergency.matchedCriteria && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 border border-slate-700">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Clinical reason: {emergency.matchedCriteria}</span>
                </div>
              )}
            </div>
          </div>

          {/* Hotline & ER Info */}
          <div className="mt-6 rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
            <h3 className="text-sm font-semibold text-white">
              Emergency Hotlines (Philippines)
            </h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <span className="text-xs text-slate-400 block">National Emergency</span>
                <span className="font-bold text-white text-base">📞 911</span>
              </div>
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <span className="text-xs text-slate-400 block">Philippine Red Cross</span>
                <span className="font-bold text-white text-base">📞 143 / (02) 8790-2300</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              If the patient is experiencing worsening symptoms, difficulty breathing, or severe pain, please proceed directly to the nearest hospital Emergency Room.
            </p>
          </div>
        </div>

        {/* Action button — NO booking button */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
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
        <div className="rounded-2xl border border-teal-500/20 bg-slate-900/80 p-7 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
                Follow-up Question
              </p>
              <h2 className="text-lg font-semibold text-white">
                We need a bit more detail to match accurately
              </h2>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
            <p className="text-base font-medium text-white leading-relaxed">
              &ldquo;{clarify.question}&rdquo;
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <label htmlFor="clarify-answer" className="text-sm font-medium text-slate-300">
              Your answer (English or Tagalog)
            </label>
            <textarea
              id="clarify-answer"
              rows={4}
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              placeholder="e.g. Malabo po ang paningin ko lalo na sa malayo, at medyo nanunuyo ang mata ko..."
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-4 text-base text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRestart}
            disabled={isLoadingClarification}
            className="text-sm font-medium text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            ← Start over
          </button>

          <button
            id="clarify-submit-btn"
            type="submit"
            disabled={!clarifyAnswer.trim() || isLoadingClarification}
            className="rounded-xl bg-teal-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            {isLoadingClarification ? 'Analyzing details…' : 'Continue with this detail →'}
          </button>
        </div>
      </form>
    );
  }

  return null;
}
