// src/components/Logo.tsx
//
// The KayApp brand mark plus wordmark. Rendered from /public/logo.png, so
// replacing that one file swaps the mark everywhere it appears.
//
// The asset was cropped to the artwork and its opaque near-white background
// keyed out to transparency; the untouched upload is kept as logo-source.png.
// If it is ever replaced at a different aspect ratio, update MARK_ASPECT.
//
// Wrapped in a link to the homepage by default: this is what ties the auth
// screens, dashboards and directory back to the marketing site.

import Link from 'next/link';

/** Width / height of the mark, from the cropped asset's own dimensions. */
const MARK_ASPECT = 212 / 277;

interface LogoProps {
  /** Height of the mark in pixels. The wordmark scales alongside it. */
  size?: number;
  /** Hide the "KayApp" wordmark and show the mark alone. */
  markOnly?: boolean;
  /** Render as static content instead of a link home. */
  href?: string | null;
  className?: string;
}

export default function Logo({ size = 34, markOnly = false, href = '/', className = '' }: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={Math.round(size * MARK_ASPECT)}
        height={size}
        style={{ height: size, width: 'auto' }}
        className="shrink-0"
      />
      {!markOnly && (
        <span
          className="font-bold tracking-tight text-slate-900"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          Kay<span className="text-brand-600">App</span>
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="KayApp home" className="fluid-hover inline-flex hover:opacity-80">
      {content}
    </Link>
  );
}
