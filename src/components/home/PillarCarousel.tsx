'use client';

// Horizontal, snap-scrolling row of feature/pillar cards -- same scroll-track
// and prev/next chevron mechanics as ServiceCarousel.tsx, but each card
// splits into a left-40% picture and a right-60% icon+title+body block
// instead of a full-bleed image with a text overlay.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';

export interface PillarCard {
  icon: ReactNode;
  title: string;
  body: string;
  image: string;
  /** Describes the photo for screen readers. */
  alt: string;
}

export default function PillarCarousel({ cards }: { cards: PillarCard[] }) {
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
          aria-label="Show previous"
          className="fluid-hover flex h-12 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={atEnd}
          aria-label="Show more"
          className="fluid-hover flex h-12 w-16 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <article
            key={card.title}
            className="relative h-[480px] w-[340px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-[520px] sm:w-[400px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image} alt={card.alt} className="absolute inset-0 h-full w-full object-cover" />
            {/* Gradient shadow, darkest at the bottom where the caption sits */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
            {/* Icon, title, and body -- all in the bottom caption */}
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                {card.icon}
              </div>
              <h3 className="mt-4 text-2xl font-bold leading-tight text-white">{card.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-200">{card.body}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
