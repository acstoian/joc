/**
 * Host dashboard constants — client-safe (NOT server-only).
 *
 * Intentionally does NOT import "server-only", @/lib/supabase/admin, or
 * @/lib/auth/host — those are server-only and would break the client build
 * (Pitfall 6, T-04-02).
 *
 * GAME_ID: the single game UUID. Falls back to the Phase 1 seed UUID in dev
 * so the dashboard works without env config (NEXT_PUBLIC_ prefix = client-safe).
 *
 * HOST_SENTINEL_PLAYER_ID: a well-formed UUID v4-shape value passed as playerId
 * to GET /api/game/state from the host dashboard. The endpoint accepts any valid
 * UUID; this sentinel will never match a real player record, so myAnswer is
 * always null — correct for a host observer (RQ-3, Pitfall 1).
 *
 * SESSION_KEY: the sessionStorage key for the stored host password (D-01).
 *
 * hostFetch: client-side fetch helper that attaches Content-Type and the
 * x-host-password header on every host API call (RESEARCH Pattern 2, D-01a).
 * validateHostAuth on the server reads this header on every request.
 */

export const GAME_ID =
  process.env.NEXT_PUBLIC_GAME_ID ?? "a0000000-0000-4000-8000-000000000001";

/** Valid UUID v4 shape — passes the UUID_REGEX in GET /api/game/state (RQ-3). */
export const HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000";

export const SESSION_KEY = "host_password";

/**
 * hostFetch — attaches x-host-password header on every host API call.
 *
 * Usage:
 *   const res = await hostFetch("/api/host/questions?gameId=...", password);
 *   const res = await hostFetch("/api/host/transition", password, {
 *     method: "POST",
 *     body: JSON.stringify({ gameId, action }),
 *   });
 */
export async function hostFetch(
  url: string,
  password: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-host-password": password,
      ...(options.headers ?? {}),
    },
  });
}
