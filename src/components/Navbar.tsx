'use client';

// src/components/Navbar.tsx
//
// The single site navbar. Mounted once per section layout rather than per
// page, so every screen gets the same header.
//
// It adapts to two things it works out itself:
//   * which section it is in, from the pathname (patient vs doctor)
//   * whether anyone is signed in, from the Supabase session
// so the auth screens show a lean public bar while the app screens show the
// section links plus sign out.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

interface NavLink {
  label: string;
  href: string;
}

const PATIENT_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/patient/dashboard' },
  { label: 'Check symptoms', href: '/patient/intake' },
  { label: 'Find a doctor', href: '/patient/doctors' },
];

const DOCTOR_LINKS: NavLink[] = [{ label: 'Dashboard', href: '/doctor/dashboard' }];

export default function Navbar({ section }: { section: 'patient' | 'doctor' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setSignedIn(Boolean(session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace(section === 'doctor' ? '/doctor/auth' : '/patient/auth');
  }

  const links = section === 'doctor' ? DOCTOR_LINKS : PATIENT_LINKS;
  const onAuthPage = pathname.endsWith('/auth');
  const otherPortal =
    section === 'doctor'
      ? { label: 'Patient portal', href: '/patient/auth' }
      : { label: 'Doctor portal', href: '/doctor/auth' };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="hidden rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-100 sm:inline">
            {section === 'doctor' ? 'Doctor' : 'Patient'}
          </span>
        </div>

        {/* Section links appear only once there is a session to use them with. */}
        {signedIn && (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {signedIn ? (
            <button
              id={`${section}-sign-out`}
              type="button"
              onClick={handleSignOut}
              className="fluid-hover rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              Sign out
            </button>
          ) : (
            <>
              <Link
                href={otherPortal.href}
                className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-brand-700 sm:inline-flex"
              >
                {otherPortal.label}
              </Link>
              {/* No point offering "Sign in" while standing on the sign-in page. */}
              {!onAuthPage && (
                <Link
                  href={section === 'doctor' ? '/doctor/auth' : '/patient/auth'}
                  className="fluid-hover rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Section links collapse to a scrollable strip on small screens. */}
      {signedIn && (
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
