"use client";

// TODO(05-03): Replace this placeholder with the full winner + leaderboard + confetti implementation.

/**
 * WinnerScreen — placeholder for phase "ended" (PLAY-07, D-09).
 * Full implementation delivered by plan 05-03.
 *
 * Props match the shape GameView passes so 05-03 can drop in without touching page.tsx.
 */

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
  const winner = state.leaderboard[0] ?? null;

  return (
    <main className="relative min-h-dvh bg-ink flex items-center justify-center px-4">
      <SyncStatusBadge status={status} />
      <Card className="glass w-full max-w-[360px] border-0">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="font-heading text-2xl font-bold text-champagne">
            Câștigător!
          </p>
          {winner && (
            <p className="text-xl font-bold font-heading text-gold-bright">
              {winner.name}
            </p>
          )}
          <p className="text-sm text-champagne-dim/60">(în curând)</p>
        </CardContent>
      </Card>
    </main>
  );
}
