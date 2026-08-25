'use client';

import { useState } from 'react';
import AuthForm from '@/components/AuthForm';

export default function PatientAuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Patient Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-xs mx-auto">
            {mode === 'login'
              ? 'Welcome back. Sign in to manage your appointments and health records.'
              : 'Create a free patient account to check symptoms and book verified specialists.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-7 sm:p-8">
          {/* Toggle */}
          <div className="mb-6 flex rounded-2xl bg-slate-100/80 p-1 border border-slate-200/60">
            <button
              id="patient-login-tab"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm'
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
                  ? 'bg-blue-600 text-white shadow-sm'
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
          <a href="/doctor/auth" className="text-blue-600 font-semibold underline hover:text-blue-700">
            Doctor portal
          </a>
        </p>
      </div>
    </main>
  );
}
