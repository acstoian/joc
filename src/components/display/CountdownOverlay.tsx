"use client";

/**
 * CountdownOverlay — full-screen countdown overlay for the TV display surface (D-09, DISP-08).
 *
 * STUB — replaced by Plan 06-03 with the full cinematic overlay (bg-ink/80 backdrop,
 * Playfair Display text-[20vw] gold number with fade-scale animation).
 * Uses the real prop signature so DisplayPage (06-01) and 06-03 are drop-in compatible.
 *
 * Renders above the phase screen (z-40) — never as an early return replacement
 * so useGameSync updates continue to flow through to the underlying screen (Pitfall 7).
 */

interface CountdownOverlayProps {
  countdown: number;
}

export function CountdownOverlay({ countdown }: CountdownOverlayProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/80">
      <span className="text-[20vw] font-bold font-heading text-gold-bright leading-none select-none">
        {countdown}
      </span>
    </div>
  );
}
