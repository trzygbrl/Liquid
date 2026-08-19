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

  function handleRestart() {
    setMatchResult(null);
    setConversationHistory([]);
    setApiError(null);
    setState('intake');
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 mb-8">
        <span className="text-lg font-bold text-white">
          <span className="text-teal-400">Civic</span>Access
        </span>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {state === 'result' && matchResult?.type === 'match'
            ? 'Specialist Recommendation'
            : state === 'result' && matchResult?.type === 'emergency'
            ? 'Emergency Triage Advisory'
            : 'Check my symptoms'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {state === 'result' && matchResult?.type === 'match'
            ? 'Based on your symptoms and clinical criteria, here is the matched specialty.'
            : state === 'result' && matchResult?.type === 'emergency'
            ? 'Important medical safety notice based on your reported symptoms.'
            : "Tell us what you're feeling and our AI navigator will help find the right specialist."}
        </p>
      </div>

      {/* Global API Error Alert */}
      {apiError && (
        <div className="mb-6 w-full max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>{apiError}</span>
          <button
            onClick={() => setApiError(null)}
            className="text-xs text-red-300 underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="w-full max-w-lg">
        {state === 'intake' && (
          <IntakeFlow onComplete={handleIntakeComplete} />
        )}

        {state === 'matching' && (
          <div className="rounded-2xl border border-teal-500/20 bg-slate-900/60 p-12 text-center shadow-xl backdrop-blur">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Analyzing symptoms…
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Evaluating your symptom description and matching with our clinical specialty taxonomy.
            </p>
          </div>
        )}

        {state === 'result' && matchResult && patientData && (
          <MatchResultView
            result={matchResult}
            patientData={patientData}
            onClarifySubmit={handleClarifySubmit}
            onRestart={handleRestart}
            isLoadingClarification={loadingClarify}
          />
        )}
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
