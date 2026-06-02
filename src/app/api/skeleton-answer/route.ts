import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * POST /api/skeleton-answer — Walking Skeleton WRITE route.
 *
 * THROWAWAY PROOF HARNESS — Phase 1 only.
 * Replaced by the real guest answer API in Phase 5.
 *
 * Demonstrates the full stack:
 *   1. Phase guard (SCOR-04 substrate): reads games.phase; rejects non-open phases → 403.
 *   2. Idempotent player upsert on (game_id, device_token) UNIQUE constraint.
 *   3. INSERT answer (player_id, question_id, choice 'A').
 *   4. On error.code === '23505' (UNIQUE violation): returns 409 {error:'already_answered'}.
 *      On success: returns 200 {ok:true, player_id, answer_id}.
 *
 * Key isolation (D-13): imports only the service-role admin client (server-only module).
 * The anon key is NEVER used here for writes.
 */

const SEED_GAME_ID = "a0000000-0000-4000-8000-000000000001";
const SEED_QUESTION_ID = "b0000000-0000-4000-8000-000000000001";
const SKELETON_DEVICE_TOKEN = "c0000000-0000-4000-8000-000000000001"; // fixed UUID for skeleton player
const SKELETON_DISPLAY_NAME = "Skeleton Player";

// Phases that permit answer submission
const OPEN_PHASES = new Set(["lobby", "question"]);

export async function POST(): Promise<NextResponse> {
  // ── Step 1: Phase guard (SCOR-04 substrate) ──────────────────────────────
  // Read the seeded game's current phase. Only allow writes in 'lobby' or
  // 'question' phases — demonstrates the phase-guard pattern that Phase 3
  // will extend to cover all answer submissions.
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase")
    .eq("id", SEED_GAME_ID)
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: "Game not found", detail: gameError?.message },
      { status: 404 }
    );
  }

  if (!OPEN_PHASES.has(game.phase)) {
    return NextResponse.json(
      { error: "answers_locked", phase: game.phase },
      { status: 403 }
    );
  }

  // ── Step 2: Idempotent player upsert ─────────────────────────────────────
  // Upsert on (game_id, device_token) UNIQUE — safe to call repeatedly;
  // returns the existing or newly-created player row.
  const { data: player, error: playerError } = await adminClient
    .from("players")
    .upsert(
      {
        game_id: SEED_GAME_ID,
        device_token: SKELETON_DEVICE_TOKEN,
        display_name: SKELETON_DISPLAY_NAME,
      },
      { onConflict: "game_id,device_token", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      { error: "Player upsert failed", detail: playerError?.message },
      { status: 500 }
    );
  }

  // ── Step 3: INSERT answer ─────────────────────────────────────────────────
  // Insert (player_id, question_id, choice). The DB UNIQUE (player_id, question_id)
  // constraint rejects duplicates at the database layer (SCOR-03).
  const { data: answer, error: answerError } = await adminClient
    .from("answers")
    .insert({
      player_id: player.id,
      question_id: SEED_QUESTION_ID,
      choice: "A",
    })
    .select("id")
    .single();

  // ── Step 4: Handle duplicate (23505) → 409 ───────────────────────────────
  if (answerError) {
    if (answerError.code === "23505") {
      // UNIQUE violation — second identical answer rejected by DB constraint
      return NextResponse.json(
        { error: "already_answered" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Answer insert failed", detail: answerError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, player_id: player.id, answer_id: answer?.id },
    { status: 200 }
  );
}
