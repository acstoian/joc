"use client";

/**
 * LeaderboardPanel — reusable ranked leaderboard list (D-08).
 *
 * Consumed by RevealScreen (between rounds) and WinnerScreen (game end).
 * Receives leaderboard as prop — never calls useGameSync internally (Pitfall 3).
 *
 * Top-3 highlighting per UI-SPEC §"Screen 6: LeaderboardPanel":
 *   #1 → gold badge + text-gold-bright font-bold
 *   #2 → silver-tinted badge + text-champagne
 *   #3 → blush-tinted badge + text-champagne
 *   #4+ → plain rank number + text-champagne-dim
 *
 * Separator between entries (not after last) using shadcn Separator.
 */

import { Trophy } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type LeaderboardEntry = { name: string; score: number };

/** Colored rank badge for top-3; plain number chip for the rest. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gold/20 border border-gold/50"
        aria-label="Locul 1"
      >
        <Trophy className="size-3.5 text-gold-bright" aria-hidden="true" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-champagne-dim/40 text-champagne-dim text-xs font-bold"
        aria-label={`Locul ${rank}`}
      >
        {rank}
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-blush/40 text-blush text-xs font-bold"
        aria-label={`Locul ${rank}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className="w-7 text-xs text-champagne-dim/60 text-right shrink-0"
      aria-label={`Locul ${rank}`}
    >
      {rank}
    </span>
  );
}

function getNameClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne font-medium";
  return "text-champagne-dim";
}

function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold tabular-nums";
  return "text-gold/80 tabular-nums";
}

export function LeaderboardPanel({
  leaderboard,
}: {
  leaderboard: LeaderboardEntry[];
}) {
  if (leaderboard.length === 0) return null;

  return (
    <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6 pb-4">
      <h3 className="text-sm font-semibold font-heading text-champagne-dim text-center uppercase tracking-widest mb-3">
        Clasament
      </h3>
      <ol role="list" className="flex flex-col">
        {leaderboard.map((entry, index) => {
          const rank = index + 1;
          const isLast = index === leaderboard.length - 1;

          return (
            <li key={`${entry.name}-${entry.score}-${index}`}>
              <div className="flex items-center gap-3 py-3 px-1">
                <RankBadge rank={rank} />
                <span className={cn("flex-1 text-base truncate", getNameClasses(rank))}>
                  {entry.name}
                </span>
                <span className={cn("text-sm shrink-0", getScoreClasses(rank))}>
                  {entry.score} pt
                </span>
              </div>
              {!isLast && <Separator className="bg-champagne/8" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
