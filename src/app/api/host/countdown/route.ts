import { NextRequest, NextResponse } from "next/server";
import { broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";

/**
 * POST /api/host/countdown — host-authenticated cosmetic countdown signal (DISP-08).
 *
 * Broadcasts COUNTDOWN_STARTED to the display surface so the TV countdown overlay
 * appears. This is a purely cosmetic signal — no DB write, no game-state change.
 * The Display Mode shell intercepts this event via the useGameSync onEvent callback
 * before the state re-fetch (which has no DB representation of COUNTDOWN_STARTED).
 *
 * Security (T-06-01, T-06-02, ASVS V2/V4):
 *   - validateHostAuth(req) is the FIRST statement — unauthenticated requests
 *     rejected 401 before any broadcast (T-06-01).
 *   - seconds is validated as an integer in [1, 10] — rejects out-of-range values
 *     with 400 so a buggy caller is immediately visible and a 999-second overlay
 *     cannot be triggered on the TV (T-06-02).
 *
 * Broadcast failure is best-effort (cosmetic signal; never fail the request).
 *
 * Request body: { gameId: UUID, seconds: integer 1-10 }
 * Response: { ok: true } 200 on success, 400/401 on invalid input.
 */

// ── UUID validation (same pattern as transition/route.ts) ──────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── FIRST: host-auth guard (T-06-01, HOST-01, SC3) ─────────────────────────
  // Must be the first executable statement — no mutation on failure.
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Parse request body ─────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { gameId, seconds } = body as Record<string, unknown>;

  // ── Validate gameId ────────────────────────────────────────────────────────
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  // ── Validate seconds (T-06-02): reject, do not silently clamp ─────────────
  // Rejecting out-of-range values makes buggy callers immediately visible.
  // A silent clamp would mask a 999-second countdown bug until the wedding day.
  if (
    typeof seconds !== "number" ||
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > 10
  ) {
    return NextResponse.json(
      { error: "seconds must be an integer 1-10" },
      { status: 400 }
    );
  }

  // ── Best-effort broadcast ──────────────────────────────────────────────────
  // COUNTDOWN_STARTED is a cosmetic signal — a broadcast failure must NOT fail
  // the host request (same precedent as transition/route.ts broadcast handling).
  try {
    await broadcast(`game:${gameId}`, "GAME_EVENT", {
      type: "COUNTDOWN_STARTED",
      gameId,
      seconds,
    } satisfies GameEvent as Record<string, unknown>);
  } catch (err) {
    console.error("[countdown] broadcast failed:", err);
    // Best-effort — cosmetic signal, not a DB mutation. Still return 200.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
