import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";

/**
 * GET /api/host/answers?gameId=&questionId= — host-only per-option player names (HOST-10, HOST-09).
 *
 * Returns `{ A: string[], B: string[] }` — the display names of players who picked
 * each option for the given question. The UI derives live counts from `A.length` /
 * `B.length`, which is why this works during the `question` phase even though the
 * public GET /api/game/state only fills `distribution` at locked/revealed (RQ-1 bonus).
 *
 * Privacy (T-04-12): player names are SENSITIVE (who picked what). They are NEVER added
 * to the public GET /api/game/state, so guests/TV cannot discover them. This endpoint is
 * host-auth-gated — validateHostAuth(req) is the FIRST statement, 401 before any DB access
 * (T-04-13). gameId/questionId are UUID-validated → 400 on malformed (T-04-14).
 *
 * Uses the service-role adminClient (answers RLS is USING(false) for anon).
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** Normalize the embedded players relation (object or single-element array). */
function extractName(players: unknown): string | null {
  if (!players) return null;
  if (Array.isArray(players)) {
    const first = players[0] as { display_name?: string } | undefined;
    return first?.display_name ?? null;
  }
  return (players as { display_name?: string }).display_name ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── FIRST: host-auth guard (T-04-13) ───────────────────────────────────────
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gameId = req.nextUrl.searchParams.get("gameId");
  const questionId = req.nextUrl.searchParams.get("questionId");

  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }
  if (!isValidUuid(questionId)) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  // Embedded join: answers → players (to-one via player_id). `!inner` drops
  // answers whose player row is missing. Names are pivoted by choice below.
  const { data, error } = await adminClient
    .from("answers")
    .select("choice, players!inner(display_name)")
    .eq("question_id", questionId);

  if (error) {
    console.error("[host:answers] fetch failed:", error.message);
    return NextResponse.json({ error: "answers_fetch_failed" }, { status: 500 });
  }

  const result: { A: string[]; B: string[] } = { A: [], B: [] };
  for (const row of (data ?? []) as Array<{ choice: string; players: unknown }>) {
    const name = extractName(row.players);
    if (!name) continue;
    if (row.choice === "A") result.A.push(name);
    else if (row.choice === "B") result.B.push(name);
  }

  return NextResponse.json(result, { status: 200 });
}
