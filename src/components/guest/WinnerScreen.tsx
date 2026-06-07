"use client";

/**
 * WinnerScreen — game-end screen (phase = "ended", D-09, PLAY-07).
 *
 * #1 winner in a glass-gold card (Trophy + name + score).
 * #2 and #3 as compact ranked rows below — no full scrolling leaderboard.
 * One-shot canvas-confetti burst on mount (Pitfall 7 — ref-guarded, dynamic import).
 */

import { useEffect, useRef } from "react";
import { Trophy, Medal } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { Card, CardContent } from "@/components/ui/card";

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
  const winner = top3[0] ?? null;
  const runners = top3.slice(1); // #2 and #3

  return (
    <motion.main
      className="relative min-h-dvh bg-ink flex flex-col items-center px-4 pt-12 pb-[env(safe-area-inset-bottom)]"
      aria-label="Ecranul câștigătorului"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <SyncStatusBadge status={status} />

      <h1 className="font-heading text-3xl font-bold text-gradient-gold text-center">
        Câștigător!
      </h1>

      <div className="thin-divider my-0 mt-5" aria-hidden="true" />

      {/* #1 featured card */}
      <motion.div
        className="w-full max-w-sm mt-6"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
      >
        {winner !== null ? (
          <Card className="glass-gold w-full border-0 py-0 shadow-[0_0_40px_0_rgba(212,168,67,0.2)]">
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Trophy size={64} className="text-gold-bright" aria-hidden="true" />
              <p className="text-3xl font-bold font-heading text-gold-bright text-center leading-tight">
                {winner.name}
              </p>
              <p className="text-sm text-champagne-dim">
                {winner.score}{" "}
                {winner.score === 1 ? "răspuns corect" : "răspunsuri corecte"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-gold w-full border-0 py-0">
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Trophy size={64} className="text-gold-bright" aria-hidden="true" />
              <p className="text-2xl font-bold font-heading text-champagne text-center">
                Felicitări tuturor!
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* #2 and #3 — compact rows */}
      {runners.length > 0 && (
        <motion.div
          className="w-full max-w-sm mt-4 flex flex-col gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
        >
          {runners.map((entry, i) => {
            const rank = i + 2;
            return (
              <div
                key={`${entry.name}-${entry.score}-${rank}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl glass",
                  rank === 2 ? "border border-champagne/20" : "border border-champagne/10"
                )}
              >
                <Medal
                  className={cn(
                    "size-4 shrink-0",
                    rank === 2 ? "text-champagne" : "text-champagne-dim/60"
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium text-champagne truncate">
                  {entry.name}
                </span>
                <span className="text-xs text-gold tabular-nums shrink-0">
                  {entry.score} pt
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.main>
  );
}
