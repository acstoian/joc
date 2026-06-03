import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { TablesUpdate } from "@/types/database";

/**
 * PUT /api/host/questions/[id]   body { body?, option_a?, option_b?, correct_option?: "A"|"B"|null }
 * DELETE /api/host/questions/[id]?gameId=UUID
 *
 * Host-authenticated question update + delete (QSTN-02, QSTN-03, QSTN-04, T-04-07/08).
 * ALL reads/writes use adminClient.from("questions") (base table — includes correct_option).
 *
 * DELETE guard (Pitfall 4 / T-04-08):
 *   Read games.current_question_id; if it matches [id], return 409 with Romanian error.
 *   The host must reset the round before deleting the active question.
 *
 * Security: validateHostAuth(req) is the FIRST statement of every handler.
 * UUID validation: UUID_REGEX on [id] and gameId (T-04-10, ASVS V5).
 */

// ── UUID validation (verbatim from transition/route.ts) ───────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// ── PUT — partial update ──────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // FIRST: host-auth guard (T-04-07)
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Parse + validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    body: questionBody,
    option_a,
    option_b,
    correct_option,
  } = body as Record<string, unknown>;

  // Build partial update payload — only include provided fields
  const updatePayload: TablesUpdate<"questions"> = {};

  if (questionBody !== undefined) {
    if (typeof questionBody !== "string" || questionBody.trim().length === 0) {
      return NextResponse.json({ error: "body must be a non-empty string" }, { status: 400 });
    }
    updatePayload.body = questionBody.trim();
  }

  if (option_a !== undefined) {
    if (typeof option_a !== "string" || option_a.trim().length === 0) {
      return NextResponse.json({ error: "option_a must be a non-empty string" }, { status: 400 });
    }
    updatePayload.option_a = option_a.trim();
  }

  if (option_b !== undefined) {
    if (typeof option_b !== "string" || option_b.trim().length === 0) {
      return NextResponse.json({ error: "option_b must be a non-empty string" }, { status: 400 });
    }
    updatePayload.option_b = option_b.trim();
  }

  if (correct_option !== undefined) {
    if (correct_option !== "A" && correct_option !== "B" && correct_option !== null) {
      return NextResponse.json(
        { error: "correct_option must be 'A', 'B', or null" },
        { status: 400 }
      );
    }
    updatePayload.correct_option = correct_option;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  // Update WITHOUT .single() — detect 0-row (not found) without PGRST116
  const { data: updated, error: updateError } = await adminClient
    .from("questions")
    .update(updatePayload)
    .eq("id", id)
    .select("id, body, option_a, option_b, correct_option, display_order, created_at");

  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", detail: updateError.message },
      { status: 500 }
    );
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ question: updated[0] });
}

// ── DELETE — remove question with active-question guard ───────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // FIRST: host-auth guard (T-04-07)
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Read gameId from query params
  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  // T-04-08 / Pitfall 4: prevent deleting the currently active question
  const { data: game } = await adminClient
    .from("games")
    .select("current_question_id")
    .eq("id", gameId)
    .single();

  if (game?.current_question_id === id) {
    return NextResponse.json(
      {
        error:
          "Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge.",
      },
      { status: 409 }
    );
  }

  // Delete — no .single() needed; 0 rows is a valid "already gone" no-op
  const { error: deleteError } = await adminClient
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("game_id", gameId);

  if (deleteError) {
    return NextResponse.json(
      { error: "delete_failed", detail: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
