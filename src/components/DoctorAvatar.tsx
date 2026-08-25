'use client';

// src/components/DoctorAvatar.tsx
//
// Portrait for a doctor. The seeded roster has no uploaded photos, so this
// picks a stand-in portrait deterministically from the doctor's id: the same
// doctor always gets the same face, and the directory looks populated.
//
// The pool is chosen by hashing the id alone. Nothing here is derived from the
// doctor's name or any personal attribute, and the picture says nothing about
// who they are. Once real uploads exist, pass `src` and this falls through to it.
//
// If the remote image fails (offline, blocked, rate-limited) the component
// renders initials on a tinted disc instead of a broken image.

import { useState } from 'react';

interface DoctorAvatarProps {
  name: string;
  id: string;
  /** A real uploaded photo, when one exists. Takes precedence over the stand-in. */
  src?: string | null;
  size?: number;
  className?: string;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const words = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Stand-in portrait URL, stable for a given id. */
function placeholderPortrait(id: string): string {
  const h = hash(id);
  const pool = h % 2 === 0 ? 'men' : 'women';
  return `https://randomuser.me/api/portraits/${pool}/${h % 100}.jpg`;
}

export default function DoctorAvatar({ name, id, src, size = 56, className = '' }: DoctorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = src || placeholderPortrait(id);

  if (failed) {
    return (
      <div
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        className={`flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 ${className}`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    // Plain <img>: these are small, already-sized avatars from a rate-limited
    // host, so routing them through the Next optimizer buys nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Portrait of ${name}`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover ${className}`}
    />
  );
}
