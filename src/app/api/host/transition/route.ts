import { NextRequest, NextResponse } from "next/server";
import { adminClient, broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";
import type { Database } from "@/types/database";

type GamesUpdate = Database["public"]["Tables"]["games"]["Update"];

/**
 * POST /api/host/transition — host-authenticated phase state machine (HOST-02/03/05/07).
 *
 * Drives the full lobby → question → locked → revealed → question → ended machine.
 * (`locked → revealed` is handled by POST /api/host/reveal in Plan 04.)
 *
 * Security: validateHostAuth(req) is the FIRST statement — forged/credential-less
 * requests are rejected 401 before any DB access (HOST-01, SC3, T-03-08, ASVS V2/V4).
 *
 * Concurrency: D-07 compare-and-swap distinguishing rule:
 *   1. current == target         → idempotent no-op, 200 + current state (D-05)
 *   2. current != expectedFrom   → illegal transition, 409 + reason (D-06)
 *   3. else CAS UPDATE ... WHERE phase = expectedFrom; 0 rows → 200 no-op (D-07)
 *
 * Atomic current_question_id assignment (Pitfall 6):
 *   - start (lobby→question): sets current_question_id to first question by display_order
 *   - next  (revealed→question): sets current_question_id to provided nextQuestionId
 *   - lock / end: phase only
 *
 * Broadcast: best-effort GameEvent signal after DB write (D-bcast). A broadcast
 * failure does NOT fail the host request — DB is the source of truth (T-03-11).
 *
 * Request body:
 *   { gameId: UUID, action: "start"|"lock"|"next"|"end", nextQuestionId?: UUID }
 *   `next` requires nextQuestionId; others ignore it.
 */

// ── UUID validation (reuse pattern from GET /api/game/state) ──────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// ── Action → phase-transition map ─────────────────────────────────────────────
// StandardAction routes through the single-expectedFrom TRANSITIONS map.
// `force_end` (HOST-11, decision #4) is valid from ANY non-ended phase, so it is
// NOT in TRANSITIONS — it is branched specially before the map lookup below.
type StandardAction = "start" | "lock" | "next" | "end";
type Action = StandardAction | "force_end";

const TRANSITIONS: Record<StandardAction, { expectedFrom: string; target: string }> = {
  start: { expectedFrom: "lobby",    target: "question" },
  lock:  { expectedFrom: "question", target: "locked"   },
  next:  { expectedFrom: "revealed", target: "question" },
  end:   { expectedFrom: "revealed", target: "ended"    },
};

const VALID_ACTIONS = new Set<Action>(["start", "lock", "next", "end", "force_end"]);

function isValidAction(v: unknown): v is Action {
  return typeof v === "string" && VALID_ACTIONS.has(v as Action);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── FIRST: host-auth guard (HOST-01, SC3, T-03-08) ─────────────────────────
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

  const { gameId, action, nextQuestionId } = body as Record<string, unknown>;

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  if (!isValidAction(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // `next` explicitly requires nextQuestionId — the host chooses the question
  // (Open Question 2 resolution: two distinct actions, next requires nextQuestionId)
  if (action === "next" && !isValidUuid(nextQuestionId)) {
    return NextResponse.json(
      { error: "nextQuestionId required for action 'next'" },
      { status: 400 }
    );
  }

  // ── force_end: end the game from ANY non-ended phase (HOST-11, SC5) ────────
  // Not routed through TRANSITIONS (which has a single expectedFrom). Uses a
  // CAS-style guard `.neq("phase","ended")` so concurrent transitions converge:
  // 0 rows → idempotent noop (T-04-16). Reuses the existing GAME_ENDED event —
  // no new GameEvent union member. The normal `end` action is untouched.
  if (action === "force_end") {
    const { data: fgame, error: fgameError } = await adminClient
      .from("games")
      .select("phase, current_question_id")
      .eq("id", gameId)
      .single();

    if (fgameError || !fgame) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404 });
    }

    // Already ended — idempotent no-op
    if (fgame.phase === "ended") {
      return NextResponse.json({ noop: true, state: fgame }, { status: 200 });
    }

    const { data: fUpdated, error: fUpdateError } = await adminClient
      .from("games")
      .update({ phase: "ended" })
      .eq("id", gameId)
      .neq("phase", "ended")
      .select("phase");

    if (fUpdateError) {
      return NextResponse.json(
        { error: "transition_failed", detail: fUpdateError.message },
        { status: 500 }
      );
    }

    // 0 rows = another request ended it first — idempotent no-op
    if (!fUpdated || fUpdated.length === 0) {
      return NextResponse.json({ noop: true }, { status: 200 });
    }

    try {
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "GAME_ENDED",
        gameId,
      } satisfies GameEvent as Record<string, unknown>);
    } catch (err) {
      console.error("[broadcast] force_end broadcast failed:", err);
      // Best-effort — DB write already succeeded
    }

    return NextResponse.json({ ok: true, phase: "ended" }, { status: 200 });
  }

  const { expectedFrom, target } = TRANSITIONS[action];

  // ── Step 1: Read current game phase (D-07 pre-check) ──────────────────────
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // ── Step 2: D-07 distinguishing rule ──────────────────────────────────────
  // (a) Already at target — idempotent no-op (D-05)
  if (game.phase === target) {
    return NextResponse.json({ noop: true, state: game }, { status: 200 });
  }

  // (b) Not at expectedFrom — illegal transition (D-06)
  if (game.phase !== expectedFrom) {
    return NextResponse.json(
      {
        error: "invalid_transition",
        current: game.phase,
        expected: expectedFrom,
      },
      { status: 409 }
    );
  }

  // ── Step 3: Build CAS UPDATE payload (atomic current_question_id, Pitfall 6) ──
  let updatePayload: GamesUpdate = { phase: target };
  let firstQuestionId: string | null = null;

  if (action === "start") {
    // lobby→question: atomically set first question by display_order
    const { data: firstQ, error: firstQError } = await adminClient
      .from("questions")
      .select("id")
      .eq("game_id", gameId)
      .order("display_order", { ascending: true })
      .limit(1)
      .single();

    if (firstQError || !firstQ) {
      return NextResponse.json({ error: "no_questions" }, { status: 409 });
    }
    firstQuestionId = firstQ.id;
    updatePayload = { phase: target, current_question_id: firstQ.id };
  } else if (action === "next") {
    // revealed→question: set the host-chosen next question
    updatePayload = { phase: target, current_question_id: nextQuestionId as string };
  }
  // lock + end: phase only (current_question_id unchanged)

  // ── Step 4: CAS UPDATE ─────────────────────────────────────────────────────
  // BOTH .eq("id", gameId) AND .eq("phase", expectedFrom) are required.
  // The second .eq is the actual serialization — ensures only one concurrent
  // request advances the phase (D-07 third bullet, SC4, Pitfall 2).
  // Use .select() WITHOUT .single() — detect lost race with data.length === 0
  // (not PGRST116 which .single() would throw, Pitfall 1, Anti-Pattern).
  const { data: updated, error: updateError } = await adminClient
    .from("games")
    .update(updatePayload)
    .eq("id", gameId)
    .eq("phase", expectedFrom)
    .select("phase, current_question_id");

  if (updateError) {
    return NextResponse.json(
      { error: "transition_failed", detail: updateError.message },
      { status: 500 }
    );
  }

  // 0 rows affected = lost the race (another request already advanced phase)
  // Treat as idempotent no-op — return 200 (D-07 third bullet)
  if (!updated || updated.length === 0) {
    return NextResponse.json({ noop: true }, { status: 200 });
  }

  // ── Step 5: Best-effort broadcast (D-bcast, T-03-11) ──────────────────────
  // A broadcast failure MUST NOT fail the host request — log and proceed.
  // DB is the authoritative source of truth; clients converge via subscribe-then-fetch.
  //
  // WR-04: for `start`, source the questionId from the COMMITTED row
  // (updated[0].current_question_id) rather than the pre-CAS firstQuestionId.
  // The CAS above guarantees `updated` is non-empty here (the 0-row lost-race
  // case already returned). Using the committed value means a request that won
  // the CAS broadcasts exactly what it wrote — no stale pre-read value.
  const resolvedQuestionId =
    action === "start"
      ? (updated[0].current_question_id ?? firstQuestionId ?? "")
      : action === "next"
      ? (nextQuestionId as string)
      : (game.current_question_id ?? "");

  try {
    if (action === "start") {
      // Two signals: game started + first question started
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "GAME_STARTED",
        gameId,
      } satisfies GameEvent as Record<string, unknown>);
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "QUESTION_STARTED",
        gameId,
        questionId: resolvedQuestionId,
      } satisfies GameEvent as Record<string, unknown>);
    } else if (action === "lock") {
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "ANSWERS_LOCKED",
        gameId,
        questionId: resolvedQuestionId,
      } satisfies GameEvent as Record<string, unknown>);
    } else if (action === "next") {
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "QUESTION_STARTED",
        gameId,
        questionId: resolvedQuestionId,
      } satisfies GameEvent as Record<string, unknown>);
    } else if (action === "end") {
      await broadcast(`game:${gameId}`, "GAME_EVENT", {
        type: "GAME_ENDED",
        gameId,
      } satisfies GameEvent as Record<string, unknown>);
    }
  } catch (err) {
    console.error(`[broadcast] ${action} broadcast failed:`, err);
    // Best-effort — proceed regardless; DB write already succeeded
  }

  return NextResponse.json({ ok: true, phase: target }, { status: 200 });
}
