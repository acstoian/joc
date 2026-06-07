"use client";

/**
 * WinnerScreen — end-game screen on the guest phone (phase = "ended").
 *
 * Fun recap of the top-3 players — no winner declaration. All content
 * fits within h-dvh (no scroll). One-shot confetti on mount.
 */

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";

const RANK_COLORS = [
  "text-gold-bright",   // #1
  "text-champagne",     // #2
  "text-champagne-dim", // #3
];

const RANK_BORDER = [
  "border-gold/30",
  "border-champagne/20",
  "border-champagne/10",
];

export function WinnerScreen({
  state,
  status,
}: {
  state: GameStateSnapshot;
  status: SyncStatus;
}) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"],
      });
    });
  }, []);

  const top3 = state.leaderboard.slice(0, 3);

  return (
    /* h-dvh — hard lock so nothing spills below the fold */
    <motion.main
      className="relative h-dvh bg-ink flex flex-col items-center justify-center gap-5 px-4 pb-[env(safe-area-inset-bottom)]"
      aria-label="Joc terminat"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <SyncStatusBadge status={status} />

      <h1 className="font-heading text-3xl font-bold text-champagne text-center">
        Mulțumim tuturor!
      </h1>

      <div className="thin-divider w-full max-w-xs" aria-hidden="true" />

      {/* Top-3 rows — equal visual weight */}
      {top3.length > 0 ? (
        <motion.div
          className="w-full max-w-sm flex flex-col gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
        >
          {top3.map((entry, i) => (
            <div
              key={`${entry.name}-${entry.score}-${i}`}
              className={cn(
                "glass rounded-xl flex items-center gap-3 px-4 py-3 border",
                RANK_BORDER[i]
              )}
            >
              <span className={cn("text-sm font-bold tabular-nums w-6 text-right shrink-0", RANK_COLORS[i])}>
                #{i + 1}
              </span>
              <span className="flex-1 text-base font-semibold font-heading text-champagne truncate">
                {entry.name}
              </span>
              <span className="text-sm text-gold tabular-nums shrink-0">
                {entry.score} pt
              </span>
            </div>
          ))}
        </motion.div>
      ) : (
        <p className="text-sm text-champagne-dim/60">Nu există jucători înregistrați.</p>
      )}

      <div className="thin-divider w-full max-w-xs" aria-hidden="true" />

      <p className="text-sm text-champagne-dim/50 text-center">
        Cristina &amp; Andrei · 26.09.2026
      </p>
    </motion.main>
  );
}
