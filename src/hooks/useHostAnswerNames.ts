"use client";

/**
 * useHostAnswerNames — on-demand fetch of who picked A / who picked B (HOST-10).
 *
 * Returns `{ names, loading, refetch }` where names is `{ A: string[]; B: string[] } | null`.
 * Fetches GET /api/host/answers?gameId=&questionId= with the x-host-password header
 * (RESEARCH Pattern 2). No polling — refetch runs:
 *   - whenever `questionId` changes (Broadcast-driven currentQuestionId change), and
 *   - on demand (e.g. when the who-answered collapsible opens).
 * Skips the fetch when questionId is null. Cancelled-guard prevents setState after unmount.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { hostFetch } from "@/lib/host/constants";

export interface AnswerNames {
  A: string[];
  B: string[];
}

export interface UseHostAnswerNamesResult {
  names: AnswerNames | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useHostAnswerNames(
  gameId: string,
  questionId: string | null,
  password: string
): UseHostAnswerNamesResult {
  const [names, setNames] = useState<AnswerNames | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!questionId) {
      setNames(null);
      return;
    }
    setLoading(true);
    try {
      const res = await hostFetch(
        `/api/host/answers?gameId=${gameId}&questionId=${questionId}`,
        password
      );
      if (cancelledRef.current) return;
      if (res.ok) {
        const data = (await res.json()) as AnswerNames;
        if (!cancelledRef.current) setNames({ A: data.A ?? [], B: data.B ?? [] });
      }
    } catch {
      // Best-effort — names are non-critical; leave previous value
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [gameId, questionId, password]);

  // Re-derive when questionId changes (new question / Broadcast-driven change).
  useEffect(() => {
    cancelledRef.current = false;
    void refetch();
    return () => {
      cancelledRef.current = true;
    };
  }, [refetch]);

  return { names, loading, refetch };
}
