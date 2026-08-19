'use client';

import { useEffect, useRef } from 'react';

export default function AmbientBackground() {
  const mouseGlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const updatePosition = () => {
      // Smooth damped lerp for buttery organic movement
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;

      if (mouseGlowRef.current) {
        mouseGlowRef.current.style.transform = `translate3d(${currentX - 250}px, ${currentY - 250}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* ── Fixed Drifting Glowing Halos (GPU Accelerated) ──────────────────── */}

      {/* Primary Violet-Lavender Halo (Top Left Drifter) */}
      <div className="absolute -top-[15%] -left-[10%] h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-violet-400/20 via-purple-300/15 to-indigo-300/10 blur-[100px] animate-ambient-drift-1" />

      {/* Rose-Peach Warm Glow (Top Right Drifter) */}
      <div className="absolute top-[5%] -right-[12%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-rose-300/15 via-pink-200/15 to-purple-200/10 blur-[110px] animate-ambient-drift-2" />

      {/* Ethereal Soft Cyan-Blue Accent (Center-Bottom Drifter) */}
      <div className="absolute top-[45%] left-[20%] h-[500px] w-[500px] rounded-full bg-gradient-to-r from-sky-300/10 via-teal-200/10 to-indigo-300/15 blur-[120px] animate-ambient-drift-3" />

      {/* Deep Violet Horizon Glow (Bottom Right Drifter) */}
      <div className="absolute -bottom-[15%] right-[5%] h-[580px] w-[580px] rounded-full bg-gradient-to-tl from-purple-400/15 via-violet-300/15 to-transparent blur-[110px] animate-ambient-drift-1" />

      {/* ── Interactive Smooth Cursor Halo Aura ────────────────────────────── */}
      <div
        ref={mouseGlowRef}
        className="absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-violet-400/10 via-purple-300/10 to-indigo-300/5 blur-[90px] opacity-75 will-change-transform"
        style={{
          transform: 'translate3d(-250px, -250px, 0)',
        }}
      />

      {/* Subtle delicate grain / grid overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#2A2338_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-[0.025]" />
    </div>
  );
}
