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

        {/* Entry card — links to the patient intake flow */}
        <div className="mt-10">
          <a
            id="patient-start-intake"
            href="/patient/intake"
            className="group flex items-start gap-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 p-7 transition hover:border-teal-500/40 hover:bg-slate-900/80"
          >
            {/* Icon */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 transition group-hover:bg-teal-500/20">
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
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white">Check my symptoms</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                Tell us what you&apos;re feeling — in English or Tagalog — and we&apos;ll help
                find the right specialist for you.
              </p>
              <p className="mt-3 text-sm font-medium text-teal-400 group-hover:text-teal-300 transition">
                Get started →
              </p>
            </div>
          </a>
        </div>

      </main>
    </RequireRole>
  );
}
