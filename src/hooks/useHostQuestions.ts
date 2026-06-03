"use client";

/**
 * useHostQuestions — CRUD state hook for the host questions tab (Plan 04-03).
 *
 * All mutations call hostFetch against /api/host/questions* with the
 * x-host-password header (RESEARCH Pattern 2) and call refetch() on success
 * so the UI always reflects persisted state from the DB (SC2).
 *
 * Cancelled-guard pattern applied to GET so state is never set after unmount
 * (analogous to useGameSync lines 92–108).
 *
 * Surface API errors (including the 409 active-question message) via the
 * returned `error` string so the UI can show a toast.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { hostFetch } from "@/lib/host/constants";

export interface HostQuestion {
  id: string;
  body: string;
  option_a: string;
  option_b: string;
  correct_option: string | null;
  display_order: number;
  created_at: string;
}

export interface UseHostQuestionsResult {
  questions: HostQuestion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (q: {
    body: string;
    option_a: string;
    option_b: string;
    correct_option?: "A" | "B" | null;
  }) => Promise<HostQuestion | null>;
  update: (
    id: string,
    fields: {
      body?: string;
      option_a?: string;
      option_b?: string;
      correct_option?: "A" | "B" | null;
    }
  ) => Promise<HostQuestion | null>;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
  reorder: (newOrderIds: string[]) => Promise<void>;
}

export function useHostQuestions(
  gameId: string,
  password: string
): UseHostQuestionsResult {
  const [questions, setQuestions] = useState<HostQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancelled guard ref — set on cleanup to prevent state updates after unmount
  const cancelledRef = useRef(false);

  // ── refetch — GET /api/host/questions?gameId= ────────────────────────────
  const refetch = useCallback(async () => {
    if (cancelledRef.current) return;
    setLoading(true);
    try {
      const res = await hostFetch(
        `/api/host/questions?gameId=${gameId}`,
        password
      );
      if (cancelledRef.current) return;
      if (res.ok) {
        const data = (await res.json()) as { questions: HostQuestion[] };
        if (cancelledRef.current) return;
        setQuestions(data.questions ?? []);
        setError(null);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if (!cancelledRef.current) {
          setError(err.error ?? "Eroare la incarcarea intrebarilor.");
        }
      }
    } catch {
      if (!cancelledRef.current) {
        setError("Eroare de retea. Incearca din nou.");
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [gameId, password]);

  // Initial fetch on mount (and when gameId/password change)
  useEffect(() => {
    cancelledRef.current = false;
    void refetch();
    return () => {
      cancelledRef.current = true;
    };
  }, [refetch]);

  // ── create — POST /api/host/questions ────────────────────────────────────
  const create = useCallback(
    async (q: {
      body: string;
      option_a: string;
      option_b: string;
      correct_option?: "A" | "B" | null;
    }): Promise<HostQuestion | null> => {
      try {
        const res = await hostFetch("/api/host/questions", password, {
          method: "POST",
          body: JSON.stringify({ gameId, ...q }),
        });
        if (res.ok) {
          const data = (await res.json()) as { question: HostQuestion };
          await refetch();
          return data.question;
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Eroare la crearea intrebarii.");
        return null;
      } catch {
        setError("Eroare de retea. Incearca din nou.");
        return null;
      }
    },
    [gameId, password, refetch]
  );

  // ── update — PUT /api/host/questions/[id] ────────────────────────────────
  const update = useCallback(
    async (
      id: string,
      fields: {
        body?: string;
        option_a?: string;
        option_b?: string;
        correct_option?: "A" | "B" | null;
      }
    ): Promise<HostQuestion | null> => {
      try {
        const res = await hostFetch(`/api/host/questions/${id}`, password, {
          method: "PUT",
          body: JSON.stringify(fields),
        });
        if (res.ok) {
          const data = (await res.json()) as { question: HostQuestion };
          await refetch();
          return data.question;
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Eroare la actualizarea intrebarii.");
        return null;
      } catch {
        setError("Eroare de retea. Incearca din nou.");
        return null;
      }
    },
    [password, refetch]
  );

  // ── remove — DELETE /api/host/questions/[id]?gameId= ─────────────────────
  const remove = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await hostFetch(
          `/api/host/questions/${id}?gameId=${gameId}`,
          password,
          { method: "DELETE" }
        );
        if (res.ok) {
          await refetch();
          return { ok: true };
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = err.error ?? "Eroare la stergerea intrebarii.";
        return { ok: false, error: msg };
      } catch {
        return { ok: false, error: "Eroare de retea. Incearca din nou." };
      }
    },
    [gameId, password, refetch]
  );

  // ── reorder — PATCH /api/host/questions/reorder ──────────────────────────
  const reorder = useCallback(
    async (newOrderIds: string[]): Promise<void> => {
      try {
        const res = await hostFetch("/api/host/questions/reorder", password, {
          method: "PATCH",
          body: JSON.stringify({ gameId, order: newOrderIds }),
        });
        if (res.ok) {
          await refetch();
        } else {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(err.error ?? "Eroare la reordonarea intrebarilor.");
        }
      } catch {
        setError("Eroare de retea. Incearca din nou.");
      }
    },
    [gameId, password, refetch]
  );

  return { questions, loading, error, refetch, create, update, remove, reorder };
}
