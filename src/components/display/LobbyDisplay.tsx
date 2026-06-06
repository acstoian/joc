"use client";

/**
 * LobbyDisplay — lobby phase screen for the TV display surface (D-01, DISP-01).
 *
 * Shows the game title and a live participant count that briefly pulses when
 * the count changes — signalling live sync without requiring constant motion.
 *
 * Design tokens: champagne, gold, champagne-dim per 06-UI-SPEC.md §LobbyDisplay.
 * Typography: Playfair Display (font-heading) for title, Inter (font-body) for label.
 * All sizes are viewport-relative so text is readable from 3-4m on a TV.
 *
 * Pulse mechanism: one-shot useEffect toggles `pulsing` for 600ms on each
 * participantCount change. Uses Tailwind animate-pulse (CSS-only, no motion/react).
 * The reduced-motion override in globals.css sets animate-pulse to animation:none.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LobbyDisplayProps {
  participantCount: number;
}

export function LobbyDisplay({ participantCount }: LobbyDisplayProps) {
  const [pulsing, setPulsing] = useState(false);

  // One-shot pulse for 600ms whenever participantCount changes (D-01).
  // Functional pattern: set true → schedule clear → cleanup on unmount/re-run.
  useEffect(() => {
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 600);
    return () => clearTimeout(t);
  }, [participantCount]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[2vh] bg-ink px-[8vw]">
      {/* Game title */}
      <h1 className="text-[6vw] font-bold font-heading text-gradient-gold text-center leading-tight">
        Joc — Cristina &amp; Andrei
      </h1>

      {/* Thin gold rule */}
      <div className="thin-divider" />

      {/* Live participant count block */}
      <div className="flex flex-col items-center gap-[1vh]">
        <span
          className={cn(
            "text-[4vw] font-bold font-heading text-champagne transition-colors duration-300",
            pulsing && "animate-pulse"
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {participantCount}
        </span>
        <span className="text-[1.5vw] font-normal font-body text-champagne-dim">
          {participantCount === 1
            ? "jucător s-a alăturat"
            : "jucători s-au alăturat"}
        </span>
      </div>

      {/* Waiting subtitle */}
      <p className="text-[1.5vw] font-normal font-body text-champagne-dim/60 mt-[2vh]">
        Așteptăm să înceapă...
      </p>
    </div>
  );
}
