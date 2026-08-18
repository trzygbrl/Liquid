'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import { supabase } from '@/lib/supabaseClient';
import ScheduleManager from '@/components/ScheduleManager';

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

      <ScheduleManager />
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
