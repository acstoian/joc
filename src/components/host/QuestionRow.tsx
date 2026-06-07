"use client";

/**
 * QuestionRow — one question rendered as a glass Card (Plan 04-03, D-03/D-03a).
 *
 * All questions are always "Andrei vs Cristina". The correct-answer toggle shows
 * "Andrei" / "Cristina" pills instead of generic A/B. The option text inputs are
 * hidden — option_a and option_b are always "Andrei" / "Cristina" and are sent
 * automatically on save. The host only needs to write the question body.
 *
 * RowMode state machine: "view" | "editing" | "saving" | "error".
 *
 * View mode:
 *   - question number badge, body text
 *   - correct-answer "Andrei"/"Cristina" toggle (gold pill = selected)
 *   - ▲/▼ reorder buttons (min 44px, disabled at ends)
 *   - delete button (Trash2) → AlertDialog with Romanian copy
 *
 * Editing mode:
 *   - body becomes an Input
 *   - "Salveaza" (gold) + "Renunta" (ghost)
 *   - option_a / option_b are always "Andrei" / "Cristina" — not shown as inputs
 *
 * Draft mode (isDraft): starts in editing; Save calls onCreate, Cancel calls onCancelDraft.
 * All copy is Romanian; only @theme tokens are used.
 */

import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { HostQuestion } from "@/hooks/useHostQuestions";

type RowMode = "view" | "editing" | "saving" | "error";

interface QuestionFields {
  body: string;
  option_a: string;
  option_b: string;
  correct_option?: "A" | "B" | null;
}

export interface QuestionRowProps {
  question: HostQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDraft?: boolean;
  onUpdate: (
    id: string,
    fields: Partial<QuestionFields>
  ) => Promise<HostQuestion | null>;
  onCreate?: (fields: QuestionFields) => Promise<HostQuestion | null>;
  onCancelDraft?: () => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}

// "Andrei" / "Cristina" pill — selected = bg-gold text-ink
const correctPill = (selected: boolean) =>
  [
    "min-h-[44px] rounded-md px-4 text-sm font-bold transition-colors",
    selected
      ? "bg-gold text-ink"
      : "bg-ink-muted text-champagne-dim hover:bg-ink-muted/70",
  ].join(" ");

export function QuestionRow({
  question,
  index,
  isFirst,
  isLast,
  isDraft = false,
  onUpdate,
  onCreate,
  onCancelDraft,
  onDelete,
  onMove,
}: QuestionRowProps) {
  const [mode, setMode] = useState<RowMode>(isDraft ? "editing" : "view");
  const [body, setBody] = useState(question.body);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditing = mode === "editing" || mode === "error";
  const saving = mode === "saving";

  // ── Save (create for drafts, update for existing) ──────────────────────────
  async function handleSave() {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setMode("error");
      setErrorMsg("Completeaza textul intrebarii.");
      return;
    }
    setMode("saving");
    setErrorMsg(null);

    // option_a / option_b are always "Andrei" / "Cristina"
    const fields: QuestionFields = {
      body: trimmedBody,
      option_a: "Andrei",
      option_b: "Cristina",
      correct_option: question.correct_option as "A" | "B" | null,
    };

    const result = isDraft
      ? await onCreate?.(fields)
      : await onUpdate(question.id, { body: trimmedBody, option_a: "Andrei", option_b: "Cristina" });

    if (result) {
      setMode("view");
    } else {
      setMode("error");
      setErrorMsg("Salvarea a esuat. Incearca din nou.");
    }
  }

  function handleCancel() {
    if (isDraft) {
      onCancelDraft?.();
      return;
    }
    setBody(question.body);
    setErrorMsg(null);
    setMode("view");
  }

  // ── Mark correct option (Andrei = A, Cristina = B) ────────────────────────
  async function handleSetCorrect(option: "A" | "B") {
    if (isDraft) return;
    if (question.correct_option === option) return;
    await onUpdate(question.id, { correct_option: option });
  }

  return (
    <Card className="glass border-0 shadow-md">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row: number badge + body / controls */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold/20 px-1.5 text-xs font-bold text-gold-bright">
            {isDraft ? "+" : index + 1}
          </span>

          {isEditing ? (
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Textul intrebarii"
              aria-label="Textul intrebarii"
              disabled={saving}
              className="flex-1 bg-ink-light text-champagne"
            />
          ) : (
            <button
              type="button"
              onClick={() => setMode("editing")}
              className="flex flex-1 flex-col items-start gap-1 text-left"
            >
              <span className="text-sm font-medium text-champagne">
                {question.body}
              </span>
            </button>
          )}

          {/* Reorder + edit/delete controls (view mode only) */}
          {!isEditing && !isDraft && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(index, "up")}
                disabled={isFirst}
                aria-label="Muta in sus"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-champagne-dim hover:text-champagne disabled:opacity-40"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, "down")}
                disabled={isLast}
                aria-label="Muta in jos"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-champagne-dim hover:text-champagne disabled:opacity-40"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode("editing")}
                aria-label="Editeaza"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-champagne-dim hover:text-champagne"
              >
                <Pencil className="size-4" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Sterge intrebarea"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </AlertDialogTrigger>
                {/* bg-ink-light is set by AlertDialogContent default — no glass needed */}
                <AlertDialogContent className="border-champagne/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-heading text-champagne">
                      Stergi aceasta intrebare?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-champagne-dim">
                      Aceasta actiune nu poate fi anulata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Renunta</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(question.id)}
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      Da, sterge
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Correct-answer toggle (Andrei / Cristina) + edit actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-champagne-dim/70">Corect:</span>
            <button
              type="button"
              aria-pressed={question.correct_option === "A"}
              onClick={() => handleSetCorrect("A")}
              disabled={isDraft}
              className={correctPill(question.correct_option === "A")}
            >
              Andrei
            </button>
            <button
              type="button"
              aria-pressed={question.correct_option === "B"}
              onClick={() => handleSetCorrect("B")}
              disabled={isDraft}
              className={correctPill(question.correct_option === "B")}
            >
              Cristina
            </button>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-gold text-ink hover:bg-gold-bright"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salveaza
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="text-champagne-dim"
              >
                Renunta
              </Button>
            </div>
          )}
        </div>

        {mode === "error" && errorMsg && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}
      </CardContent>
    </Card>
  );
}
