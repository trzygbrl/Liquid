'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  signUpWithRole,
  signIn,
  getRoleFromUser,
  dashboardRouteForRole,
  type UserRole,
} from '@/lib/auth';

interface AuthFormProps {
  mode: 'login' | 'signup';
  role: UserRole;
}

export default function AuthForm({ mode, role }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } =
      mode === 'signup'
        ? await signUpWithRole(email, password, role)
        : await signIn(email, password);

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Redirect based on the role actually stored on the account, not the page the
    // user happened to submit from. If someone signs in on the wrong role's page,
    // they still land on their real dashboard instead of getting stuck.
    const actualRole = getRoleFromUser(data.user) ?? role;
    router.replace(dashboardRouteForRole(actualRole));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-slate-700">
          Email address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {error && (
        <p className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 min-h-[48px] rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500/50"
      >
        {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
