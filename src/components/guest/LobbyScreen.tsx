"use client";

/**
 * LobbyScreen — waiting screen with participant count + QR code (D-11, JOIN-04, JOIN-05).
 *
 * Shown when state.phase === "lobby". Guest waits here until the host starts the game.
 * QR code encodes NEXT_PUBLIC_APP_URL (Pitfall 5 fallback: window.location.origin).
 * Participant count driven by useGameSync presenceCount prop — never calls hook itself (Pitfall 3).
 *
 * Romanian copy per UI-SPEC §"Screen 2: LobbyScreen" + §"Copywriting Contract".
 */

import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import type { SyncStatus } from "@/hooks/useGameSync";

export function LobbyScreen({
  participantCount,
  status,
}: {
  participantCount: number;
  status: SyncStatus;
}) {
  // Pitfall 5: fallback to window.location.origin when NEXT_PUBLIC_APP_URL is unset.
  // typeof window guard is required — this component is a client component but may
  // be rendered on the server during SSR before hydration.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <main
      className="relative min-h-dvh bg-ink flex flex-col items-center justify-center gap-8 px-4 pb-[env(safe-area-inset-bottom)]"
      aria-label="Sală de așteptare"
    >
      {/* Non-blocking connection badge — floats above content */}
      <SyncStatusBadge status={status} />

      {/* Lobby heading */}
      <h1 className="font-heading text-2xl font-bold text-champagne text-center">
        Aștepți jocul...
      </h1>

      {/* Live participant count */}
      <div className="text-center">
        <span className="text-2xl font-bold font-heading text-champagne">
          {participantCount}
        </span>
        <span className="text-sm text-champagne-dim">
          {" "}jucători s-au alăturat
        </span>
      </div>

      {/* QR code card */}
      <Card className="glass w-full max-w-[280px] border-0">
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <p className="text-xs text-champagne-dim text-center">
            Invită prietenii
          </p>
          {appUrl && (
            <QRCode
              value={appUrl}
              size={160}
              bgColor="transparent"
              fgColor="#f5e6c8"
              aria-label="Cod QR pentru a intra în joc"
            />
          )}
        </CardContent>
      </Card>

      {/* Shareable URL text */}
      {appUrl && (
        <p className="text-xs text-champagne-dim/60 text-center max-w-[280px] break-all">
          {appUrl}
        </p>
      )}
    </main>
  );
}
