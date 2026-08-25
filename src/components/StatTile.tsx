// src/components/StatTile.tsx
//
// The small metric tile every dashboard leads with: a tinted icon chip, a
// large value, a label under it, and an optional caption for context.

import type { ReactNode } from 'react';

export type StatTone = 'brand' | 'emerald' | 'amber' | 'slate';

const TONES: Record<StatTone, string> = {
  brand: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
};

interface StatTileProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  caption?: string;
  tone?: StatTone;
}

export default function StatTile({ icon, value, label, caption, tone = 'brand' }: StatTileProps) {
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight text-slate-900">{value}</p>
        <p className="mt-1.5 text-sm font-medium text-slate-600">{label}</p>
        {caption && <p className="mt-0.5 truncate text-xs text-slate-500">{caption}</p>}
      </div>
    </div>
  );
}
