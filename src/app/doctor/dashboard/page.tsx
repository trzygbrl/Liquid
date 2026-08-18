'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';

function DashboardContent() {
  const router = useRouter();
  // true = still checking; null content is rendered as a spinner until confirmed
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return; // RequireRole handles the unauthenticated redirect

      const { data: doctorRow } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!doctorRow) {
        // No doctor row at all — send through onboarding.
        router.replace('/doctor/profile-setup');
        return;
      }

      // "Profile complete" now requires both a doctors row *and* at least one clinics row.
      // If only the doctors row exists (partial failure from a prior attempt), send them
      // back to the setup page which will pre-fill the already-saved doctor data.
      const { data: clinicRows } = await supabase
        .from('clinics')
        .select('id')
        .eq('doctor_id', session.user.id)
        .limit(1);

      if (!clinicRows || clinicRows.length === 0) {
        router.replace('/doctor/profile-setup');
        return;
      }

      setCheckingProfile(false);
    }

    checkProfile();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/doctor/auth');
  }

  if (checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="text-lg font-bold text-white">
            <span className="text-indigo-400">Civic</span>Access
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-white">Doctor Dashboard</h1>
        </div>
        <button
          id="doctor-sign-out"
          onClick={handleSignOut}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Sign out
        </button>
      </div>

      {/* Stub content */}
      <div className="mt-10 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">Routing &amp; auth stub</h2>
        <p className="mt-2 text-sm text-slate-400">
          Profile is saved. Schedule management and the real appointments dashboard get
          built out in Tasks 2.2–2.3.
        </p>
      </div>
    </main>
  );
}

export default function DoctorDashboardPage() {
  return (
    <RequireRole role="doctor">
      <DashboardContent />
    </RequireRole>
  );
}
