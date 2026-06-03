"use client";

/**
 * QuestionRow — one question rendered as a glass Card (Plan 04-03, D-03/D-03a).
 *
 * RowMode state machine: "view" | "editing" | "saving" | "error".
 *
 * View mode:
 *   - question number badge, body text, A/B option labels
 *   - correct-answer A/B toggle (two pills, selected = bg-gold text-ink font-bold,
 *     aria-pressed, min-h-[44px] min-w-[44px]) — marking calls onUpdate(correct_option)
 *   - ▲/▼ reorder buttons (lucide ChevronUp/ChevronDown, min 44px, disabled at ends)
 *   - delete button (Trash2, text-red-400) → AlertDialog with the UI-SPEC §7 copy
 *
 * Editing mode:
 *   - body/option_a/option_b become Inputs
 *   - "Salveaza" (gold) + "Renunta" (ghost)
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

const correctPill = (selected: boolean) =>
  [
    "min-h-[44px] min-w-[44px] rounded-md px-3 text-sm font-bold transition-colors",
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
  const [optionA, setOptionA] = useState(question.option_a);
  const [optionB, setOptionB] = useState(question.option_b);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditing = mode === "editing" || mode === "error";
  const saving = mode === "saving";

  // ── Save (create for drafts, update for existing) ──────────────────────────
  async function handleSave() {
    const trimmed = {
      body: body.trim(),
      option_a: optionA.trim(),
      option_b: optionB.trim(),
    };
    if (!trimmed.body || !trimmed.option_a || !trimmed.option_b) {
      setMode("error");
      setErrorMsg("Completeaza intrebarea si ambele variante.");
      return;
    }
    setMode("saving");
    setErrorMsg(null);
    const result = isDraft
      ? await onCreate?.({ ...trimmed, correct_option: question.correct_option as "A" | "B" | null })
      : await onUpdate(question.id, trimmed);
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
    setOptionA(question.option_a);
    setOptionB(question.option_b);
    setErrorMsg(null);
    setMode("view");
  }

  // ── Mark correct option (A/B) ──────────────────────────────────────────────
  async function handleSetCorrect(option: "A" | "B") {
    if (isDraft) return; // draft has no id yet; correct set on create via toggle below
    if (question.correct_option === option) return;
    await onUpdate(question.id, { correct_option: option });
  }

  return (
    <Card className="glass border-0 shadow-md">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row: number badge + (view) body / reorder / delete */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold/20 px-1.5 text-xs font-bold text-gold-bright">
            {isDraft ? "+" : index + 1}
          </span>

          {isEditing ? (
            <div className="flex flex-1 flex-col gap-2">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Textul intrebarii"
                aria-label="Textul intrebarii"
                disabled={saving}
                className="bg-ink-light text-champagne"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  placeholder="Varianta A"
                  aria-label="Varianta A"
                  disabled={saving}
                  className="bg-ink-light text-champagne"
                />
                <Input
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  placeholder="Varianta B"
                  aria-label="Varianta B"
                  disabled={saving}
                  className="bg-ink-light text-champagne"
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMode("editing")}
              className="flex flex-1 flex-col items-start gap-1 text-left"
            >
              <span className="text-sm font-medium text-champagne">
                {question.body}
              </span>
              <span className="text-xs text-champagne-dim/70">
                A: {question.option_a} · B: {question.option_b}
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
                <AlertDialogContent className="glass border-champagne/10">
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

        {/* Correct-answer toggle + edit actions */}
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
              A
            </button>
            <button
              type="button"
              aria-pressed={question.correct_option === "B"}
              onClick={() => handleSetCorrect("B")}
              disabled={isDraft}
              className={correctPill(question.correct_option === "B")}
            >
              B
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
