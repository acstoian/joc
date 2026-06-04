/**
 * Guest identity helpers — SSR-safe localStorage access.
 *
 * Device token format: UUID v4 (crypto.randomUUID()) — the join route
 * validates with UUID_REGEX; plain nanoid() strings (21 chars) fail the check.
 * Source: Phase 3 CONTEXT.md note 01-03 (device_token is UUID type in DB).
 *
 * localStorage keys must match what useGameSync reads for presence tracking:
 *   "device_token" — used by useGameSync.ts subscribe callback (~line 227)
 *   "player_id"    — used by GuestShell to call useGameSync(GAME_ID, playerId)
 *
 * Threat model (T-05-02): crypto.randomUUID() is a built-in browser API
 * producing a cryptographically random UUID v4; no package needed.
 */

const DEVICE_TOKEN_KEY = "device_token";
const PLAYER_ID_KEY = "player_id";

/**
 * Get the existing device token from localStorage, or generate a new UUID v4
 * and persist it.
 *
 * SSR guard: returns "" when called server-side (window undefined).
 * UUID v4 format passes the UUID_REGEX enforced by POST /api/game/join.
 */
export function getOrCreateDeviceToken(): string {
  if (typeof window === "undefined") return ""; // SSR guard
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID(); // UUID v4 — passes UUID_REGEX in /api/game/join
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

/**
 * Read the guest identity from localStorage.
 * Returns null if the guest has not yet joined (no token or playerId present).
 *
 * SSR guard: returns null when called server-side (window undefined).
 */
export function getIdentity(): { deviceToken: string; playerId: string } | null {
  if (typeof window === "undefined") return null; // SSR guard
  const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
  const playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!deviceToken || !playerId) return null;
  return { deviceToken, playerId };
}

/**
 * Persist the guest identity after a successful POST /api/game/join.
 * Overwrites any existing values (idempotent).
 */
export function setIdentity(identity: { deviceToken: string; playerId: string }): void {
  if (typeof window === "undefined") return; // SSR guard
  localStorage.setItem(DEVICE_TOKEN_KEY, identity.deviceToken);
  localStorage.setItem(PLAYER_ID_KEY, identity.playerId);
}
