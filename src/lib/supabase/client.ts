import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client using the anon (publishable) key.
 *
 * Safe to use in "use client" components. RLS policies on the database
 * enforce access control for the anon role.
 *
 * Key isolation (D-13): NEXT_PUBLIC_ vars only — service_role key NEVER here.
 *
 * Realtime options (Phase 2, RT-04 / D-09):
 *  - worker: true          — offloads heartbeat to a Web Worker; iOS Safari
 *                            cannot throttle it when the tab is backgrounded
 *                            or the phone is locked (Pitfall 12)
 *  - heartbeatIntervalMs   — default SDK value is 25 000 ms, which is dangerously
 *                            close to iOS Safari's ~30 s background-kill threshold;
 *                            15 000 ms gives a 2× safety margin
 *  - reconnectAfterMs      — jittered backoff spreads 100 simultaneous reconnects
 *                            over a 2 s window, preventing a thundering herd (D-09)
 *
 * IMPORTANT: createBrowserClient is a module-level singleton in browser
 * environments. Options passed on the first call are the only ones that take
 * effect; subsequent calls return the cached instance and ignore new options
 * (Pitfall 6). All realtime options must live HERE and nowhere else.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        worker: true,
        heartbeatIntervalMs: 15_000,
        reconnectAfterMs: (tries: number) => {
          const base = [1_000, 2_000, 5_000, 10_000][Math.min(tries - 1, 3)];
          return base + Math.random() * 2_000;
        },
      },
    }
  );
}
