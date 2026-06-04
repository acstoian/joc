"use client";

/**
 * /host — Password-gated host dashboard (D-01, D-02, SC1).
 *
 * Gate: if no password is stored in sessionStorage, renders the Romanian
 * password gate (UI-SPEC §5.1). On correct password, renders the three-tab
 * dashboard shell (UI-SPEC §5.2).
 *
 * One useGameSync subscription shared across all three tabs (D-02).
 * Host sentinel player UUID passes the UUID_REGEX in GET /api/game/state (RQ-3).
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useHostAuth } from "@/hooks/useHostAuth";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID, HOST_SENTINEL_PLAYER_ID } from "@/lib/host/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { ControlTab } from "@/components/host/ControlTab";
import { QuestionsTab } from "@/components/host/QuestionsTab";
import { StatsTab } from "@/components/host/StatsTab";
import { cn } from "@/lib/utils";

// ── Password gate ─────────────────────────────────────────────────────────────

/**
 * PasswordGate — shown when no host password is in sessionStorage (SC1, D-01a).
 * Centered card on bg-ink, max-w-[360px], Romanian copy per UI-SPEC §5.1/§7.
 *
 * Controlled by the parent's single useHostAuth() instance (login/error/checking
 * passed as props). useHostAuth is a per-component hook — calling it here too would
 * create an ISOLATED state instance, so a successful login would update only this
 * instance and never the page-root instance that decides which view to render,
 * leaving the user stuck on the gate. The single instance lives in HostPage.
 */
function PasswordGate({
  login,
  error,
  checking,
}: {
  login: (pw: string) => Promise<void>;
  error: string | null;
  checking: boolean;
}) {
  const [value, setValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) await login(value.trim());
  }

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-ink px-4"
      aria-label="Autentificare gazda"
    >
      <Card className="glass w-full max-w-[360px] border-0 shadow-2xl">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="font-heading text-xl font-bold text-champagne">
            Dashboard Gazda
          </CardTitle>
          <p className="mt-1 text-xs text-champagne-dim/70">
            Introdu parola pentru a accesa controlul jocului.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Visible label — ui-ux: form-labels, input-labels */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="host-password"
                className="text-xs font-medium text-champagne-dim"
              >
                Parola
              </label>
              {/* Password input with show/hide toggle — ui-ux: password-toggle */}
              <div className="relative">
                <Input
                  id="host-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={checking}
                  aria-invalid={error !== null}
                  aria-describedby={error !== null ? "gate-error" : undefined}
                  className="min-h-[44px] border-champagne/20 bg-ink-light pr-11 text-champagne placeholder:text-champagne-dim/40 focus-visible:ring-gold/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ascunde parola" : "Arata parola"}
                  className="absolute right-0 top-0 flex size-11 items-center justify-center text-champagne-dim/60 hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {/* Error shown inline below the field — ui-ux: error-placement */}
              {error !== null && (
                <p
                  id="gate-error"
                  role="alert"
                  aria-live="polite"
                  className="text-xs font-semibold text-red-400"
                >
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={checking || value.trim().length === 0}
              aria-busy={checking}
              className="min-h-[44px] w-full bg-gold/20 text-gold-bright hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? "Se verifica..." : "Intra"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sonner toaster — mounted once at the page root */}
      <Toaster />
    </main>
  );
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

/**
 * DashboardShell — shown after successful auth (D-02, D-02a).
 * Mobile-first, sticky 48px header, one useGameSync subscription shared
 * across all tab bodies (D-02 — exactly ONE useGameSync call).
 */
function DashboardShell({ password }: { password: string }) {
  // ONE shared useGameSync subscription — all tabs receive state via props (D-02)
  const { state, status, participantCount } = useGameSync(
    GAME_ID,
    HOST_SENTINEL_PLAYER_ID
  );

  const statusLabel =
    status === "connected"
      ? "conectat"
      : status === "reconnecting"
        ? "reconectare..."
        : status === "error"
          ? "eroare conexiune"
          : "conectare...";

  const statusVariant =
    status === "connected"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";

  const tabProps = { state, status, participantCount, password, gameId: GAME_ID };

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-ink">
        {/* Sticky 48px header — UI-SPEC §5.2, D-02a */}
        <header
          className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-champagne/10 bg-ink px-4"
          aria-label="Header dashboard gazda"
        >
          <h1 className="font-heading text-base font-bold text-champagne">
            Joc — Gazda
          </h1>
          <Badge
            variant={statusVariant}
            className={cn(
              "text-xs",
              status === "connected" && "bg-emerald-500/20 text-emerald-400",
              status === "reconnecting" && "animate-pulse bg-gold/20 text-gold",
              status === "error" && "bg-red-500/20 text-red-400",
              (status === "connecting" || !status) &&
                "bg-champagne/10 text-champagne-dim"
            )}
            aria-live="polite"
            aria-label={`Status conexiune: ${statusLabel}`}
          >
            {statusLabel}
          </Badge>
        </header>

        {/* Tabbed dashboard body — fills remaining viewport height */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs defaultValue="control" className="flex flex-1 flex-col">
            {/* Sticky tab list — stays below the header on scroll */}
            <TabsList className="sticky top-12 z-10 grid w-full grid-cols-3 rounded-none border-b border-champagne/10 bg-ink px-2 py-1">
              <TabsTrigger
                value="control"
                className="min-h-[44px] rounded-lg text-xs font-semibold text-champagne-dim data-[state=active]:bg-gold/20 data-[state=active]:text-gold-bright"
              >
                Control
              </TabsTrigger>
              <TabsTrigger
                value="intrebari"
                className="min-h-[44px] rounded-lg text-xs font-semibold text-champagne-dim data-[state=active]:bg-gold/20 data-[state=active]:text-gold-bright"
              >
                Intrebari
              </TabsTrigger>
              <TabsTrigger
                value="statistici"
                className="min-h-[44px] rounded-lg text-xs font-semibold text-champagne-dim data-[state=active]:bg-gold/20 data-[state=active]:text-gold-bright"
              >
                Statistici
              </TabsTrigger>
            </TabsList>

            {/* Tab content panels */}
            <TabsContent value="control" className="flex-1 p-4">
              <ControlTab {...tabProps} />
            </TabsContent>
            <TabsContent value="intrebari" className="flex-1 p-4">
              <QuestionsTab {...tabProps} />
            </TabsContent>
            <TabsContent value="statistici" className="flex-1 p-4">
              <StatsTab {...tabProps} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Sonner toaster — mounted once at the page root */}
      <Toaster />
    </>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function HostPage() {
  // Single source of truth for host auth. PasswordGate is controlled by this
  // instance (props), so a successful login flips THIS password to non-null and
  // the page swaps to the dashboard. (useHostAuth is a per-component hook — a
  // second instance inside PasswordGate would not propagate here.)
  const { password, hydrated, error, checking, login } = useHostAuth();

  // Hold rendering until the client-only sessionStorage read completes. The
  // server and the first client render both hit this branch (hydrated=false),
  // so the hydrated HTML matches — no mismatch. Neutral bg-ink avoids a flash.
  if (!hydrated) {
    return <main className="min-h-dvh bg-ink" aria-hidden="true" />;
  }

  if (password === null) {
    return <PasswordGate login={login} error={error} checking={checking} />;
  }

  return <DashboardShell password={password} />;
}
