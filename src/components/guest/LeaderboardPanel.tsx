"use client";

/**
 * LeaderboardPanel — reusable ranked leaderboard list (D-08).
 *
 * Consumed by RevealScreen (between rounds) and WinnerScreen (game end).
 * Receives leaderboard as prop — never calls useGameSync internally (Pitfall 3).
 *
 * Top-3 highlighting per UI-SPEC §"Screen 6: LeaderboardPanel":
 *   #1 → text-gold-bright font-bold (name + score)
 *   #2-#3 → text-champagne (default)
 *   #4+ → text-champagne-dim
 *
 * Separator between entries (not after last) using shadcn Separator.
 */

import { Separator } from "@/components/ui/separator";

type LeaderboardEntry = { name: string; score: number };

function getRankClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne";
  return "text-champagne-dim";
}

function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  return "text-gold";
}

export function LeaderboardPanel({
  leaderboard,
}: {
  leaderboard: LeaderboardEntry[];
}) {
  if (leaderboard.length === 0) return null;

  return (
    <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6">
      <h3 className="text-base font-bold font-heading text-champagne text-center mb-4">
        Clasament
      </h3>
      <ol role="list" className="flex flex-col">
        {leaderboard.map((entry, index) => {
          const rank = index + 1;
          const rankClasses = getRankClasses(rank);
          const scoreClasses = getScoreClasses(rank);
          const isLast = index === leaderboard.length - 1;

          return (
            <li key={`${entry.name}-${rank}`}>
              <div className="flex items-center gap-3 py-3 px-2">
                <span className="text-sm text-champagne-dim w-6 text-right shrink-0">
                  #{rank}
                </span>
                <span className={`flex-1 text-base truncate ${rankClasses}`}>
                  {entry.name}
                </span>
                <span className={`text-sm ${scoreClasses} shrink-0`}>
                  {entry.score} pt
                </span>
              </div>
              {!isLast && (
                <Separator className="bg-champagne/10" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
