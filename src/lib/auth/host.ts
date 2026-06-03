import "server-only";
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
 *   - No token issuance, no session, no DB call — simple per-request compare.
 *     Acceptable for a single-operator shared secret (D-15, Claude's Discretion).
 */
export function validateHostAuth(req: NextRequest): boolean {
  const password =
    req.headers.get("x-host-password") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return (
    typeof password === "string" &&
    password.length > 0 &&
    password === process.env.HOST_PASSWORD
  );
}
