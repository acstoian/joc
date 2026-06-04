"use client";

/**
 * GuestShell — root guest app entry point (D-01, D-07).
 *
 * Replaces the throwaway sync-demo Server Component. This is a single-page
 * client component that:
 *   1. Reads localStorage identity on mount (SSR-safe, hydrated guard)
 *   2. Shows NameGate for first-time guests (identity === null) (D-03)
 *   3. Mounts GameView for returning guests (identity present) — skips gate
 *
 * GameView calls useGameSync EXACTLY ONCE and switches on state.phase (D-07).
 * Screen components receive state/status/participantCount as PROPS — they
 * never call useGameSync themselves (Pitfall 3 — no duplicate channels).
 *
 * No routing segments, no AnimatePresence — Phase 5 uses simple conditional
 * renders; Phase 7 adds animation polish (D-07).
 *
 * Security: no server-only imports; no service_role key; anon key only in client.
 */

import { useEffect, useState } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID } from "@/lib/host/constants";
import { getIdentity } from "@/lib/guest/identity";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { NameGate } from "@/components/guest/NameGate";
import { LobbyScreen } from "@/components/guest/LobbyScreen";
import { QuestionScreen } from "@/components/guest/QuestionScreen";
import { RevealScreen } from "@/components/guest/RevealScreen";
import { WinnerScreen } from "@/components/guest/WinnerScreen";
import type { SyncStatus } from "@/hooks/useGameSync";

// ── Types ─────────────────────────────────────────────────────────────────────

type Identity = { deviceToken: string; playerId: string };

// ── Loading screen ─────────────────────────────────────────────────────────────

/**
 * LoadingScreen — shown when state is null (initial fetch in-flight) or
 * when the phase falls through the switch (unknown/unexpected phase).
 * Pitfall 2: state === null must be handled — phase switch has no null case.
 */
function LoadingScreen({ status }: { status: SyncStatus }) {
  return (
    <main
      className="relative min-h-dvh bg-ink flex items-center justify-center"
      aria-label="Se încarcă jocul"
    >
      <SyncStatusBadge status={status} />
      <span className="sr-only">Se încarcă...</span>
    </main>
  );
}

// ── Game view ──────────────────────────────────────────────────────────────────

/**
 * GameView — mounts useGameSync once and routes to phase screens.
 *
 * Single hook call (D-07, Pitfall 3). All screens are passed state + status
 * as props — they are pure presentational components with no direct Supabase
 * subscriptions.
 */
function GameView({ identity }: { identity: Identity }) {
  const { state, status, participantCount } = useGameSync(
    GAME_ID,
    identity.playerId
  );

  // Pitfall 2: handle null state before switch (initial load, no fetch yet resolved)
  if (state === null) {
    return <LoadingScreen status={status} />;
  }

  switch (state.phase) {
    case "lobby":
      return (
        <LobbyScreen participantCount={participantCount} status={status} />
      );

    case "question":
    case "locked":
      return (
        <QuestionScreen
          state={state}
          identity={identity}
          status={status}
        />
      );

    case "revealed":
      return <RevealScreen state={state} status={status} />;

    case "ended":
      return <WinnerScreen state={state} status={status} />;

    default: {
      // TypeScript exhaustiveness: state.phase is a known union; this branch
      // fires only if the server sends an unexpected phase value.
      const _exhaustive: never = state.phase;
      void _exhaustive;
      return <LoadingScreen status={status} />;
    }
  }
}

// ── Guest shell ────────────────────────────────────────────────────────────────

/**
 * GuestShell — root export for `/`.
 *
 * Hydration pattern mirrors src/app/host/page.tsx (HostPage):
 *   - `hydrated` starts false; useEffect sets it true after localStorage read
 *   - Pre-hydration: render neutral bg-ink element (avoids flashing gate, Pitfall 4)
 *   - Post-hydration: show gate (identity null) or game view (identity present)
 */
export default function GuestShell() {
  const [hydrated, setHydrated] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    // Read localStorage once on mount. getIdentity() is SSR-safe.
    setIdentity(getIdentity());
    setHydrated(true);
  }, []);

  // Pre-hydration: blank ink screen — no gate, no game (Pitfall 4, D-03)
  if (!hydrated) {
    return <main className="min-h-dvh bg-ink" aria-hidden="true" />;
  }

  // First-time guest: show full-screen name gate (D-03, D-10)
  if (identity === null) {
    return <NameGate onJoined={setIdentity} />;
  }

  // Returning guest: skip gate, go straight to live game view (D-03)
  return <GameView identity={identity} />;
}
