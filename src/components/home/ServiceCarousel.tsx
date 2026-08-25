'use client';

// Horizontal, snap-scrolling row of service cards with prev/next controls,
// mirroring the reference site's "what we offer" strip. Each card is an image
// with a dark scrim at the bottom carrying the label and a pill action.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';

export interface ServiceCard {
  title: string;
  action: string;
  href: string;
  image: string;
  /** Describes the photo for screen readers. */
  alt: string;
}

export default function ServiceCarousel({ cards }: { cards: ServiceCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  function scrollBy(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    // Advance by roughly one card plus its gap.
    el.scrollBy({ left: direction * (el.clientWidth * 0.6), behavior: 'smooth' });
  }

  return (
    <div>
      <div className="mb-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={atStart}
          aria-label="Show previous services"
          className="fluid-hover flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={atEnd}
          aria-label="Show more services"
          className="fluid-hover flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <article
            key={card.title}
            className="relative h-72 w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:w-64"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.image}
              alt={card.alt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="text-base font-bold leading-snug text-white">{card.title}</h3>
              <Link
                href={card.href}
                className="fluid-hover mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
              >
                {card.action}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
