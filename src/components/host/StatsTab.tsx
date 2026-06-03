"use client";

/**
 * StatsTab — live stats surface (Plan 04-04, HOST-08/09/10, SC3, D-04, UI-SPEC §5.5).
 *
 * Replaces the Plan 01 placeholder. Four sections:
 *   A. Participant count card — live count from useGameSync + connection status pill
 *   B. Current-question distribution card — DistributionBar; counts from
 *      state.distribution (locked/revealed) OR useHostAnswerNames lengths (live during question)
 *   C. "Vezi cine a raspuns" Collapsible (default closed) — names per option (HOST-10)
 *   D. Leaderboard card — ranked from state.leaderboard
 *
 * Names (HOST-10) come from the host-only /api/host/answers endpoint, never the public
 * GET /api/game/state (RQ-1). All copy Romanian; only @theme tokens.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DistributionBar } from "@/components/host/DistributionBar";
import { useHostAnswerNames } from "@/hooks/useHostAnswerNames";
import type { HostTabProps } from "@/components/host/ControlTab";
import type { SyncStatus } from "@/hooks/useGameSync";

const STATUS_META: Record<
  SyncStatus,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  connected: { label: "conectat", dot: "bg-sage", text: "text-sage-light" },
  connecting: {
    label: "conectare...",
    dot: "bg-gold",
    text: "text-gold-bright",
    pulse: true,
  },
  reconnecting: {
    label: "reconectare...",
    dot: "bg-gold",
    text: "text-gold-bright",
    pulse: true,
  },
  error: { label: "deconectat", dot: "bg-blush-deep", text: "text-blush" },
};

export function StatsTab({ state, status, participantCount, password, gameId }: HostTabProps) {
  const [namesOpen, setNamesOpen] = useState(false);
  const { names, loading: namesLoading, refetch } = useHostAnswerNames(
    gameId,
    state?.currentQuestionId ?? null,
    password
  );

  // Live counts: prefer server distribution (locked/revealed); else names lengths
  // (live during the `question` phase, when distribution is still null).
  const aCount = state?.distribution?.A ?? names?.A.length ?? 0;
  const bCount = state?.distribution?.B ?? names?.B.length ?? 0;
  const hasAnswers = aCount + bCount > 0;

  const st = STATUS_META[status] ?? STATUS_META.connecting;

  function handleToggleNames(open: boolean) {
    setNamesOpen(open);
    if (open) void refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A. Participant count + connection status */}
      <Card className="glass border-0 shadow-xl">
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-gold-bright">
              {participantCount}
            </span>
            <span className="text-xs text-champagne-dim/60">jucatori conectati</span>
          </div>
          <span className={`flex items-center gap-2 text-xs ${st.text}`}>
            <span
              className={`size-2 rounded-full ${st.dot} ${st.pulse ? "animate-pulse" : ""}`}
            />
            {st.label}
          </span>
        </CardContent>
      </Card>

      {/* B. Current-question distribution */}
      <Card className="glass border-0 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm font-bold text-champagne">
            {state?.currentQuestion?.body ?? "Distributie raspunsuri"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasAnswers ? (
            <DistributionBar a={aCount} b={bCount} height={12} />
          ) : (
            <p className="text-xs text-champagne-dim/60">Niciun raspuns inca.</p>
          )}
        </CardContent>
      </Card>

      {/* C. Who-answered names (collapsible, default closed) */}
      <Collapsible open={namesOpen} onOpenChange={handleToggleNames}>
        <Card className="glass border-0 shadow-xl">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-sm text-champagne-dim/80 hover:text-champagne"
            >
              <span>Vezi cine a raspuns</span>
              <ChevronDown
                className={`size-4 transition-transform ${namesOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid grid-cols-2 gap-4 pt-0">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gold-bright">Au ales A</span>
                {namesLoading && !names ? (
                  <span className="text-xs text-champagne-dim/50">se incarca...</span>
                ) : names && names.A.length > 0 ? (
                  names.A.map((n, i) => (
                    <span key={`a-${i}`} className="text-sm text-champagne-dim">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-champagne-dim/50">Niciun jucator</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-blush">Au ales B</span>
                {namesLoading && !names ? (
                  <span className="text-xs text-champagne-dim/50">se incarca...</span>
                ) : names && names.B.length > 0 ? (
                  names.B.map((n, i) => (
                    <span key={`b-${i}`} className="text-sm text-champagne-dim">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-champagne-dim/50">Niciun jucator</span>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* D. Leaderboard */}
      <Card className="glass border-0 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm font-bold text-champagne">
            Clasament
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {state && state.leaderboard.length > 0 ? (
            state.leaderboard.map((entry, i) => (
              <div
                key={`${entry.name}-${i}`}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${
                  i < 3 ? "bg-gold/10" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold ${
                      i < 3 ? "text-gold-bright" : "text-champagne-dim"
                    }`}
                  >
                    {i + 1}.
                  </span>
                  <span className="text-sm text-champagne">{entry.name}</span>
                </span>
                <span className="text-sm font-bold text-gold-bright">
                  {entry.score}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-champagne-dim/60">Niciun punctaj inca.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
