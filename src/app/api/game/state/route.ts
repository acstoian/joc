import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

/**
 * GET /api/game/state — reconnect-resync endpoint (D-03, RT-03).
 *
 * Returns the authoritative game state snapshot for a given gameId and
 * optional playerId. Called by useGameSync on every SUBSCRIBED event
 * (initial connect + every reconnect) so clients always converge to DB truth.
 *
 * Query params:
 *   gameId   — UUID of the game (required; 400 if missing or malformed)
 *   playerId — UUID of the player (optional; null for TV/host callers)
 *
 * Security:
 *   - T-02-01: Reads questions_public view (never base questions table);
 *              correct_option is NOT exposed pre-reveal (Pitfall 5, ASVS V4)
 *   - T-02-02: gameId validated as present and UUID-shaped → 400 on malformed
 *              (ASVS V5, D-03 boundary)
 *   - T-02-04: Only adminClient is imported (server-only module); no raw
 *              SUPABASE_SERVICE_ROLE_KEY reference in this file
 *
 * Phase 2 stubs: correctOption is always null here; Phase 3's reveal path
 * will populate it by reading correct_option from the base questions table
 * after phase === 'revealed'.
 */

// Simple UUID v4 shape validation (not cryptographically strict — just enough
// to reject obviously malformed inputs before hitting the DB).
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | null): value is string {
  return value !== null && UUID_REGEX.test(value);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");
  const playerId = searchParams.get("playerId"); // may be null for TV/host

  // INPUT VALIDATION (D-03 boundary, ASVS V5)
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }
  // playerId is optional — only validate when present
  if (playerId !== null && !isValidUuid(playerId)) {
    return NextResponse.json(
      { error: "playerId malformed" },
      { status: 400 }
    );
  }

  // ── Step 1: Fetch games row ───────────────────────────────────────────────
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // ── Step 2: Fetch current question via questions_public view ─────────────
  // MUST use questions_public, NEVER the base questions table — the view omits
  // correct_option so the answer is not leaked pre-reveal (Pitfall 5, T-02-01).
  let currentQuestion: GameStateSnapshot["currentQuestion"] = null;
  if (game.current_question_id) {
    const { data: q, error: qError } = await adminClient
      .from("questions_public")
      .select("id, body, option_a, option_b")
      .eq("id", game.current_question_id)
      .single();

    if (qError) {
      return NextResponse.json(
        { error: "question_fetch_failed", detail: qError.message },
        { status: 500 }
      );
    }

    if (q) {
      currentQuestion = {
        id: q.id!,
        body: q.body!,
        optionA: q.option_a!,
        optionB: q.option_b!,
      };
    }
  }

  // ── Step 3: Fetch player's existing answer ────────────────────────────────
  // answers RLS is USING(false) for anon — must use adminClient here.
  // Use maybeSingle(): the player may not have answered yet (no error on 0 rows).
  let myAnswer: "A" | "B" | null = null;
  if (playerId && game.current_question_id) {
    const { data: answer, error: answerError } = await adminClient
      .from("answers")
      .select("choice")
      .eq("player_id", playerId)
      .eq("question_id", game.current_question_id)
      .maybeSingle();

    if (answerError) {
      return NextResponse.json(
        { error: "answer_fetch_failed", detail: answerError.message },
        { status: 500 }
      );
    }

    if (answer?.choice === "A" || answer?.choice === "B") {
      myAnswer = answer.choice;
    }
  }

  // correctOption: Phase 2 stub — null always.
  // Phase 3's reveal write path will populate questions.correct_option and
  // this endpoint will be updated to return it when phase === 'revealed'.
  const correctOption: "A" | "B" | null = null; // stub — Plan 05 will fill

  // distribution + leaderboard: Phase 3 stubs — populated by Plan 05 (state route extension).
  // Added here to satisfy the widened GameStateSnapshot type contract (D-02).
  const distribution: { A: number; B: number } | null = null; // stub — Plan 05 will fill
  const leaderboard: { name: string; score: number }[] = []; // stub — Plan 05 will fill

  const snapshot: GameStateSnapshot = {
    phase: game.phase as GameStateSnapshot["phase"],
    currentQuestionId: game.current_question_id,
    currentQuestion,
    myAnswer,
    correctOption,
    distribution,
    leaderboard,
  };

  return NextResponse.json(snapshot);
}
