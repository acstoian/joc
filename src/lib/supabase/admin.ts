import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-only Supabase admin client (service_role key).
 *
 * Bypasses RLS — use only for privileged server operations:
 *   - Host broadcasting game events via REST Broadcast API (RT-02)
 *   - Seed / reset operations that must bypass player-facing RLS
 *
 * Key isolation (D-13 / T-01-01):
 *   - SUPABASE_SERVICE_ROLE_KEY has NO NEXT_PUBLIC_ prefix — it never reaches
 *     the browser bundle.
 *   - `import "server-only"` causes a build error if this module is imported
 *     in a "use client" component, enforcing the server boundary at compile time.
 */
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin credentials. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Singleton admin client instance.
 * Re-use across invocations within the same serverless function warm instance.
 */
export const adminClient = createAdminClient();

// ── REST Broadcast helper (RT-02) ────────────────────────────────────────────

/**
 * Broadcast a game event to all subscribers on a Supabase Realtime channel
 * via the HTTP Broadcast API (not via WebSocket).
 *
 * This is the preferred pattern for host → all clients broadcast in Next.js
 * serverless Route Handlers / Server Actions:
 *   - No persistent WebSocket connection required server-side
 *   - Each host action is a single stateless HTTP POST
 *   - Scales correctly on Vercel's serverless functions
 *
 * Per ARCHITECTURE.md §"Server-Side Broadcast" and STACK.md §"Host Broadcasting".
 *
 * @param topic   Realtime channel name, e.g. `game:${gameId}`
 * @param event   Event name, e.g. "GAME_EVENT"
 * @param payload Serializable event payload
 *
 * @example
 * await broadcast(`game:${gameId}`, "GAME_EVENT", {
 *   type: "QUESTION_STARTED",
 *   questionId: q.id,
 *   questionText: q.text,
 *   optionA: q.option_a,
 *   optionB: q.option_b,
 * });
 */
export async function broadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Cannot broadcast: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"
    );
  }

  const response = await fetch(
    `${url}/realtime/v1/api/broadcast`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event,
            payload,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Supabase broadcast failed [${response.status}]: ${body}`
    );
  }
}
