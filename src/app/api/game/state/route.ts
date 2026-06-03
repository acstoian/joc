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
 *   - T-02-01 / T-03-17: Reads questions_public view for question text (never base
 *              questions table); correct_option is ONLY exposed when phase === 'revealed'
 *              via a base-questions read fenced behind the phase gate (Pitfall 3, ASVS V4).
 *   - T-02-02 / T-03-19: gameId validated as present and UUID-shaped → 400 on malformed
 *              (ASVS V5, D-03 boundary)
 *   - T-02-04: Only adminClient is imported (server-only module); no raw
 *              SUPABASE_SERVICE_ROLE_KEY reference in this file
 *
 * Phase 3 (D-02) now populates:
 *   - correctOption: "A"|"B" when phase === 'revealed' (base questions table, behind gate)
 *   - distribution: { A, B } when phase === 'locked' or 'revealed'
 *   - leaderboard: { name, score }[] ranked by correct_count desc when phase !== 'lobby'
 * Replaces the Phase 2 stubs. All Phase 2 reads (questions_public, myAnswer) preserved.
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

  // ── Step 4: correctOption — phase-gated read from base questions table ──────
  // ONLY expose when phase === 'revealed' (Pitfall 3, T-03-17, ASVS V4).
  // MUST use adminClient.from("questions") (base table) — questions_public view
  // deliberately omits correct_option. This is the ONE place in the read path
  // that touches the base questions table, and only post-reveal.
  let correctOption: "A" | "B" | null = null;
  if (game.phase === "revealed" && game.current_question_id) {
    const { data: revealedQ } = await adminClient
      .from("questions") // base table required — view omits correct_option
      .select("correct_option")
      .eq("id", game.current_question_id)
      .single();
    correctOption = (revealedQ?.correct_option as "A" | "B") ?? null;
  }

  // ── Step 5: distribution — A/B answer counts for locked/revealed phases ────
  // Only relevant once answers are locked in (phase === 'locked' or 'revealed').
  // Client-side count is fine for ≤100 players (A3 — no GROUP BY needed).
  let distribution: { A: number; B: number } | null = null;
  if (
    (game.phase === "locked" || game.phase === "revealed") &&
    game.current_question_id
  ) {
    const { data: answerRows } = await adminClient
      .from("answers")
      .select("choice")
      .eq("question_id", game.current_question_id);
    const rows = answerRows ?? [];
    distribution = {
      A: rows.filter((a) => a.choice === "A").length,
      B: rows.filter((a) => a.choice === "B").length,
    };
  }

  // ── Step 6: leaderboard — ranked by correct_count desc (SCOR-02) ───────────
  // Populated whenever phase is not 'lobby' (scores exist after first reveal).
  //
  // CR-01 fix: PostgREST ignores .eq("players.game_id", ...) on a foreign-table
  // column — the filter never reaches the players table and all scores across
  // every game were returned. Fix: two-step query. First resolve player IDs for
  // this game, then filter scores by those IDs. This is unambiguous and correct.
  let leaderboard: { name: string; score: number }[] = [];
  if (game.phase !== "lobby") {
    // Step 6a: get all player IDs that belong to this game
    const { data: playerRows } = await adminClient
      .from("players")
      .select("id, display_name")
      .eq("game_id", gameId);

    const players = playerRows ?? [];
    const playerIds = players.map((p) => p.id);

    if (playerIds.length > 0) {
      // Step 6b: fetch scores for those players only
      const { data: scoreRows } = await adminClient
        .from("scores")
        .select("player_id, correct_count")
        .in("player_id", playerIds)
        .order("correct_count", { ascending: false })
        .limit(20);

      // Join display_name client-side (players already fetched above)
      const playerMap = new Map(players.map((p) => [p.id, p.display_name]));
      leaderboard = (scoreRows ?? []).map((s) => ({
        name: playerMap.get(s.player_id) ?? "Unknown",
        score: s.correct_count,
      }));
    }
  }

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
