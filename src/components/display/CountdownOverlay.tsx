"use client";

/**
 * CountdownOverlay — full-screen 3→2→1 countdown overlay for the TV display
 * surface (D-09, DISP-08).
 *
 * Stateless — NO setInterval/useState here. The interval lives in the
 * DisplayPage shell (Correction 6). This component only renders the current
 * tick number with the fade-scale animation.
 *
 * key={countdown} on the span re-mounts it each tick so the CSS animation
 * re-fires from the start on every count change.
 *
 * Renders at z-40 above the current phase screen — does NOT replace the
 * underlying screen, so useGameSync updates continue to flow through
 * to the background (Pitfall 7).
 *
 * text-[20vw] is a documented one-off exception permitted only in this
 * component per UI-SPEC §Typography exceptions.
 */

export function CountdownOverlay({ countdown }: { countdown: number }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/80 backdrop-blur-sm">
      <span
        key={countdown}
        className="text-[20vw] font-bold font-heading text-gold-bright leading-none select-none [animation:fade-scale_200ms_ease-out]"
      >
        {countdown}
      </span>
    </div>
  );
}
