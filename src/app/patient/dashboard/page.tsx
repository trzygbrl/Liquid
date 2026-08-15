'use client';

import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

export default function PatientDashboardPage() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/patient/auth');
  }

  return (
    <RequireRole role="patient">
      <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="text-lg font-bold text-white">
              <span className="text-teal-400">Civic</span>Access
            </span>
            <h1 className="mt-1 text-2xl font-semibold text-white">Patient Dashboard</h1>
          </div>
          <button
            id="patient-sign-out"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>

        {/* Stub content */}
        <div className="mt-10 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Routing &amp; auth stub</h2>
          <p className="mt-2 text-sm text-slate-400">
            Authentication is wired up. The intake questionnaire, appointment booking, and
            full patient dashboard get built out in Tasks 3.1–3.3.
          </p>
        </div>
      </main>
    </RequireRole>
  );
}
