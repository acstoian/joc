/**
 * verify-dedup.mjs — Duplicate-answer UNIQUE constraint proof (SCOR-03, ROADMAP SC5)
 *
 * Uses the SERVICE-ROLE key to write directly to the DB, simulating the
 * server layer. Asserts:
 *
 *   1. A throwaway test player can be created (upserted) for the seeded game.
 *   2. An answer INSERT for (player_id, question_id) succeeds (200-path).
 *   3. An identical INSERT for the same (player_id, question_id) is rejected
 *      by the DB UNIQUE constraint with SQLSTATE 23505.
 *   4. Cleanup: delete the test answer + player rows.
 *
 * Exit 0 on all PASS (23505 raised on second insert), non-zero on any FAIL.
 *
 * Usage: node scripts/verify-dedup.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * PITFALLS #11 compliance: uses SERVICE-ROLE key for writes (anon INSERT is
 * denied by RLS on players/answers in this skeleton; the real API route also
 * uses service role for privileged writes).
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

let envVars = {};
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    envVars[key] = val;
  }
} catch {
  console.error("Could not read .env.local — ensure it exists at project root.");
  process.exit(1);
}

const supabaseUrl =
  envVars["NEXT_PUBLIC_SUPABASE_URL"] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  envVars["SUPABASE_SERVICE_ROLE_KEY"] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "FAIL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
  );
  process.exit(1);
}

// SERVICE-ROLE client — bypasses RLS; used here to write directly as the server layer does
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_GAME_ID = "a0000000-0000-4000-8000-000000000001";
const SEED_QUESTION_ID = "b0000000-0000-4000-8000-000000000001";
const TEST_DEVICE_TOKEN = "d0000000-0000-4000-8000-000000000099"; // fixed UUID for dedup test
const TEST_DISPLAY_NAME = "verify-dedup test player";

console.log("verify-dedup.mjs — testing with SERVICE-ROLE key\n");

let passed = 0;
let failed = 0;
let testPlayerId = null;
let firstAnswerId = null;

function pass(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}`);
  if (detail) console.error(`        ${detail}`);
  failed++;
}

// ── Step 1: Ensure throwaway test player ─────────────────────────────────────
console.log("Step 1: Upsert throwaway test player");
{
  const { data, error } = await admin
    .from("players")
    .upsert(
      {
        game_id: SEED_GAME_ID,
        device_token: TEST_DEVICE_TOKEN,
        display_name: TEST_DISPLAY_NAME,
      },
      { onConflict: "game_id,device_token", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error || !data) {
    fail("Could not upsert test player", error?.message);
    console.error("\nFAILED — cannot continue without a test player");
    process.exit(1);
  }

  testPlayerId = data.id;
  pass(`Test player upserted/found — id=${testPlayerId}`);
}

// ── Step 2: First INSERT — expect success ─────────────────────────────────────
console.log("\nStep 2: First INSERT answer (expect success)");
{
  const { data, error } = await admin
    .from("answers")
    .insert({
      player_id: testPlayerId,
      question_id: SEED_QUESTION_ID,
      choice: "A",
    })
    .select("id")
    .single();

  if (error) {
    fail(
      "First INSERT failed unexpectedly",
      `code=${error.code} message="${error.message}"`
    );
    // Try cleanup anyway
    await admin.from("players").delete().eq("id", testPlayerId);
    process.exit(1);
  }

  firstAnswerId = data?.id;
  pass(`First INSERT succeeded — answer id=${firstAnswerId}`);
}

// ── Step 3: Duplicate INSERT — expect 23505 ──────────────────────────────────
console.log("\nStep 3: Second INSERT same (player_id, question_id) — expect 23505");
{
  const { error } = await admin
    .from("answers")
    .insert({
      player_id: testPlayerId,
      question_id: SEED_QUESTION_ID,
      choice: "B", // different choice, same player+question — still a duplicate
    });

  if (!error) {
    fail(
      "Duplicate INSERT succeeded — UNIQUE constraint NOT enforced!",
      "Expected error.code === '23505' but got no error"
    );
  } else if (error.code === "23505") {
    pass(
      `Duplicate INSERT rejected with SQLSTATE 23505 (${error.message.substring(0, 60)}…)`
    );
  } else {
    fail(
      `Got error but wrong code — expected 23505, got ${error.code}`,
      error.message
    );
  }
}

// ── Cleanup: delete test answer + player ─────────────────────────────────────
console.log("\nCleanup: removing test rows");
{
  if (firstAnswerId) {
    const { error } = await admin
      .from("answers")
      .delete()
      .eq("id", firstAnswerId);
    if (error) {
      console.warn(`  WARN  Could not delete test answer ${firstAnswerId}: ${error.message}`);
    } else {
      console.log(`  OK    Deleted test answer ${firstAnswerId}`);
    }
  }

  if (testPlayerId) {
    const { error } = await admin
      .from("players")
      .delete()
      .eq("id", testPlayerId);
    if (error) {
      console.warn(`  WARN  Could not delete test player ${testPlayerId}: ${error.message}`);
    } else {
      console.log(`  OK    Deleted test player ${testPlayerId}`);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Result: ${passed} passed, ${failed} failed ──`);

if (failed > 0) {
  console.error("FAILED — duplicate-answer constraint is NOT enforced by the DB");
  process.exit(1);
} else {
  console.log("PASSED — UNIQUE(player_id, question_id) enforced with 23505 (SCOR-03 / ROADMAP SC5)");
  process.exit(0);
}
