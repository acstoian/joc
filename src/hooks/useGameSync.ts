"use client";

/**
 * useGameSync — headless game-state sync hook.
 *
 * Phase 2 Plan 02 delivers the full implementation.
 * This file is a type stub created by Plan 01 so that
 * GET /api/game/state can import GameStateSnapshot as a
 * type-only import without a forward-reference error.
 *
 * Plan 02-02 will replace this stub with the full hook.
 */

export type SyncStatus = "connecting" | "connected" | "reconnecting" | "error";

export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null;       // null — Phase 3 populates
  correctOption: "A" | "B" | null;  // null — Phase 3 populates
};
