'use client';

// src/components/AdminGate.tsx
//
// Shared passcode gate for internal /admin/* pages (Task 7.2's HITL doctor
// verification queue, and its taxonomy-cleanup companion page). This is a
// disclosed speed bump, not real authentication -- deliberately not wired
// into RequireRole / the patient-doctor auth system. See
// /.claude/roadmap.md Task 7.2.
//
// `verify` actually calls the target API with the entered passcode so a
// wrong value is caught immediately, rather than being cached and silently
// failing every request afterward.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Logo from '@/components/Logo';

const SESSION_KEY = 'admin_passcode';

interface AdminGateProps {
  title: string;
  verify: (passcode: string) => Promise<string | null>;
  children: (passcode: string, forget: () => void) => ReactNode;
}

export default function AdminGate({ title, verify, children }: AdminGateProps) {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SESSION_KEY);
      if (saved) setPasscode(saved);
    } catch {
      // sessionStorage unavailable -- fall through to the passcode form
    }
  }, []);

  function forget() {
    setPasscode(null);
    setInput('');
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // non-fatal
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter the admin passcode.');
      return;
    }

    setChecking(true);
    const verifyError = await verify(trimmed);
    setChecking(false);

    if (verifyError) {
      setError(verifyError);
      return;
    }

    setPasscode(trimmed);
    try {
      window.sessionStorage.setItem(SESSION_KEY, trimmed);
    } catch {
      // non-fatal -- just means re-entering it after a refresh
    }
  }

  if (!passcode) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <Logo size={34} href={null} />
        <form onSubmit={handleSubmit} className="card w-full max-w-sm p-7 sm:p-8">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">Internal tool. Enter the admin passcode to continue.</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Passcode"
            autoFocus
            className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
          {error && (
            <p className="mt-2 rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={checking}
            className="fluid-hover mt-4 min-h-[48px] w-full rounded-2xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </main>
    );
  }

  return <>{children(passcode, forget)}</>;
}
