'use client';

import { useState } from 'react';
import AuthForm from '@/components/AuthForm';

export default function DoctorAuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Doctor & Secretary Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-xs mx-auto">
            {mode === 'login'
              ? 'Welcome back. Manage patient bookings, schedules, and clinic queues in real-time.'
              : 'Create a practitioner account to list your clinics and manage appointments.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-7 sm:p-8">
          {/* Toggle */}
          <div className="mb-6 flex rounded-2xl bg-slate-100/80 p-1 border border-slate-200/60">
            <button
              id="doctor-login-tab"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log in
            </button>
            <button
              id="doctor-signup-tab"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === 'signup'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign up
            </button>
          </div>

          <AuthForm mode={mode} role="doctor" />
        </div>

        <p className="mt-6 text-center text-xs font-medium text-slate-500">
          Looking for the patient portal?{' '}
          <a href="/patient/auth" className="text-brand-600 font-semibold underline hover:text-brand-700">
            Patient portal
          </a>
        </p>
      </div>
    </main>
  );
}
