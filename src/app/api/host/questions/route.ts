import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";

/**
 * GET /api/host/questions?gameId=UUID
 * POST /api/host/questions  body { gameId, body, option_a, option_b, correct_option? }
 *
 * Host-authenticated question list + create endpoints (QSTN-01, T-04-07).
 * ALL reads/writes use adminClient.from("questions") (base table — includes correct_option).
 * NEVER use questions_public (that view omits correct_option per Pitfall 3).
 *
 * Security: validateHostAuth(req) is the FIRST statement of every handler.
 * UUID validation: UUID_REGEX on gameId (T-04-10, ASVS V5).
 */

// ── UUID validation (verbatim from transition/route.ts) ───────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// ── GET — ordered question list ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // FIRST: host-auth guard (T-04-07)
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("questions") // base table — includes correct_option (NOT questions_public)
    .select("id, body, option_a, option_b, correct_option, display_order, created_at")
    .eq("game_id", gameId)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data ?? [] });
}

// ── POST — create a question ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // FIRST: host-auth guard (T-04-07)
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse + validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    gameId,
    body: questionBody,
    option_a,
    option_b,
    correct_option,
  } = body as Record<string, unknown>;

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  if (
    typeof questionBody !== "string" ||
    questionBody.trim().length === 0
  ) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  if (typeof option_a !== "string" || option_a.trim().length === 0) {
    return NextResponse.json({ error: "option_a required" }, { status: 400 });
  }

  if (typeof option_b !== "string" || option_b.trim().length === 0) {
    return NextResponse.json({ error: "option_b required" }, { status: 400 });
  }

  // Compute display_order = MAX(display_order) + 1, or 1 if no questions yet
  const { data: maxRow } = await adminClient
    .from("questions")
    .select("display_order")
    .eq("game_id", gameId as string)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxRow ? maxRow.display_order + 1 : 1;

  const { data: created, error: insertError } = await adminClient
    .from("questions")
    .insert({
      game_id: gameId as string,
      body: questionBody.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      correct_option:
        correct_option === "A" || correct_option === "B" ? correct_option : null,
      display_order: nextOrder,
    })
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: "insert_failed", detail: insertError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ question: created }, { status: 201 });
}
