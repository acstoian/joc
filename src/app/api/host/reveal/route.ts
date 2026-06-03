import { NextRequest, NextResponse } from "next/server";
import { adminClient, broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";

/**
 * POST /api/host/reveal — host-authenticated reveal + idempotent score recompute (HOST-04, SCOR-01).
 *
 * The host picks the correct A/B option LIVE at reveal time (not at authoring) — D-07.
 * Steps:
 *   1. Read game phase; apply D-07 CAS: locked→revealed (idempotent re-reveal allowed).
 *   2. Set questions.correct_option UNCONDITIONALLY — overwrites a prior value after a
 *      D-08 round reset (Pitfall 5). Uses base `questions` table via adminClient, never
 *      the `questions_public` view (which omits correct_option per 0002 RLS policy).
 *   3. Call recompute_scores(p_game_id) RPC — idempotent aggregate from scratch (D-09).
 *      Each player's scores.correct_count = COUNT of their correct answers across ALL
 *      revealed questions (exactly 1 pt per correct answer — SCOR-01). Re-reveal or
 *      reset+re-reveal never double-counts because ON CONFLICT replaces, not adds (Pitfall 4).
 *   4. Best-effort broadcast ANSWER_REVEALED + SCORES_UPDATED (pure typed signals — D-01/D-06).
 *      Clients re-fetch GET /api/game/state for authoritative data.
 *
 * Security: validateHostAuth(req) is the FIRST statement — forged/credential-less requests
 * rejected 401 before any DB access (HOST-01, SC3, T-03-12, ASVS V2/V4).
 *
 * RPC note: recompute_scores migration (0004) must be pushed to the live DB before this
 * route is exercised. The migration is committed (local) but may be pending a `supabase db push`.
 * Best-effort: scoreError is logged but does NOT fail the reveal (T-03-16 accept).
 *
 * Request body: { gameId: UUID, choice: "A" | "B" }
 * Response 200: { ok: true, phase: "revealed", correctOption: "A" | "B" }
 */

// ── UUID validation (matches GET /api/game/state pattern) ────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── FIRST: host-auth guard (HOST-01, SC3, T-03-12) ─────────────────────────
  // Must be the first executable statement — no mutation on failure.
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Parse + validate request body ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { gameId, choice } = body as Record<string, unknown>;

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  if (choice !== "A" && choice !== "B") {
    return NextResponse.json({ error: "choice required" }, { status: 400 });
  }

  // ── Step 1: Read game (D-07 CAS: locked → revealed) ───────────────────────
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  if (!game.current_question_id) {
    return NextResponse.json({ error: "no_active_question" }, { status: 400 });
  }

  // D-07 for locked→revealed:
  //   (a) Already revealed — idempotent re-reveal is allowed (D-09 guarantees no double-count)
  //   (b) Not in locked state — illegal transition
  //   (c) In locked state — proceed with CAS
  if (game.phase !== "locked" && game.phase !== "revealed") {
    return NextResponse.json(
      {
        error: "invalid_transition",
        current: game.phase,
        expected: "locked",
      },
      { status: 409 }
    );
  }

  // ── Step 2: Set correct_option FIRST (CR-02 fix) ──────────────────────────
  // CR-02: correct_option MUST be written before the phase is flipped to
  // 'revealed'. Doing it afterwards created a window where phase === 'revealed'
  // but correct_option === NULL, causing a blank reveal flash on some clients.
  // Same ordering applies to re-reveal: write the new answer first, then
  // recompute scores, then flip (or confirm) the phase.
  //
  // Uses base `questions` table via adminClient (adminClient bypasses RLS).
  // `questions_public` view omits correct_option by design — never use it here.
  // The UPDATE must overwrite any prior value so reset+re-reveal works correctly.
  const { error: optionError } = await adminClient
    .from("questions")
    .update({ correct_option: choice })
    .eq("id", game.current_question_id);

  if (optionError) {
    return NextResponse.json(
      { error: "reveal_failed", detail: optionError.message },
      { status: 500 }
    );
  }

  // ── Step 3: Idempotent score recompute via RPC (D-09, SCOR-01) ────────────
  // recompute_scores counts each player's correct answers from scratch across all
  // revealed questions (correct_option IS NOT NULL). ON CONFLICT replaces — never
  // increments — so re-reveal or reset+re-reveal can never double-count (Pitfall 4).
  //
  // CR-02: scores are recomputed BEFORE the phase is flipped so the leaderboard
  // is consistent at the moment phase becomes 'revealed'. Safe because
  // recompute_scores is idempotent — it reads from correct_option (just written
  // in step 2) and replaces the scores table atomically via ON CONFLICT DO UPDATE.
  //
  // Best-effort: scoreError logged but does NOT fail the reveal (T-03-16).
  // CR-05 resolved: migration 0004 is pushed and database.ts regenerated, so
  // recompute_scores is in public.Functions — this call is natively type-checked.
  const { error: scoreError } = await adminClient.rpc("recompute_scores", {
    p_game_id: gameId,
  });
  if (scoreError) {
    console.error("[reveal] recompute_scores RPC failed:", scoreError);
    // Best-effort — scores re-computable on next reveal; proceed with broadcast
  }

  // ── Step 3b: CAS phase flip locked → revealed (CR-02 fix) ─────────────────
  // Only attempt the flip when starting from 'locked'. Re-reveal (already
  // 'revealed') skips this entirely — phase is already correct, no flip needed.
  // correct_option and scores are fully written before this flip so any
  // concurrent GET /api/game/state that lands after this point sees a fully
  // consistent state (no null-reveal window).
  if (game.phase === "locked") {
    const { data: updated, error: updateError } = await adminClient
      .from("games")
      .update({ phase: "revealed" })
      .eq("id", gameId)
      .eq("phase", "locked")
      .select("phase");

    if (updateError) {
      return NextResponse.json(
        { error: "transition_failed", detail: updateError.message },
        { status: 500 }
      );
    }

    // 0 rows = lost the CAS race (another request already revealed first).
    // correct_option + scores are already written — this is safe to treat as
    // a no-op; the winning request's phase flip is the canonical one.
    if (!updated || updated.length === 0) {
      // Proceed to broadcast — state is consistent regardless of which request won
    }
  }

  // ── Step 4: Best-effort broadcast (D-01/D-06, T-03-16) ────────────────────
  // Two pure typed signals — clients re-fetch GET /api/game/state for authoritative
  // correctOption, distribution, and leaderboard. Do NOT embed scores in payloads.
  try {
    await broadcast(`game:${gameId}`, "GAME_EVENT", {
      type: "ANSWER_REVEALED",
      gameId,
      questionId: game.current_question_id,
      correctOption: choice,
    } satisfies GameEvent as Record<string, unknown>);
    await broadcast(`game:${gameId}`, "GAME_EVENT", {
      type: "SCORES_UPDATED",
      gameId,
    } satisfies GameEvent as Record<string, unknown>);
  } catch (err) {
    console.error("[broadcast] reveal broadcast failed:", err);
    // Best-effort — do not fail the host request (D-bcast / Claude's Discretion)
  }

  return NextResponse.json(
    { ok: true, phase: "revealed", correctOption: choice },
    { status: 200 }
  );
}
