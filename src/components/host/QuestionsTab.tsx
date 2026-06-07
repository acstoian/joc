"use client";

/**
 * QuestionsTab — inline edit-in-list question authoring (Plan 04-03, QSTN-01..05, SC2).
 *
 * Replaces the Plan 01 placeholder. Backed by useHostQuestions →
 * /api/host/questions CRUD. Create/edit/delete/reorder/mark-correct all persist
 * to the DB and survive reload.
 *
 * - Ordered list of QuestionRow (display_order ascending from the hook)
 * - "+ Adauga Intrebare" appends an empty draft editing row (create on save)
 * - Empty state when there are no questions
 * - Skeleton placeholders while loading
 * - ▲/▼ compute the swapped full ordering and call reorder(newOrderIds)
 * - The 409 active-question delete error surfaces as a sonner toast
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionRow } from "@/components/host/QuestionRow";
import { useHostQuestions, type HostQuestion } from "@/hooks/useHostQuestions";
import type { HostTabProps } from "@/components/host/ControlTab";

const DRAFT_ID = "__draft__";

function makeDraft(): HostQuestion {
  return {
    id: DRAFT_ID,
    body: "",
    option_a: "Andrei",
    option_b: "Cristina",
    correct_option: null,
    display_order: Number.MAX_SAFE_INTEGER,
    created_at: "",
  };
}

export function QuestionsTab({ password, gameId }: HostTabProps) {
  const { questions, loading, error, create, update, remove, reorder } =
    useHostQuestions(gameId, password);
  const [draft, setDraft] = useState<HostQuestion | null>(null);

  // Surface hook-level errors (e.g. 409 active-question delete) as a toast.
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  async function handleDelete(id: string) {
    const result = await remove(id);
    if (!result.ok && result.error) {
      toast.error(result.error);
    }
  }

  function handleMove(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next.map((q) => q.id));
  }

  async function handleCreate(fields: {
    body: string;
    option_a: string;
    option_b: string;
    correct_option?: "A" | "B" | null;
  }) {
    const created = await create(fields);
    if (created) setDraft(null);
    return created;
  }

  // ── Loading skeletons ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="glass border-0 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base font-bold text-champagne">
            Intrebari
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl bg-ink-muted/40" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const isEmpty = questions.length === 0 && !draft;

  return (
    <Card className="glass border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base font-bold text-champagne">
          Intrebari
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-champagne-dim/60">Nu ai intrebari inca.</p>
            <Button
              type="button"
              onClick={() => setDraft(makeDraft())}
              className="bg-gold text-ink hover:bg-gold-bright"
            >
              Adauga prima intrebare
            </Button>
          </div>
        ) : (
          <>
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={i}
                isFirst={i === 0}
                isLast={i === questions.length - 1}
                onUpdate={update}
                onDelete={handleDelete}
                onMove={handleMove}
              />
            ))}

            {draft && (
              <QuestionRow
                key={DRAFT_ID}
                question={draft}
                index={questions.length}
                isFirst={false}
                isLast
                isDraft
                onUpdate={update}
                onCreate={handleCreate}
                onCancelDraft={() => setDraft(null)}
                onDelete={() => setDraft(null)}
                onMove={() => {}}
              />
            )}

            {!draft && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(makeDraft())}
                className="self-start text-champagne-dim hover:text-champagne"
              >
                <Plus className="size-4" />
                Adauga Intrebare
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
