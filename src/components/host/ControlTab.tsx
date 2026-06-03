"use client";

/**
 * ControlTab — placeholder component (Plan 04-01).
 *
 * Minimal placeholder card. Plan 04-02 replaces this with the full live-control
 * surface (phase buttons, emergency panel, distribution bar).
 *
 * Shared props contract (consumed by all three tab components):
 *   state            — GameStateSnapshot | null from useGameSync
 *   status           — SyncStatus from useGameSync
 *   participantCount — number from useGameSync
 *   password         — stored host password from useHostAuth (for API calls)
 *   gameId           — the current game UUID (GAME_ID constant)
 */

import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface HostTabProps {
  state: GameStateSnapshot | null;
  status: SyncStatus;
  participantCount: number;
  password: string;
  gameId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ControlTab(_props: HostTabProps) {
  return (
    <Card className="glass border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base font-bold text-champagne">
          Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-champagne-dim/60">(in curand)</p>
      </CardContent>
    </Card>
  );
}
