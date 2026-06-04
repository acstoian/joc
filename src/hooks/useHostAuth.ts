"use client";

/**
 * useHostAuth — sessionStorage-backed host password gate hook (D-01, SC1).
 *
 * The host enters the password once on the gate screen. It is stored in
 * sessionStorage under SESSION_KEY and attached as x-host-password on every
 * host API call via hostFetch. Persists for the session; cleared on tab close.
 *
 * Auth probe: login() sends GET /api/host/questions?gameId=... with the
 * candidate password. The server runs validateHostAuth (server-only, fail-closed)
 * and returns 401 for wrong password. Any non-401 response (200, 404, 405) is
 * treated as "accepted" — the questions route does not exist until Plan 03,
 * so a 404 in the interim still means the password was validated correctly.
 * Real enforcement is per-request server-side (D-01a). When Plan 03 builds
 * /api/host/questions this becomes a full auth probe (RQ-4, PATTERNS.md).
 *
 * Returns: { password, error, checking, login, logout }
 *   password  — stored password string, or null when unauthenticated
 *   error     — Romanian error message string, or null
 *   checking  — true while the auth probe request is in-flight
 *   login(pw) — async; probes the server, stores on success, sets error on 401
 *   logout()  — clears sessionStorage and nulls password
 */

import { useState, useEffect } from "react";
import { GAME_ID, SESSION_KEY } from "@/lib/host/constants";

export function useHostAuth(): {
  password: string | null;
  hydrated: boolean;
  error: string | null;
  checking: boolean;
  login: (pw: string) => Promise<void>;
  logout: () => void;
} {
  // Start null on BOTH the server and the client's first render so the SSR HTML
  // and initial hydration match (the server has no sessionStorage). Reading
  // sessionStorage in the initial useState() would diverge between server (null)
  // and client (stored value) → hydration mismatch. `hydrated` lets the page hold
  // its decision until the client-only read below completes.
  const [password, setPassword] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setPassword(sessionStorage.getItem(SESSION_KEY));
    setHydrated(true);
  }, []);

  async function login(pw: string): Promise<void> {
    setChecking(true);
    setError(null);
    try {
      // Auth probe: use GET /api/host/questions as the probe endpoint.
      // 401 → wrong password; any other status (200, 404, 405…) → password accepted.
      // (Plan 03 builds the questions route; until then, 404/405 = accepted, RQ-4.)
      const res = await fetch(`/api/host/questions?gameId=${GAME_ID}`, {
        headers: { "x-host-password": pw },
      });
      if (res.status === 401) {
        setError("Parola gresita. Incearca din nou.");
      } else {
        sessionStorage.setItem(SESSION_KEY, pw);
        setPassword(pw);
      }
    } catch {
      setError("Eroare de retea. Incearca din nou.");
    } finally {
      setChecking(false);
    }
  }

  function logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    setPassword(null);
  }

  return { password, hydrated, error, checking, login, logout };
}
