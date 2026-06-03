import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * POST /api/game/answer — Phase-guarded, dedup'd, identity-bound answer insert.
 *
 * Anti-cheat design (T-03-04, Pattern 4):
 *   Request body carries `deviceToken`, NOT a player identifier.
 *   The route resolves `player_id` server-side from (game_id, device_token)
 *   so a guest cannot submit an answer as another player.
 *
 * Two-layer dedup (Pattern 3):
 *   Layer 1 — Phase guard (SCOR-04): games.phase must be 'question' → 403 if not.
 *     ONLY 'question' is open — 'lobby' is NOT accepted (unlike the skeleton open-phases set).
 *   Layer 2 — DB dedup (SCOR-03): UNIQUE(player_id, question_id) constraint;
 *     error.code === "23505" → 409; no second row is ever created.
 *
 * Request body: { gameId: UUID, deviceToken: UUID, choice: "A" | "B" }
 * Responses:
 *   200 { ok: true }                          — answer recorded
 *   400 { error: "gameId required" }          — malformed gameId
 *   400 { error: "deviceToken required" }     — malformed deviceToken
 *   400 { error: "choice required" }          — choice not "A" or "B"
 *   403 { error: "answers_locked", phase }   — phase != 'question' (SCOR-04)
 *   404 { error: "game_not_found" }           — gameId not in DB
 *   404 { error: "player_not_found" }         — no player for this device in this game
 *   409 { error: "already_answered" }         — UNIQUE(player_id, question_id) violation
 *   500 { error: "answer_failed", detail }    — unexpected DB error
 *
 * Security:
 *   - T-03-04: player_id never read from the request body (anti-cheat)
 *   - T-03-05: UNIQUE(player_id, question_id) + 23505 → 409 blocks replays
 *   - T-03-06: server-side phase guard before any INSERT
 *   - T-03-07: UUID validation on gameId/deviceToken; choice ∈ {A,B}
 *   - Key isolation: only adminClient (server-only module); no raw key refs in this file
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { gameId, deviceToken, choice } = body as Record<string, unknown>;

  // ── INPUT VALIDATION (ASVS V5) ────────────────────────────────────────────
  // NOTE: body carries deviceToken, NOT a player id — anti-cheat (Pattern 4).
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  if (!isValidUuid(deviceToken)) {
    return NextResponse.json(
      { error: "deviceToken required" },
      { status: 400 }
    );
  }

  // choice must be exactly "A" or "B" — no other values accepted
  if (choice !== "A" && choice !== "B") {
    return NextResponse.json({ error: "choice required" }, { status: 400 });
  }

  // ── LAYER 1: Phase guard (SCOR-04) ────────────────────────────────────────
  // Do the cheap phase guard FIRST, before the player lookup DB read.
  // Only 'question' phase is open — 'lobby' is NOT accepted here.
  // The skeleton's open-phases set (["lobby","question"]) is intentionally NOT used here.
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  if (game.phase !== "question") {
    return NextResponse.json(
      { error: "answers_locked", phase: game.phase },
      { status: 403 }
    );
  }

  // ── ANTI-CHEAT IDENTITY RESOLUTION (Pattern 4) ───────────────────────────
  // Resolve player_id server-side from (game_id, device_token).
  // Uses players_device_token_idx — O(log n) lookup.
  // A guest never sends a player_id; this makes identity forgery impossible.
  const { data: player, error: playerError } = await adminClient
    .from("players")
    .select("id")
    .eq("game_id", gameId)
    .eq("device_token", deviceToken)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json(
      { error: "player_lookup_failed", detail: playerError.message },
      { status: 500 }
    );
  }

  if (!player) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  // ── LAYER 2: DB dedup (SCOR-03) ───────────────────────────────────────────
  // Insert answer with the server-resolved player_id and current_question_id.
  // The UNIQUE(player_id, question_id) constraint rejects duplicates atomically.
  // error.code === "23505" = PostgreSQL unique_violation SQLSTATE.
  const { error: insertError } = await adminClient
    .from("answers")
    .insert({
      player_id: player.id,
      question_id: game.current_question_id!,
      choice,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // UNIQUE(player_id, question_id) violation — already answered this question.
      // No second row was created.
      return NextResponse.json(
        { error: "already_answered" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "answer_failed", detail: insertError.message },
      { status: 500 }
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  // No broadcast — the submitter's UI locks locally (Phase 5).
  // The host controls reveal; distribution is served by GET /api/game/state.
  return NextResponse.json({ ok: true }, { status: 200 });
}
