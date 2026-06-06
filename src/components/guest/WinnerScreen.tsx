"use client";

/**
 * WinnerScreen — game-end screen (phase = "ended", D-09, PLAY-07).
 *
 * Features:
 *   - #1 player featured prominently in a glass-gold Card (D-09)
 *   - Full final leaderboard via LeaderboardPanel (PLAY-06)
 *   - One-shot canvas-confetti burst on mount (Pitfall 7 — ref-guarded, dynamic import)
 *
 * Receives state + status as props from GameView — does NOT call useGameSync (Pitfall 3).
 *
 * Security: display names rendered as React text nodes (no dangerouslySetInnerHTML — T-05-08).
 * Performance: canvas-confetti is dynamically imported, never static-imported (T-05-07, Performance Contract).
 */

import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";
import { Card, CardContent } from "@/components/ui/card";

export function WinnerScreen({
  state,
  status,
}: {
  state: GameStateSnapshot;
  status: SyncStatus;
}) {
  const confettiFired = useRef(false);

  // Fire confetti exactly once on mount (Pitfall 7 — useRef guard prevents re-fire).
  // Dynamic import keeps canvas-confetti out of the main bundle until the ended phase
  // (Performance Contract — must NOT be a static top-level import).
  // WinnerScreen only mounts when state.phase === "ended" (D-07 single-mount guarantee),
  // so empty-deps effect runs exactly once per game-end transition.
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

  const winner = state.leaderboard[0] ?? null;

  return (
    <motion.main
      className="relative min-h-dvh bg-ink flex flex-col items-center px-4 pt-12 pb-[env(safe-area-inset-bottom)]"
      aria-label="Ecranul câștigătorului"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Absolute-positioned badge — does not participate in flex column flow */}
      <SyncStatusBadge status={status} />

      {/* Heading */}
      <h1 className="font-heading text-3xl font-bold text-gradient-gold text-center">
        Câștigător!
      </h1>

      <div className="thin-divider my-0 mt-5" aria-hidden="true" />

      {/* #1 featured card — staggered entrance, glass-gold treatment (D-09) */}
      <motion.div
        className="w-full max-w-sm mt-6"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
      >
        {winner !== null ? (
          <Card className="glass-gold w-full border-0 py-0 shadow-[0_0_40px_0_rgba(212,168,67,0.2)]">
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Trophy
                size={64}
                className="text-gold-bright"
                aria-hidden="true"
              />
              {/* Winner name — gold-bright, Playfair Display, prominent (D-09) */}
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
          /* Graceful fallback — no leaderboard data */
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

      <div className="thin-divider my-0 mt-6" aria-hidden="true" />

      {/* Full final leaderboard — PLAY-06, D-09 */}
      <LeaderboardPanel leaderboard={state.leaderboard} />
    </motion.main>
  );
}
