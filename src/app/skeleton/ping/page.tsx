"use client";

/**
 * THROWAWAY PROOF HARNESS — Phase 1 only.
 * This page is removed / replaced by the real guest answer flow in Phase 5.
 *
 * Demonstrates the full Walking Skeleton WRITE path:
 *   POST /api/skeleton-answer → 200 first call, 409 on duplicate.
 * A human can visit /skeleton/ping, click once (200), click again (409),
 * and confirm the DB UNIQUE constraint is enforced end-to-end.
 */

import { useState } from "react";

type ApiResult = {
  status: number;
  body: Record<string, unknown>;
};

export default function SkeletonPingPage() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/skeleton-answer", { method: "POST" });
      const body = (await res.json()) as Record<string, unknown>;
      setResult({ status: res.status, body });
    } catch (err) {
      setResult({
        status: 0,
        body: { error: err instanceof Error ? err.message : "Network error" },
      });
    } finally {
      setLoading(false);
    }
  }

  const statusColor =
    result === null
      ? ""
      : result.status === 200
        ? "text-sage-light"
        : result.status === 409
          ? "text-gold"
          : "text-blush";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink p-4">
      <div className="glass w-full max-w-sm rounded-2xl px-8 py-10 text-center shadow-2xl">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-champagne">
          Skeleton Ping
        </h1>
        <div className="thin-divider" aria-hidden="true" />
        <p className="text-xs text-champagne-dim/60">
          Phase 1 proof harness — throwaway
        </p>

        {/* Action button */}
        <button
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading}
          className="mt-8 w-full cursor-pointer rounded-xl bg-gold/20 px-6 py-3 text-sm font-semibold text-gold-bright transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Se trimite…" : "Record test answer"}
        </button>

        {/* Result display */}
        {result !== null && (
          <div
            className="glass-gold mt-6 rounded-xl px-5 py-4 text-left"
            role="status"
            aria-live="polite"
            aria-label="Rezultat API"
          >
            <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${statusColor}`}>
              HTTP {result.status}
              {result.status === 200 && " — Răspuns înregistrat"}
              {result.status === 409 && " — Duplicat respins (23505)"}
            </p>
            <pre className="overflow-auto text-xs text-champagne-dim/80">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </div>
        )}

        <p className="mt-8 text-xs text-champagne-dim/40">
          200 = primul răspuns · 409 = duplicat refuzat de DB
        </p>
      </div>
    </main>
  );
}
