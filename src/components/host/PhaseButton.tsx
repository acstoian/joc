"use client";

/**
 * PhaseButton — single phase-action button with enabled / disabled / in-flight states.
 *
 * Props:
 *   label       — Romanian button label string
 *   enabled     — whether this action is valid for the current phase
 *   inFlight    — whether THIS specific action is the currently pending one
 *   anyInFlight — whether ANY action is pending (blocks all buttons)
 *   onClick     — action handler
 *
 * In-flight state: button disabled + Loader2 spin + "..." label suffix.
 * Disabled state: opacity-40 + cursor-not-allowed.
 * Active state: bg-gold/20 text-gold-bright border border-gold/40 hover:bg-gold/30.
 *
 * Accessibility:
 *   aria-disabled — set when not enabled (screen readers announce phase reason)
 *   aria-busy     — set when this specific action is in-flight
 *
 * Animation: subtle press-confirm scale via motion/react (UI-SPEC §9, 200ms).
 * Import from "motion/react" — NEVER "framer-motion" (CLAUDE.md).
 */

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

export interface PhaseButtonProps {
  label: string;
  enabled: boolean;
  inFlight: boolean;
  anyInFlight: boolean;
  onClick: () => void;
}

export function PhaseButton({
  label,
  enabled,
  inFlight,
  anyInFlight,
  onClick,
}: PhaseButtonProps) {
  const isDisabled = !enabled || anyInFlight;

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      aria-disabled={!enabled}
      aria-busy={inFlight}
      onClick={onClick}
      // Press-confirm animation (UI-SPEC §9, 200ms) — motion/react whileTap
      // Skipped when disabled to avoid confusing visual feedback (ux: press-feedback)
      whileTap={!isDisabled ? { scale: 0.96 } : undefined}
      transition={{ duration: 0.2 }}
      className={[
        // Base sizing — primary live-event target (UI-SPEC §5.3, ux: touch-target-size)
        "w-full min-h-[56px]",
        "flex items-center justify-center gap-2",
        "rounded-xl px-4 py-3",
        "text-sm font-bold",
        "border transition-colors",
        // Focus ring — visible focus state (ux: focus-states)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        // Active/valid styling
        enabled
          ? "bg-gold/20 text-gold-bright border-gold/40 hover:bg-gold/30 cursor-pointer"
          : "bg-gold/20 text-gold-bright border-gold/40",
        // Disabled overlay (ux: state-clarity)
        isDisabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      // Respect prefers-reduced-motion (ux: reduced-motion)
      style={{ touchAction: "manipulation" }}
    >
      {inFlight && (
        <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />
      )}
      <span>
        {inFlight ? `${label}...` : label}
      </span>
    </motion.button>
  );
}
