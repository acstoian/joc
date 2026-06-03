"use client";

/**
 * QuestionsTab — placeholder component (Plan 04-01).
 *
 * Minimal placeholder card. Plan 04-03 replaces this with the full question
 * CRUD editor (inline row editing, reorder, correct-answer toggle).
 */

import type { HostTabProps } from "@/components/host/ControlTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function QuestionsTab(_props: HostTabProps) {
  return (
    <Card className="glass border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base font-bold text-champagne">
          Intrebari
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-champagne-dim/60">(in curand)</p>
      </CardContent>
    </Card>
  );
}
