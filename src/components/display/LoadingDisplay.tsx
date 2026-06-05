"use client";

/**
 * LoadingDisplay — pre-sync loading screen for the TV display surface (DISP-01).
 *
 * Shown while useGameSync is initialising (state === null) or as the fallback
 * for unexpected phase values in the exhaustive switch.
 *
 * Typography + tokens follow 06-UI-SPEC.md §LoadingDisplay:
 *   - CSS spinner using border-t-gold animate-spin
 *   - "Se încarcă..." label in champagne-dim
 *   - Full-screen centered on bg-ink
 */
export function LoadingDisplay() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[3vh] bg-ink">
      {/* CSS-only spinner — no motion/react dependency (D-07: Phase 6 CSS-only) */}
      <div
        className="w-[6vw] h-[6vw] min-w-[48px] min-h-[48px] rounded-full border-4 border-gold/30 border-t-gold animate-spin"
        role="status"
        aria-label="Se încarcă jocul"
      />
      <p className="text-[1.5vw] text-sm font-normal font-body text-champagne-dim">
        Se încarcă...
      </p>
    </div>
  );
}
