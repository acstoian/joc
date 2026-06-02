import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Root page — Walking Skeleton READ
 *
 * Server Component that reads, via the typed anon client, the seeded game
 * row (phase) and a COUNT of rows in the questions_public VIEW (not the
 * base questions table — proving anon reads go through the secrecy view).
 *
 * Values are fetched live from the cloud DB on every request — nothing is
 * hardcoded. Fetches are parallelized (vercel: async-parallel rule).
 *
 * Key isolation (D-13): anon key only — service_role key never used here.
 */
async function getSkeletonData() {
  // Anon key only — service_role key must never be used in a Server Component
  // that renders in the client bundle surface area (D-13).
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Parallelize independent fetches (vercel: async-parallel)
  const [gameResult, countResult] = await Promise.all([
    supabase
      .from("games")
      .select("phase")
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
    supabase
      .from("questions_public")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    phase: gameResult.error ? "unknown" : (gameResult.data?.phase ?? "unknown"),
    questionCount: countResult.error ? 0 : (countResult.count ?? 0),
    error:
      gameResult.error?.message ?? countResult.error?.message ?? null,
  };
}

export default async function HomePage() {
  const { phase, questionCount, error } = await getSkeletonData();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink p-4">
      {/*
       * Soft-luxury glassmorphism card (D-16 theme tokens + .glass utility).
       * min-h-dvh instead of min-h-screen for correct mobile viewport height.
       */}
      <div className="glass w-full max-w-sm rounded-2xl px-8 py-10 text-center shadow-2xl">
        {/* Heading — Playfair Display via --font-heading */}
        <h1 className="font-heading text-4xl font-bold tracking-tight text-champagne">
          Joc
        </h1>
        <div className="thin-divider" aria-hidden="true" />
        <p className="text-sm font-medium uppercase tracking-widest text-champagne-dim">
          Live Wedding Game Show
        </p>

        {/* Live data row */}
        <div className="glass-gold mt-8 rounded-xl px-6 py-5" role="status" aria-label="Starea jocului">
          {error ? (
            <p className="text-sm text-blush" role="alert">
              Eroare DB: {error}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-widest text-champagne-dim">
                  Faza
                </span>
                <span className="rounded-full bg-sage/20 px-3 py-1 text-sm font-semibold capitalize text-sage-light">
                  {phase}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs uppercase tracking-widest text-champagne-dim">
                  Întrebări
                </span>
                <span className="tabular-nums text-sm font-semibold text-gold-bright">
                  {questionCount} încărcate
                </span>
              </div>
            </>
          )}
        </div>

        {/* Walking skeleton notice — dev-only context */}
        <p className="mt-8 text-xs text-champagne-dim/50">
          Walking Skeleton — date live din Supabase
        </p>
      </div>
    </main>
  );
}
