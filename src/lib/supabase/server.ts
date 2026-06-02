import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions that need the authenticated user session (e.g. host auth).
 *
 * Uses createServerClient from @supabase/ssr to read/write HTTP-only session
 * cookies correctly in the Next.js App Router.
 *
 * Key isolation (D-13): uses anon key + cookies for session — the service_role
 * key is NEVER used here. For privileged server operations, use admin.ts.
 *
 * The `import "server-only"` at the top causes a build error if this module
 * is accidentally imported in a client component (T-01-01 mitigation).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies are read-only.
            // This is safe: the middleware handles session refresh.
          }
        },
      },
    }
  );
}
