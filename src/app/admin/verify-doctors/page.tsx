'use client';

// src/app/admin/verify-doctors/page.tsx
//
// Combined internal admin tools page: HITL doctor license verification
// (Task 7.2) and specialty-taxonomy cleanup (Task 7.3 follow-up), as tabs
// on one page rather than two separate routes -- both need the same
// passcode, and switching between them shouldn't cost a re-auth or a full
// navigation.
//
// Deliberately NOT wired into RequireRole / the patient-doctor auth system.
// The passcode is a disclosed speed bump, not real authentication -- same
// spirit as the PRD's "no live HMO verification, disclosed as a known gap"
// framing. See /.claude/roadmap.md Task 7.2/7.3.

import { useState } from 'react';
import AdminGate from '@/components/AdminGate';
import Logo from '@/components/Logo';
import DoctorVerificationQueue, { fetchDoctorsWith } from '@/components/admin/DoctorVerificationQueue';
import TaxonomyManager from '@/components/admin/TaxonomyManager';

type AdminTab = 'doctors' | 'taxonomy';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'doctors', label: 'Doctor Verification' },
  { id: 'taxonomy', label: 'Manage Specialties' },
];

function AdminTools({ passcode, forget }: { passcode: string; forget: () => void }) {
  const [tab, setTab] = useState<AdminTab>('doctors');

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <Logo size={30} href={null} />
            <span className="field-label mt-4 block">Internal Tool</span>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Admin Tools</h1>
          </div>
          <button
            type="button"
            onClick={forget}
            className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Not you?
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-8 shadow-[inset_0_-1px_0_0_var(--color-slate-200)]">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`border-b-2 py-3 text-sm font-semibold transition ${
                  active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'doctors' && <DoctorVerificationQueue passcode={passcode} />}
        {tab === 'taxonomy' && <TaxonomyManager passcode={passcode} />}
      </div>
    </main>
  );
}

export default function AdminVerifyDoctorsPage() {
  return (
    <AdminGate
      title="Admin Tools"
      verify={(code) => fetchDoctorsWith(code).then(() => null, (err) => err.message)}
    >
      {(passcode, forget) => <AdminTools passcode={passcode} forget={forget} />}
    </AdminGate>
  );
}
