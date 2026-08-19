'use client';

import { useState } from 'react';
import AuthForm from '@/components/AuthForm';

export default function PatientAuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FA] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-base shadow-md shadow-violet-500/20">
              ✦
            </span>
            <span>Civic<span className="text-violet-600">Access</span></span>
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Patient Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-xs mx-auto">
            {mode === 'login'
              ? 'Welcome back — sign in to manage your appointments and health records.'
              : 'Create a free patient account to check symptoms and book verified specialists.'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-100 bg-white p-7 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          {/* Toggle */}
          <div className="mb-6 flex rounded-2xl bg-slate-100/80 p-1 border border-slate-200/60">
            <button
              id="patient-login-tab"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-[#2A2338] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log in
            </button>
            <button
              id="patient-signup-tab"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === 'signup'
                  ? 'bg-[#2A2338] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign up
            </button>
          </div>

          <AuthForm mode={mode} role="patient" />
        </div>

        <p className="mt-6 text-center text-xs font-medium text-slate-500">
          Are you a healthcare provider or secretary?{' '}
          <a href="/doctor/auth" className="text-violet-600 font-semibold underline hover:text-violet-700">
            Doctor portal →
          </a>
        </p>
      </div>
    </main>
  );
}
