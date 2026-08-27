'use client';

// src/components/BottomNavBar.tsx
//
// Fixed bottom tab bar for phones/tablets (<768px). Replaces the old
// hamburger drawer as the primary way to reach a section's nav links on
// small screens -- the top header stays lean (logo + sign out/in only)
// and the destinations live within thumb reach at the bottom instead.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => ReactNode;
}

export default function BottomNavBar({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    // Floats clear of the physical bottom edge instead of sitting flush
    // against it -- a mobile browser's own address/tab bar can occupy or
    // overlap that exact edge, which made a flush full-width bar look like
    // it was glitching into the browser chrome. Margin + shadow here reads
    // as an intentional floating pill instead.
    //
    // Positioned directly on the <nav> itself (centered via left-1/2 +
    // -translate-x-1/2) rather than inside a full-width fixed wrapper div --
    // an earlier version used a transparent full-bleed wrapper to hold the
    // side margins, which sat over the entire bottom strip of the screen and
    // interfered with scrolling past that point even though it had
    // pointer-events-none.
    <nav
      aria-label="Primary"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-stretch justify-around rounded-full border border-brand-200/70 bg-white shadow-[0_4px_14px_-4px_rgba(30,132,129,0.3)] lg:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[0.65rem] font-semibold transition ${
              active ? 'text-brand-700' : 'text-slate-500'
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
