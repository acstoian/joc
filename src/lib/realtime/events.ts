// src/lib/realtime/events.ts
//
// Locked typed-signal + re-fetch contract (D-06). This is the canonical
// GAME_EVENT discriminated union for all Supabase Broadcast messages on the
// game channel. All payloads carry ONLY type + minimal IDs — consumers MUST
// re-fetch GET /api/game/state for authoritative data after each event.
//
// Phase 3 may ADD new union members or optional fields to existing members,
// but MUST NOT reshape (rename, remove, or change type of) existing members.
// Downstream plans (02, 03+) depend on this interface being stable.
//
// No "use client", no imports, no runtime code — pure TypeScript types only.

export type GameEvent =
  | { type: "GAME_STARTED";      gameId: string }
  | { type: "QUESTION_STARTED";  gameId: string; questionId: string }
  | { type: "ANSWERS_LOCKED";    gameId: string; questionId: string }
  | { type: "ANSWER_REVEALED";   gameId: string; questionId: string; correctOption: "A" | "B" | "AB" }
  | { type: "SCORES_UPDATED";    gameId: string }
  | { type: "ROUND_RESET";       gameId: string; questionId: string }
  | { type: "GAME_ENDED";        gameId: string }
  | { type: "COUNTDOWN_STARTED"; gameId: string; seconds: number };
