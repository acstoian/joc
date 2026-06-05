"use client";

/**
 * DisplayStatusDot — persistent connection status indicator for the TV display (D-11, DISP-02).
 *
 * Fixed top-right, always visible, driven by SyncStatus from useGameSync.
 *
 * States:
 *   "connected"    → green dot (bg-sage), no label — clean screen during play
 *   "connecting"   → amber dot (bg-gold), "Se conectează..." label
 *   "reconnecting" → amber pulsing dot (bg-gold animate-pulse), "Reconectare..." label
 *   "error"        → red dot (bg-red-500), "Eroare" label
 *
 * Positioned below the "Ecran complet" button (top-[calc(3.5rem+0.5rem)]) so
 * both controls are visible without overlapping.
 *
 * Accessibility: role="status" aria-live="polite" announces state changes to
 * screen readers without interrupting the current announcement.
 */

import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/hooks/useGameSync";

interface DisplayStatusDotProps {
  status: SyncStatus;
}

const STATUS_LABEL: Record<SyncStatus, string | null> = {
  connected: null,
  connecting: "Se conectează...",
  reconnecting: "Reconectare...",
  error: "Eroare",
};

export function DisplayStatusDot({ status }: DisplayStatusDotProps) {
  const label = STATUS_LABEL[status];

  return (
    <div
      className="fixed top-[calc(3.5rem+0.5rem)] right-4 z-50 flex items-center gap-[0.5vw]"
      role="status"
      aria-live="polite"
    >
      {/* Status dot */}
      <div
        className={cn(
          "w-[0.8vw] h-[0.8vw] min-w-[8px] min-h-[8px] rounded-full",
          status === "connected" && "bg-sage",
          status === "connecting" && "bg-gold",
          status === "reconnecting" && "bg-gold animate-pulse",
          status === "error" && "bg-red-500"
        )}
        aria-hidden="true"
      />

      {/* Label — only shown for non-connected states */}
      {label !== null && (
        <span
          className={cn(
            "text-[1.5vw] text-xs font-normal font-body",
            status === "connecting" && "text-champagne-dim",
            status === "reconnecting" && "text-gold",
            status === "error" && "text-red-400"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
