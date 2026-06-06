"use client";

/**
 * WinnerDisplay — winner screen for the TV display surface (D-06, DISP-07).
 *
 * #1 player in a cinematic gold hero slot (trophy + gradient name) with the full
 * ranked leaderboard below (staggered motion.ol/li, D-03). Rendered when
 * state.phase === "ended".
 *
 * TV confetti burst fires once on mount (D-09) from upper-center (y: 0.3) —
 * overrides the Phase 5 "guest-side only" note. Skipped under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Separator } from "@/components/ui/separator";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
// LeaderboardPanel removed — replaced with inline stagger (Plan 07-02)

// ── Local rank helpers (copied from LeaderboardPanel — do not import from there) ──

function getRankClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne";
  return "text-champagne-dim";
}

function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  return "text-gold";
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export function WinnerDisplay({ state }: { state: GameStateSnapshot }) {
  const confettiFired = useRef(false);
  const shouldReduce = useReducedMotion();

  // TV winner confetti — fires once on mount (D-09).
  // 150 particles from upper-center (y: 0.3) fall down across the landscape projector.
  // Dynamic import keeps canvas-confetti off the initial bundle (Pitfall 4).
  useEffect(() => {
    if (shouldReduce !== false) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.3 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"],
      });
    });
  }, [shouldReduce]);

  // Guard against empty leaderboard
  const winner = state.leaderboard[0] ?? null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[4vh] px-[5vw] py-[5vh]">

      {/* Heading */}
      <h1 className="text-[6vw] font-bold font-heading text-champagne text-center">
        Câștigător!
      </h1>

      <div className="thin-divider" />

      {/* #1 hero slot — only rendered when a winner exists */}
      {winner && (
        <div
          className="glass-gold rounded-3xl flex flex-col items-center gap-[2vh] px-[6vw] py-[4vh] border border-gold/30 shadow-[0_0_60px_0_rgba(212,168,67,0.3)]"
        >
          <Trophy
            className="text-gold-bright w-[5vw] h-[5vw]"
            aria-hidden="true"
          />
          {/* Winner name — gold gradient (D-06) */}
          <p className="text-[6vw] font-bold font-heading text-gradient-gold text-center">
            {winner.name}
          </p>
          <p className="text-[2vw] font-normal font-body text-champagne-dim">
            {winner.score} răspunsuri corecte
          </p>
        </div>
      )}

      <div className="thin-divider" />

      <h2 className="text-[4vw] font-bold font-heading text-champagne text-center">
        Clasament final
      </h2>

      {/* Full leaderboard with scale wrapper — staggered (D-03) */}
      <div className="w-full max-w-[55vw] mx-auto transform scale-150 origin-top">
        {state.leaderboard.length > 0 && (
          <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6">
            <h3 className="text-base font-bold font-heading text-champagne text-center mb-4">
              Clasament
            </h3>
            {shouldReduce ? (
              <ol role="list" className="flex flex-col">
                {state.leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isLast = index === state.leaderboard.length - 1;
                  return (
                    <li key={`${entry.name}-${entry.score}-${index}`}>
                      <div className="flex items-center gap-3 py-3 px-2">
                        <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                        <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                        <span className={`text-sm ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                      </div>
                      {!isLast && <Separator className="bg-champagne/10" />}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <motion.ol
                role="list"
                className="flex flex-col"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {state.leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isLast = index === state.leaderboard.length - 1;
                  return (
                    <motion.li key={`${entry.name}-${entry.score}-${index}`} variants={rowVariants}>
                      <div className="flex items-center gap-3 py-3 px-2">
                        <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                        <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                        <span className={`text-sm ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                      </div>
                      {!isLast && <Separator className="bg-champagne/10" />}
                    </motion.li>
                  );
                })}
              </motion.ol>
            )}
          </div>
        )}
      </div>

      <p className="text-[1.5vw] font-normal font-body text-champagne-dim/60 text-center mt-[3vh]">
        Felicitări tuturor!
      </p>
    </div>
  );
}
