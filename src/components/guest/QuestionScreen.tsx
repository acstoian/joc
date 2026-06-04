"use client";

// TODO(05-02): Replace this placeholder with the full A/B question + reveal implementation.

/**
 * QuestionScreen — placeholder for phase "question" and "locked" (PLAY-01..PLAY-05).
 * Full implementation delivered by plan 05-02.
 *
 * Props match the shape GameView passes so 05-02 can drop in without touching page.tsx.
 */

import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { Card, CardContent } from "@/components/ui/card";

export function QuestionScreen({
  state,
  status,
}: {
  state: GameStateSnapshot;
  identity: { deviceToken: string; playerId: string };
  status: SyncStatus;
}) {
  return (
    <main className="relative min-h-dvh bg-ink flex items-center justify-center px-4">
      <SyncStatusBadge status={status} />
      <Card className="glass w-full max-w-[360px] border-0">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-xs text-champagne-dim uppercase tracking-widest">
            Întrebare
          </p>
          <p className="text-base text-champagne font-heading">
            {state.currentQuestion?.body ?? "Se încarcă întrebarea..."}
          </p>
          <p className="text-sm text-champagne-dim/60">(în curând)</p>
        </CardContent>
      </Card>
    </main>
  );
}
