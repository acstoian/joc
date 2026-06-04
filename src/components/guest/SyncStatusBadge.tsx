"use client";

/**
 * SyncStatusBadge — non-blocking top connection status badge (D-12).
 *
 * Driven by SyncStatus from useGameSync. Returns null when connected
 * (clean screen). Shows a small pill at the top center for all other states.
 *
 * Position: absolute top-3 left-1/2 -translate-x-1/2 z-20 — floats above
 * all screen content without pushing layout.
 *
 * Copy (Romanian per D-12):
 *   connecting   → "Se conectează..."   (champagne-dim, subtle)
 *   reconnecting → "Reconectare..."     (gold pulse, more visible)
 *   error        → "Eroare conexiune"   (red, alarming but not blocking)
 */

import type { SyncStatus } from "@/hooks/useGameSync";

const STATUS_COPY: Record<Exclude<SyncStatus, "connected">, string> = {
  connecting: "Se conectează...",
  reconnecting: "Reconectare...",
  error: "Eroare conexiune",
};

const STATUS_CLASSES: Record<Exclude<SyncStatus, "connected">, string> = {
  connecting: "bg-champagne/10 text-champagne-dim",
  reconnecting: "animate-pulse bg-gold/20 text-gold",
  error: "bg-red-500/20 text-red-400",
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  // D-12: no badge when connected — clean screen
  if (status === "connected") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "absolute top-3 left-1/2 -translate-x-1/2 z-20",
        "rounded-full px-3 py-1 text-xs font-medium",
        STATUS_CLASSES[status],
      ].join(" ")}
    >
      {STATUS_COPY[status]}
    </div>
  );
}
