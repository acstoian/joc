"use client";

/**
 * StatsTab — placeholder component (Plan 04-01).
 *
 * Minimal placeholder card. Plan 04-04 replaces this with the full stats
 * surface (participant count, A/B distribution bar, collapsible name lists).
 */

import type { HostTabProps } from "@/components/host/ControlTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function StatsTab(_props: HostTabProps) {
  return (
    <Card className="glass border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base font-bold text-champagne">
          Statistici
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-champagne-dim/60">(in curand)</p>
      </CardContent>
    </Card>
  );
}
