"use server";

/**
 * THROWAWAY PROOF HARNESS — Phase 2 only.
 * Removed / replaced with the real host-control write path in Phase 3/4.
 *
 * Wraps the existing broadcast() helper as a Next.js Server Action so the
 * /sync-demo client page can fire GAME_EVENTs without importing the
 * service-role admin module directly (T-02-08 — service key stays server-only).
 *
 * Usage: await demoBroadcast(gameId, { type: "GAME_STARTED", gameId })
 */

import { broadcast } from "@/lib/supabase/admin";
import type { GameEvent } from "@/lib/realtime/events";

/**
 * Fire a typed GAME_EVENT onto the `game:{gameId}` Supabase Broadcast channel.
 *
 * Topic `game:${gameId}` MUST match the channel name in useGameSync:
 *   `sb.channel(\`game:${gameId}\`)`
 *
 * Event name "GAME_EVENT" MUST match the hook's broadcast filter:
 *   `.on("broadcast", { event: "GAME_EVENT" }, ...)`
 *
 * Exceptions propagate to the caller — the demo page surfaces them in the UI.
 */
export async function demoBroadcast(
  gameId: string,
  event: GameEvent
): Promise<void> {
  await broadcast(`game:${gameId}`, "GAME_EVENT", event as Record<string, unknown>);
}
