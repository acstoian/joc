"use client";

/**
 * EmergencyPanel — collapsible emergency recovery controls (Plan 04-05, HOST-11, SC5).
 *
 * Collapsed by default, visually subdued, red-bordered (UI-SPEC §5.3 C). Four controls:
 *   1. Reseteaza Runda     → AlertDialog → POST /api/host/reset { gameId }
 *   2. Sari la Intrebarea #N → resolves 1-based N to the question id at that display_order
 *                              → POST /api/host/transition { gameId, action:"next", nextQuestionId }
 *   3. Incheie Fortat Jocul → AlertDialog → POST /api/host/transition { gameId, action:"force_end" }
 *   4. Joc Nou / Reseteaza Jocul → AlertDialog → POST /api/host/transition { gameId, action:"reset_game" }
 *      Whole-game wipe: all answers + scores cleared, returns to lobby. DISTINCT from #1
 *      (Reseteaza Runda — round-only surgical reset that returns to question).
 *      Closes GAP-04-01: from the ended phase the host now has a path to start a new game.
 *
 * Reset + force-end + new-game are guarded behind AlertDialog confirmations (T-04-17/T-04-20).
 * Each action shows a Romanian success or 4xx/5xx/409 error toast. The jump's `next` action
 * requires the revealed phase server-side; a 409 from a non-revealed phase surfaces the CAS toast.
 * Only @theme tokens; all copy Romanian.
 */

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, AlertTriangle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { hostFetch } from "@/lib/host/constants";

export interface EmergencyPanelProps {
  gameId: string;
  password: string;
  questions: { id: string; display_order: number }[];
}

function errorToastForStatus(status: number) {
  if (status === 409) {
    toast.error("Starea jocului s-a schimbat. Actiunea nu mai este valida.");
  } else if (status >= 400 && status < 500) {
    toast.error("Actiunea a esuat. Verifica conexiunea si incearca din nou.");
  } else {
    toast.error("Eroare de server. Incearca din nou in cateva secunde.");
  }
}

export function EmergencyPanel({ gameId, password, questions }: EmergencyPanelProps) {
  const [open, setOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Ordered question ids (defensive re-sort by display_order).
  const ordered = [...questions].sort((a, b) => a.display_order - b.display_order);
  const count = ordered.length;

  async function runAction(
    key: string,
    url: string,
    body: Record<string, unknown>,
    successMsg: string
  ) {
    if (busy !== null) return;
    setBusy(key);
    try {
      const res = await hostFetch(url, password, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(successMsg);
      } else {
        errorToastForStatus(res.status);
      }
    } catch {
      toast.error("Actiunea a esuat. Verifica conexiunea si incearca din nou.");
    } finally {
      setBusy(null);
    }
  }

  function handleReset() {
    void runAction(
      "reset",
      "/api/host/reset",
      { gameId },
      "Runda a fost resetata."
    );
  }

  function handleForceEnd() {
    void runAction(
      "force_end",
      "/api/host/transition",
      { gameId, action: "force_end" },
      "Jocul a fost incheiat."
    );
  }

  function handleNewGame() {
    void runAction(
      "reset_game",
      "/api/host/transition",
      { gameId, action: "reset_game" },
      "Jocul a fost resetat. Poti porni un joc nou."
    );
  }

  function handleJump() {
    const n = Number.parseInt(jumpValue, 10);
    if (!Number.isInteger(n) || n < 1 || n > count) {
      toast.error(`Introdu un numar intre 1 si ${count}.`);
      return;
    }
    const target = ordered[n - 1];
    if (!target) {
      toast.error("Intrebarea nu a fost gasita.");
      return;
    }
    void runAction(
      "jump",
      "/api/host/transition",
      { gameId, action: "next", nextQuestionId: target.id },
      `S-a sarit la intrebarea #${n}.`
    );
  }

  const anyBusy = busy !== null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-champagne-dim/60 hover:text-champagne-dim"
        >
          <AlertTriangle className="size-3.5" />
          Controale de urgenta
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="glass mt-3 flex flex-col gap-4 rounded-2xl border border-red-500/20 p-5">
          {/* 1. Reset round */}
          <div className="flex flex-col gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={anyBusy}
                  className="w-full border-red-500/40 text-champagne hover:bg-red-500/10"
                >
                  Reseteaza Runda
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-red-500/30">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-heading text-champagne">
                    Resetezi runda curenta?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-champagne-dim">
                    Raspunsurile pentru aceasta intrebare vor fi sterse si faza
                    revine la &apos;Intrebare&apos;. Actiunea nu poate fi anulata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Renunta</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Da, reseteaza
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* 2. Jump to question by number */}
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="jump-question"
                className="text-xs text-champagne-dim/60"
              >
                Sari la intrebarea #
              </label>
              <Input
                id="jump-question"
                type="number"
                min={1}
                max={count || 1}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                placeholder={count ? `1 - ${count}` : "—"}
                disabled={anyBusy || count === 0}
                className="bg-ink-light text-champagne"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleJump}
              disabled={anyBusy || count === 0}
              className="border-gold/40 text-gold-bright hover:bg-gold/10"
            >
              Sari la Intrebare
            </Button>
          </div>

          {/* 3. Force-end from any state */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={anyBusy}
                className="w-full"
              >
                Incheie Fortat Jocul
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-500/30">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-champagne">
                  Inchei jocul fortat?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-champagne-dim">
                  Jocul se va incheia imediat din orice stare. Aceasta actiune nu
                  poate fi anulata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Renunta</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleForceEnd}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Da, incheie
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 4. Whole-game reset — returns to lobby from ANY phase (GAP-04-01, HOST-11) */}
          {/* DISTINCT from "Reseteaza Runda" (#1) which is round-only and returns to question. */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={anyBusy}
                className="w-full"
              >
                Joc Nou / Reseteaza Jocul
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-500/30">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-champagne">
                  Resetezi tot jocul?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-champagne-dim">
                  Toate raspunsurile si punctajele vor fi sterse, iar jocul revine
                  in asteptare (lobby) pentru un joc nou. Aceasta actiune nu poate
                  fi anulata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Renunta</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleNewGame}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Da, reseteaza jocul
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
