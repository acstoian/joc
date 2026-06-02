import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client using the anon (publishable) key.
 *
 * Safe to use in "use client" components. RLS policies on the database
 * enforce access control for the anon role.
 *
 * Key isolation (D-13): NEXT_PUBLIC_ vars only — service_role key NEVER here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
