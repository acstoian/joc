import "server-only";
import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * validateHostAuth(req) — SC3 / HOST-01 server-side host-password gate.
 *
 * Every POST /api/host/* route calls this at the top of its handler:
 *   if (!validateHostAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
 *
 * The host client (Phase 4) holds HOST_PASSWORD in session memory and sends
 * it on every request via one of two headers (either is accepted):
 *   - x-host-password: <password>   (preferred)
 *   - Authorization: Bearer <password>   (fallback, case-insensitive prefix strip)
 *
 * Security boundaries (ASVS V2 / V4):
 *   - `import "server-only"` causes a build error if imported in a "use client"
 *     component — guarantees HOST_PASSWORD never reaches the browser bundle.
 *   - HOST_PASSWORD MUST NOT have a NEXT_PUBLIC_ prefix (server-only env var).
 *   - No token issuance, no session, no DB call — constant-time compare per request.
 *     Acceptable for a single-operator shared secret (D-15, Claude's Discretion).
 *
 * CR-03 / WR-05 fixes:
 *   - Fail-closed startup guard: if HOST_PASSWORD is unset, log a clear error and
 *     return false — misconfiguration is never silently treated as "open access".
 *   - timingSafeEqual (Node crypto) replaces === so timing side-channels cannot
 *     be used to brute-force the password at a physically-present adversary.
 *   - Length mismatch is rejected before the buffer comparison (timingSafeEqual
 *     requires same-length buffers; rejecting early also avoids padding oracle
 *     style leaks through comparison time on unequal-length strings).
 */
export function validateHostAuth(req: NextRequest): boolean {
  const envPassword = process.env.HOST_PASSWORD;

  // CR-03 / WR-05: fail closed — a misconfigured deployment must never
  // silently allow access or produce a misleading 401 with no explanation.
  if (!envPassword) {
    console.error(
      "[host-auth] HOST_PASSWORD env var is not set — all host requests will be rejected"
    );
    return false;
  }

  const password =
    req.headers.get("x-host-password") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (typeof password !== "string" || password.length === 0) return false;

  // CR-03: constant-time comparison prevents timing side-channel attacks.
  // timingSafeEqual requires same-length Buffers — reject length mismatch
  // before converting so we never hand different-length buffers to the fn.
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(envPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
