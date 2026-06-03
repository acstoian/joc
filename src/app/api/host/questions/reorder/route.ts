import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";

/**
 * PATCH /api/host/questions/reorder  body { gameId, order: UUID[] }
 *
 * Host-authenticated bulk display_order update (QSTN-05, T-04-07/10/11).
 * Sets display_order = index + 1 for every question in the provided order array.
 * Concurrent updates via Promise.all — acceptable at ≤50 questions (last-writer-wins,
 * T-04-11 accepted). Both .eq("id") and .eq("game_id") conditions are applied so a
 * question belonging to a different game cannot be reordered.
 *
 * Security: validateHostAuth(req) is the FIRST statement.
 * UUID validation: UUID_REGEX on gameId AND every entry of order[] (T-04-10, ASVS V5).
 */

// ── UUID validation (verbatim from transition/route.ts) ───────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// ── PATCH — bulk reorder ──────────────────────────────────────────────────────

export async function PATCH(req: NextRequest): Promise<NextResponse> {
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

  const { gameId, order } = body as { gameId: unknown; order: unknown };

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  if (!Array.isArray(order) || order.length === 0 || !order.every(isValidUuid)) {
    return NextResponse.json(
      { error: "order must be a non-empty array of UUIDs" },
      { status: 400 }
    );
  }

  // Concurrent updates — acceptable at ≤50 questions (T-04-11, RESEARCH.md RQ-2).
  // Both .eq("id") and .eq("game_id") prevent cross-game tampering.
  await Promise.all(
    (order as string[]).map((questionId, index) =>
      adminClient
        .from("questions")
        .update({ display_order: index + 1 })
        .eq("id", questionId)
        .eq("game_id", gameId)
    )
  );

  return NextResponse.json({ ok: true });
}
