// src/app/admin/page.tsx
//
// Root /admin index. Points to the actual admin tools page rather than
// leaving a bare 404 at /admin -- there is only one admin destination today
// (/admin/verify-doctors, which bundles doctor verification + taxonomy
// cleanup as tabs), but this gives internal staff a stable landing URL to
// bookmark even if that changes later.

import Link from 'next/link';
import Logo from '@/components/Logo';

export default function AdminIndexPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
        <Logo size={34} href={null} />
        <div>
          <span className="field-label">Internal Tools</span>
          <h1 className="mt-1.5 text-lg font-bold text-slate-900">Admin</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Doctor license verification and specialty taxonomy management live in one place.
          </p>
        </div>
        <Link
          href="/admin/verify-doctors"
          className="fluid-hover min-h-[48px] w-full rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 flex items-center justify-center"
        >
          Open Admin Tools
        </Link>
      </div>
    </main>
  );
}
