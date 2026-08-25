'use client';

import { useState } from 'react';
import RequireRole from '@/components/RequireRole';
import IntakeFlow, { type IntakeCompleteData } from '@/components/IntakeFlow';
import MatchResultView from '@/components/MatchResultView';
import { callMatchApi, type MatchApiResult } from '@/lib/matchApi';

type FlowState = 'intake' | 'matching' | 'result';

function IntakePageContent() {
  const [state, setState] = useState<FlowState>('intake');
  const [patientData, setPatientData] = useState<IntakeCompleteData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchApiResult | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'model'; text: string }>
  >([]);
  const [loadingClarify, setLoadingClarify] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleIntakeComplete(data: IntakeCompleteData) {
    setPatientData(data);
    setState('matching');
    setApiError(null);
    setConversationHistory([]);

    try {
      const res = await callMatchApi({
        symptomText: data.symptomText,
        name: data.name,
        age: data.age,
        sex: data.sex,
        location: data.location,
        isForFamilyMember: data.isForFamilyMember,
      });
      setMatchResult(res);
      setState('result');
    } catch (err) {
      console.error('Match failed:', err);
      setApiError('Unable to match symptoms right now. Please try again.');
      setState('intake');
    }
  }

  async function handleClarifySubmit(answer: string) {
    if (!patientData || !matchResult || matchResult.type !== 'clarify') return;
    setLoadingClarify(true);

    const updatedHistory = [
      ...conversationHistory,
      { role: 'model' as const, text: matchResult.question },
      { role: 'user' as const, text: answer },
    ];
    setConversationHistory(updatedHistory);

    try {
      const res = await callMatchApi({
        symptomText: patientData.symptomText,
        name: patientData.name,
        age: patientData.age,
        sex: patientData.sex,
        location: patientData.location,
        isForFamilyMember: patientData.isForFamilyMember,
        conversationHistory: updatedHistory,
      });
      setMatchResult(res);
    } catch (err) {
      console.error('Clarification match failed:', err);
      setApiError('Failed to process clarification. Please try again.');
    } finally {
      setLoadingClarify(false);
    }
  }

  // Returns to the symptoms step with prior answers intact -- patientData is
  // deliberately left alone so <IntakeFlow> below re-seeds from it and jumps
  // straight to Step 3 instead of a blank Step 1.
  function handleEditSymptoms() {
    setMatchResult(null);
    setConversationHistory([]);
    setApiError(null);
    setState('intake');
  }

  // Full reset back to a blank Step 1.
  function handleRestart() {
    setPatientData(null);
    setMatchResult(null);
    setConversationHistory([]);
    setApiError(null);
    setState('intake');
  }

  const isMatchResult = state === 'result' && matchResult?.type === 'match';

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className={`mx-auto w-full ${isMatchResult ? 'max-w-4xl' : 'max-w-2xl'} transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-slate-200/80 pb-6 mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a
                href="/patient/dashboard"
                className="text-xs font-bold text-slate-500 hover:text-slate-900 transition flex items-center gap-1"
              >
                Dashboard
              </a>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                AI Clinical Triage
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {state === 'result' && matchResult?.type === 'match'
                ? 'Specialist Recommendation'
                : state === 'result' && matchResult?.type === 'emergency'
                ? 'Emergency Triage Advisory'
                : 'Check Symptoms'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {state === 'result' && matchResult?.type === 'match'
                ? 'Based on clinical criteria and symptoms, here is your recommended specialist.'
                : state === 'result' && matchResult?.type === 'emergency'
                ? 'Important medical safety notice based on reported symptoms.'
                : "Tell us what is being felt in your own words. We'll map you to the exact medical field."}
            </p>
          </div>
        </div>

        {/* Global API Error Alert */}
        {apiError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>{apiError}</span>
            <button
              onClick={() => setApiError(null)}
              className="text-xs font-bold text-rose-800 underline hover:text-rose-950"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Card Container */}
        <div className="card p-7 sm:p-9">
          {state === 'intake' && (
            <IntakeFlow
              onComplete={handleIntakeComplete}
              initialData={patientData}
              initialStep={patientData ? 3 : 1}
            />
          )}

          {state === 'matching' && (
            <div className="py-14 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Finding the right specialist…
              </h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Evaluating symptoms against 33 medical specialties and checking provider availability.
              </p>
            </div>
          )}

          {state === 'result' && matchResult && patientData && (
            <MatchResultView
              result={matchResult}
              patientData={patientData}
              onClarifySubmit={handleClarifySubmit}
              onEditSymptoms={handleEditSymptoms}
              onRestart={handleRestart}
              isLoadingClarification={loadingClarify}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function PatientIntakePage() {
  return (
    <RequireRole role="patient">
      <IntakePageContent />
    </RequireRole>
  );
}
