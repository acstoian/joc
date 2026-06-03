import { NextRequest, NextResponse } from "next/server";
import { adminClient, broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";

/**
 * POST /api/host/reset — D-08 SURGICAL round reset (HOST-06).
 *
 * This is the HOST-06 surgical round reset — it is explicitly DISTINCT from
 * reset_game() (supabase/migrations/0003_reset_function.sql), which is the
 * full-wipe dry-run path (deletes ALL answers, zeroes ALL scores, returns to lobby).
 *
 * What this route does (D-08):
 *   1. Read game to get current_question_id; reject if no active question (lobby or null).
 *   2. SURGICAL DELETE: remove answers WHERE question_id = current_question_id ONLY.
 *      Answers for all other questions remain untouched.
 *   3. Reset games.phase to 'question' — no CAS needed (reset is valid from any
 *      non-lobby phase: question / locked / revealed).
 *   4. Best-effort broadcast ROUND_RESET signal.
 *
 * What this route does NOT do (D-08 anti-patterns):
 *   - Does NOT call reset_game() (the full-wipe, lobby-returning function)
 *   - Does NOT delete answers for other questions
 *   - Does NOT write to the scores table directly (scores converge correctly on
 *     the next reveal's recompute_scores RPC call — D-09)
 *
 * Security: validateHostAuth(req) is the FIRST statement — forged/credential-less
 * requests rejected 401 before any DB access (HOST-01, SC3, T-03-12, ASVS V2/V4).
 *
 * Request body: { gameId: UUID }
 * Response 200: { ok: true, phase: "question" }
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

  const { gameId } = body as Record<string, unknown>;

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  // ── Step 1: Read game ──────────────────────────────────────────────────────
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // Nothing to reset in lobby, or if no question has been set yet
  if (!game.current_question_id || game.phase === "lobby") {
    return NextResponse.json({ error: "no_active_question" }, { status: 400 });
  }

  // ── Step 2: SURGICAL DELETE — current question's answers ONLY (D-08) ──────
  // Deletes ONLY rows where answers.question_id == current_question_id.
  // Answers for all other questions remain intact.
  // Does NOT call reset_game() — that is the full-wipe dry-run path (T-03-14).
  // Does NOT touch the scores table — scores converge on the next reveal (D-09).
  const { error: deleteError } = await adminClient
    .from("answers")
    .delete()
    .eq("question_id", game.current_question_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "reset_failed", detail: deleteError.message },
      { status: 500 }
    );
  }

  // ── Step 3: Reset phase to 'question' ─────────────────────────────────────
  // No CAS needed — surgical reset is valid from any non-lobby phase
  // (question / locked / revealed). The host re-asks the same question.
  const { error: phaseError } = await adminClient
    .from("games")
    .update({ phase: "question" })
    .eq("id", gameId);

  if (phaseError) {
    return NextResponse.json(
      { error: "phase_reset_failed", detail: phaseError.message },
      { status: 500 }
    );
  }

  // ── Step 4: Best-effort broadcast ROUND_RESET (D-bcast, T-03-16) ──────────
  // Pure typed signal — clients re-fetch GET /api/game/state for authoritative state.
  // A broadcast failure MUST NOT fail the host request — log and proceed.
  try {
    await broadcast(`game:${gameId}`, "GAME_EVENT", {
      type: "ROUND_RESET",
      gameId,
      questionId: game.current_question_id,
    } satisfies GameEvent as Record<string, unknown>);
  } catch (err) {
    console.error("[broadcast] ROUND_RESET broadcast failed:", err);
    // Best-effort — do not fail the host request (D-bcast / Claude's Discretion)
  }

  return NextResponse.json({ ok: true, phase: "question" }, { status: 200 });
}
