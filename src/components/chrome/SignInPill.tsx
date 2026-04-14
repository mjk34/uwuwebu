"use client";

import { useCallback, useRef, useState } from "react";
import HackerModal from "@/components/modal/HackerModal";
import { hasMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";
import { scrambleStep } from "@/lib/decrypt";
import { mockCurrentUser } from "@/lib/mock";
import { useSubscribedValue } from "@/lib/client-values";

const HOVER_TEXT = "LOCK IN";
const SCRAMBLE_DURATION = 400; // ms
const SCRAMBLE_INTERVAL = 30;  // ms per tick

export default function SignInPill() {
  const [modalOpen, setModalOpen] = useState(false);
  const [display, setDisplay] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const active = useSubscribedValue(
    () => hasMockSession(),
    ["uwuversity:session-change"],
    false,
  );

  const defaultLabel = active ? mockCurrentUser.username.toUpperCase() : "SIGN IN";

  const stopAnim = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const runScramble = useCallback(
    (target: string, onDone?: () => void) => {
      stopAnim();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        setDisplay(target);
        onDone?.();
        return;
      }
      startRef.current = performance.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - (startRef.current ?? 0);
        const progress = Math.min(1, elapsed / SCRAMBLE_DURATION);
        const revealed = Math.floor(progress * target.length);
        setDisplay(scrambleStep(target, revealed));
        if (progress < 1) playSfx("tick");
        if (progress >= 1) {
          stopAnim();
          setDisplay(target);
          onDone?.();
        }
      }, SCRAMBLE_INTERVAL);
    },
    [stopAnim],
  );

  const handleEnter = () => {
    runScramble(HOVER_TEXT);
  };

  const handleLeave = () => {
    runScramble(defaultLabel, () => setDisplay(null));
  };

  const handleClick = () => {
    playSfx("click");
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="flex h-9 items-center gap-2 rounded-full border border-fg/80 bg-fg px-5 text-xs font-bold uppercase tracking-[0.2em] text-bg-deep transition-colors hover:border-accent hover:bg-accent hover:text-bg-deep hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            active ? "bg-ok" : "bg-bg-deep/60"
          }`}
        />
        <span className="relative inline-grid items-center justify-items-center">
          <span className="invisible col-start-1 row-start-1">{defaultLabel}</span>
          <span className="invisible col-start-1 row-start-1">{HOVER_TEXT}</span>
          <span className="col-start-1 row-start-1">{display ?? defaultLabel}</span>
        </span>
      </button>
      {modalOpen && (
        <HackerModal onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
