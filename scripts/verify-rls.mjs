/**
 * verify-rls.mjs — Anon-key RLS secrecy proof (D-12, ROADMAP SC3)
 *
 * Asserts two invariants using ONLY the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY):
 *
 *   Assertion 1: anon select('correct_option') from base `questions` table
 *                returns either an error OR zero readable rows.
 *                (anon role is denied on the base table per RLS policy)
 *
 *   Assertion 2: anon select('*') from `questions_public` VIEW succeeds AND
 *                the returned row objects have NO `correct_option` key.
 *                (the view column-masks correct_option)
 *
 * Exit 0 on all PASS, non-zero on any FAIL.
 *
 * Usage: node scripts/verify-rls.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * PITFALLS #11 compliance: tests with the ANON key, not service role.
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

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local");
  process.exit(1);
}

// ANON client only — this is the whole point of the test
const anon = createClient(supabaseUrl, anonKey);

console.log("verify-rls.mjs — testing with ANON key\n");

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}`);
  if (detail) console.error(`        ${detail}`);
  failed++;
}

// ── Assertion 1: anon cannot read correct_option from base questions ─────────
console.log("Assertion 1: anon SELECT correct_option FROM questions");
{
  const { data, error } = await anon
    .from("questions")
    .select("correct_option")
    .limit(10);

  if (error) {
    // RLS denied — this is the expected path
    pass("Anon read of questions.correct_option is denied (error returned)");
    console.log(`        error.code=${error.code} message="${error.message}"`);
  } else if (!data || data.length === 0) {
    // RLS returned empty result — also acceptable denial
    pass("Anon read of questions returns 0 rows (denied by USING(false))");
  } else {
    // Got rows back — check if correct_option column is present and populated
    const hasColumn = data.some(
      (row) => "correct_option" in row && row.correct_option !== null
    );
    if (hasColumn) {
      fail(
        "Anon CAN read correct_option from base questions — RLS not enforced!",
        `Got ${data.length} rows with correct_option values`
      );
    } else {
      // Column returned but all null — still a failure since the column is exposed
      fail(
        "Anon query returned rows from base questions (column present, values null)",
        "RLS USING(false) should return 0 rows or an error, not rows with null correct_option"
      );
    }
  }
}

// ── Assertion 2: anon reads questions_public, no correct_option key ──────────
console.log("\nAssertion 2: anon SELECT * FROM questions_public (view)");
{
  const { data, error } = await anon
    .from("questions_public")
    .select("*")
    .limit(10);

  if (error) {
    fail(
      "Anon read of questions_public VIEW failed with error",
      `error.code=${error.code} message="${error.message}"`
    );
  } else if (!data || data.length === 0) {
    fail(
      "questions_public returned 0 rows — seed data missing or view broken",
      "Expected 5 seeded questions to be readable via the view"
    );
  } else {
    // Check no correct_option key in any row
    const rowsWithKey = data.filter((row) => "correct_option" in row);
    if (rowsWithKey.length > 0) {
      fail(
        "questions_public rows contain correct_option key — view is leaking the column!",
        `${rowsWithKey.length} of ${data.length} rows have the key`
      );
    } else {
      pass(
        `questions_public returned ${data.length} rows, none have correct_option key`
      );
      // Show the keys present to confirm the column is truly absent
      const keys = Object.keys(data[0]).join(", ");
      console.log(`        columns present: ${keys}`);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Result: ${passed} passed, ${failed} failed ──`);

if (failed > 0) {
  console.error("FAILED — RLS secrecy invariant is NOT satisfied");
  process.exit(1);
} else {
  console.log("PASSED — anon role cannot read correct_option (D-12 / ROADMAP SC3)");
  process.exit(0);
}
