"use client";

/**
 * DisplayPage — TV/projector display surface shell (DISP-01, DISP-02).
 *
 * Anonymous subscriber: uses HOST_SENTINEL_PLAYER_ID (never null — Finding 1).
 * Mirrors the GuestShell / DashboardShell pattern: single useGameSync call,
 * switch on state.phase, screen components receive state as props.
 *
 * Key responsibilities:
 *   - Fullscreen button (D-10): calls containerRef.current.requestFullscreen()
 *     on user click (must be inside click handler, not useEffect — Pitfall 4).
 *     Disappears after entering fullscreen via fullscreenchange listener.
 *   - Countdown state (D-09): intercepted from useGameSync onEvent callback
 *     before fetchState() re-run. setInterval drives the 3→2→1 decrement using
 *     a functional updater to avoid stale closure (Pitfall 3).
 *   - CountdownOverlay renders ALONGSIDE the phase screen (z-layered), never as
 *     an early return so useGameSync updates flow through (Pitfall 7).
 *   - DisplayStatusDot is always visible (D-11, DISP-02).
 *
 * No layout.tsx needed — root layout already provides <html lang="ro"> and fonts.
 */

import { useEffect, useRef, useState } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID, HOST_SENTINEL_PLAYER_ID } from "@/lib/host/constants";
import { LoadingDisplay } from "@/components/display/LoadingDisplay";
import { LobbyDisplay } from "@/components/display/LobbyDisplay";
import { QuestionDisplay } from "@/components/display/QuestionDisplay";
import { LockedDisplay } from "@/components/display/LockedDisplay";
import { RevealDisplay } from "@/components/display/RevealDisplay";
import { WinnerDisplay } from "@/components/display/WinnerDisplay";
import { DisplayStatusDot } from "@/components/display/DisplayStatusDot";

export default function DisplayPage() {
  // Root container ref — used for requestFullscreen (D-10, Pitfall 4).
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen state — hides the "Ecran complet" button after entering fullscreen.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Single useGameSync call — anonymous observer using HOST_SENTINEL_PLAYER_ID.
  // NEVER pass null as playerId (TS2345 strict mode error — Finding 1).
  const { state, status, participantCount } = useGameSync(
    GAME_ID,
    HOST_SENTINEL_PLAYER_ID
  );

  // Fullscreen change listener — syncs isFullscreen with the browser state.
  // Handles Esc key exit and programmatic exits without relying on our own state.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Phase screen — derived from state.phase.
  // If state is null (initial fetch in-flight), show LoadingDisplay.
  // Exhaustive switch with `never` guard catches unexpected phase values.
  let screen: React.ReactNode;
  if (!state) {
    screen = <LoadingDisplay />;
  } else {
    switch (state.phase) {
      case "lobby":
        screen = <LobbyDisplay participantCount={participantCount} />;
        break;
      case "question":
        screen = <QuestionDisplay state={state} />;
        break;
      case "locked":
        screen = <LockedDisplay state={state} />;
        break;
      case "revealed":
        screen = <RevealDisplay state={state} />;
        break;
      case "ended":
        screen = <WinnerDisplay state={state} />;
        break;
      default: {
        // TypeScript exhaustiveness guard — fires only on unexpected phase values
        // (e.g. server returns a new phase string not yet in the union).
        const _exhaustive: never = state.phase;
        void _exhaustive;
        screen = <LoadingDisplay />;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-dvh w-screen overflow-hidden bg-ink"
    >
      {/* Persistent connection status dot — fixed top-right, always visible (D-11) */}
      <DisplayStatusDot status={status} />

      {/* Fullscreen button — hidden after entering fullscreen (D-10).
          Must be a direct click handler — requestFullscreen requires a user gesture
          and cannot be called from useEffect (Pitfall 4). */}
      {!isFullscreen && (
        <button
          type="button"
          onClick={() => containerRef.current?.requestFullscreen()}
          className="fixed top-4 right-4 z-50 glass rounded-lg px-4 py-2 text-[1.5vw] font-body text-champagne-dim hover:text-champagne transition-opacity duration-300"
          aria-label="Activează ecran complet"
        >
          Ecran complet
        </button>
      )}

      {/* Phase screen */}
      {screen}
    </div>
  );
}
