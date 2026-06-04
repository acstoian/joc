"use client";

/**
 * NameGate — full-screen join card (D-10).
 *
 * Shown when identity === null (first-time guest, no localStorage token).
 * On submit, calls POST /api/game/join with UUID device token, persists
 * identity to localStorage, and notifies parent via onJoined.
 *
 * Romanian copy per UI-SPEC §"Screen 1: NameGate" + §"Copywriting Contract".
 * Mirrors the host PasswordGate structure (card, form, inline error, spinner).
 *
 * Security (T-05-01): displayName rendered as text content only — no innerHTML.
 * Security (T-05-02): device token is crypto.randomUUID() (UUID v4, passes UUID_REGEX).
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_ID } from "@/lib/host/constants";
import { getOrCreateDeviceToken, setIdentity } from "@/lib/guest/identity";
import { cn } from "@/lib/utils";

export function NameGate({
  onJoined,
}: {
  onJoined: (id: { deviceToken: string; playerId: string }) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();

    if (!name) {
      setError("Numele nu poate fi gol.");
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const deviceToken = getOrCreateDeviceToken();
      const res = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: GAME_ID, deviceToken, displayName: name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError("Ceva nu a mers. Încearcă din nou.");
        return;
      }

      setIdentity({ deviceToken, playerId: data.playerId });
      onJoined({ deviceToken, playerId: data.playerId });
    } catch {
      setError("Ceva nu a mers. Încearcă din nou.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main
      className="min-h-dvh bg-ink flex items-center justify-center px-4"
      aria-label="Intră în joc"
    >
      <Card className="w-full max-w-[360px] border-0 shadow-2xl glass">
        <CardHeader className="pb-4 text-center gap-1">
          <h1 className="font-heading text-2xl font-bold text-champagne leading-tight">
            Joc — Cristina &amp; Andrei
          </h1>
          <p className="text-sm text-champagne-dim/70">Joc live de nuntă</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="guest-name"
                className="text-xs text-champagne-dim"
              >
                Numele tău
              </label>
              <Input
                id="guest-name"
                type="text"
                autoComplete="name"
                inputMode="text"
                placeholder="Scrie numele tău"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={checking}
                className={cn(
                  "h-12 bg-ink-light border-ink-muted text-champagne",
                  "placeholder:text-champagne-dim/50",
                  "focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
                )}
              />
            </div>

            {error && (
              <p
                role="alert"
                aria-live="polite"
                className="text-xs text-red-400"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={checking}
              aria-disabled={checking}
              className={cn(
                "w-full h-12 rounded-md bg-gold text-ink font-bold",
                "hover:bg-gold-bright active:scale-[0.97]",
                "focus-visible:ring-2 focus-visible:ring-gold/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "[touch-action:manipulation]"
              )}
            >
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se procesează...
                </>
              ) : (
                "Joacă!"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
