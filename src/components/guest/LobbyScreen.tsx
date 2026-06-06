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

import { motion } from "motion/react";
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

  const playerLabel =
    participantCount === 1 ? "jucător s-a alăturat" : "jucători s-au alăturat";

  return (
    <motion.main
      className="relative min-h-dvh bg-ink flex flex-col items-center justify-center gap-8 px-4 pb-[env(safe-area-inset-bottom)]"
      aria-label="Sală de așteptare"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Non-blocking connection badge — floats above content */}
      <SyncStatusBadge status={status} />

      {/* Game title */}
      <div className="text-center">
        <h1 className="font-heading text-3xl font-bold text-gradient-gold leading-tight">
          Joc
        </h1>
        <p className="text-sm text-champagne-dim/70 mt-1">
          Cristina &amp; Andrei · 26.09.2026
        </p>
      </div>

      {/* Live participant count — hero number */}
      <div className="text-center">
        <span
          className="text-6xl font-bold font-heading text-champagne block tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {participantCount}
        </span>
        <span className="text-sm text-champagne-dim mt-1 block">
          {playerLabel}
        </span>
      </div>

      {/* QR code card — URL included inside the card */}
      <Card className="glass w-full max-w-[280px] border-0">
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <p className="text-xs text-champagne-dim/70 text-center">
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
          {appUrl && (
            <p className="text-xs text-champagne-dim/50 text-center break-all">
              {appUrl}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Animated waiting dots — visual pulse that game will start soon */}
      <div
        className="flex items-center gap-2"
        aria-hidden="true"
        title="Se așteaptă startul jocului"
      >
        <span className="w-2 h-2 rounded-full bg-gold/50 dot-1" />
        <span className="w-2 h-2 rounded-full bg-gold/50 dot-2" />
        <span className="w-2 h-2 rounded-full bg-gold/50 dot-3" />
      </div>
    </motion.main>
  );
}
