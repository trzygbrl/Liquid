'use client';

import { useState } from 'react';
import AuthForm from '@/components/AuthForm';

export default function DoctorAuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <span className="text-indigo-400">Civic</span>Access
          </span>
          <h1 className="mt-3 text-xl font-semibold text-white">
            Doctor / Secretary portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'login'
              ? 'Welcome back — log in to your dashboard.'
              : 'Create a new practitioner account.'}
          </p>
        </div>

        {/* Toggle */}
        <div className="mb-6 flex rounded-lg bg-slate-800 p-1">
          <button
            id="doctor-login-tab"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Log in
          </button>
          <button
            id="doctor-signup-tab"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'signup'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl backdrop-blur">
          <AuthForm mode={mode} role="doctor" />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Looking for the patient portal?{' '}
          <a href="/patient/auth" className="text-indigo-400 underline hover:text-indigo-300">
            Go here
          </a>
        </p>
      </div>
    </main>
  );
}
