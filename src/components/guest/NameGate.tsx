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
import { motion } from "motion/react";
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
      <motion.div
        className="w-full max-w-[360px]"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Card className="w-full border-0 shadow-[0_0_60px_0_rgba(212,168,67,0.1)] glass">
          <CardHeader className="pb-4 text-center gap-2">
            <h1 className="font-heading text-3xl font-bold text-gradient-gold leading-tight">
              Joc
            </h1>
            <p className="text-sm text-champagne-dim/80 font-body">
              Cristina &amp; Andrei · 26.09.2026
            </p>
            <p className="text-xs text-champagne-dim/50">Joc live de nuntă</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="guest-name"
                  className="text-xs text-champagne-dim font-medium"
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
                    "placeholder:text-champagne-dim/40",
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
                  "w-full h-12 rounded-md bg-gold text-ink font-bold text-base",
                  "hover:bg-gold-bright active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-gold/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "[touch-action:manipulation]"
                )}
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Se procesează...
                  </>
                ) : (
                  "Joacă!"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
