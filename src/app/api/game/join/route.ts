import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * POST /api/game/join — Idempotent player upsert (JOIN-01/02/03).
 *
 * A guest calls this once to register (or re-register after a refresh).
 * Identity is the device_token, not the display name — two guests may share
 * a name (D-03). The upsert on UNIQUE(game_id, device_token) guarantees that
 * a second call with the same device_token returns the same player_id (JOIN-03).
 *
 * Request body: { gameId: UUID, deviceToken: UUID, displayName: string }
 * Response:     { ok: true, playerId: string }
 *
 * Input validation (ASVS V5):
 *   - gameId / deviceToken: UUID-shaped → 400 if malformed
 *   - displayName: trimmed, non-empty, ≤ 30 chars; unicode/emoji/diacritics OK (D-04)
 *   - Duplicate names: allowed (D-03 — no "name taken" path)
 *
 * Security:
 *   - T-03-07: All body fields validated before any DB call
 *   - Key isolation: only adminClient (server-only module); no raw key refs in this file
 *   - No broadcast: join is silent; participant count is presence-driven (Phase 4)
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

  const { gameId, deviceToken, displayName } = body as Record<
    string,
    unknown
  >;

  // ── INPUT VALIDATION (ASVS V5) ────────────────────────────────────────────
  // gameId: must be UUID-shaped (else 400)
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  // deviceToken: must be UUID-shaped — device_token is a UUID column (note 01-03)
  if (!isValidUuid(deviceToken)) {
    return NextResponse.json(
      { error: "deviceToken required" },
      { status: 400 }
    );
  }

  // displayName: trim, reject empty/whitespace-only, reject > 30 chars (D-04)
  // UNICODE ALLOWED — emoji and Romanian diacritics (ă â î ș ț) must be accepted.
  // NO charset whitelist — only length and non-empty checks.
  const name = (typeof displayName === "string" ? displayName : "").trim();

  if (!name) {
    return NextResponse.json(
      { error: "displayName required" },
      { status: 400 }
    );
  }

  // WR-02: count Unicode code points, not UTF-16 code units. `name.length`
  // counts surrogate pairs as 2, so a name with emoji / astral characters
  // would be rejected at far fewer than 30 visible characters. `[...name]`
  // iterates by code point (the string iterator is Unicode-aware), giving a
  // count that matches user expectation much more closely.
  if ([...name].length > 30) {
    return NextResponse.json(
      { error: "displayName too long" },
      { status: 400 }
    );
  }

  // ── UPSERT player (JOIN-01/02/03) ─────────────────────────────────────────
  // onConflict: "game_id,device_token" — the UNIQUE constraint from 0001_init_schema.sql.
  // ignoreDuplicates: false — on conflict, UPDATE display_name to the latest value.
  // .select("id").single() — returns the existing or newly-created player row.
  const { data: player, error: playerError } = await adminClient
    .from("players")
    .upsert(
      {
        game_id: gameId,
        device_token: deviceToken,
        display_name: name,
      },
      { onConflict: "game_id,device_token", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      { error: "join_failed", detail: playerError?.message },
      { status: 500 }
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return NextResponse.json({ ok: true, playerId: player.id }, { status: 200 });
}
