"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrambleStep } from "@/lib/decrypt";
import { playSfx } from "@/lib/sfx";
import { menuStore } from "@/lib/menu-store";

const DEFAULT_TEXT = "UwUVERSITY";
const HOVER_TEXT = "ENROLL. GRIND. ASCEND.";

export default function HeroSection() {
  const [display, setDisplay] = useState(DEFAULT_TEXT);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);

  const stopAnim = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedAt.current = null;
  }, []);

  const runScramble = useCallback(
    (target: string) => {
      stopAnim();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        setDisplay(target);
        return;
      }
      startedAt.current = performance.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - (startedAt.current ?? 0);
        const progress = Math.min(1, elapsed / 500);
        const revealed = Math.floor(progress * target.length);
        setDisplay(scrambleStep(target, revealed));
        if (progress < 1) playSfx("tick");
        if (progress >= 1) {
          stopAnim();
          setDisplay(target);
        }
      }, 30);
    },
    [stopAnim],
  );

  useEffect(() => {
    return () => stopAnim();
  }, [stopAnim]);

  const handleEnter = () => {
    if (hovered) return;
    if (menuStore.getOpen()) return;
    setHovered(true);
    runScramble(HOVER_TEXT);
  };

  const handleLeave = () => {
    setHovered(false);
    runScramble(DEFAULT_TEXT);
  };

  return (
    <section
      aria-label="UwUversity intro"
      className="relative z-[2] flex w-full flex-1 flex-col justify-center overflow-hidden px-8 pt-20 sm:px-14 lg:px-20"
    >
      <h1
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="w-fit cursor-default font-mono text-4xl font-black uppercase leading-[0.95] tracking-tight tabular-nums sm:text-5xl lg:text-7xl"
      >
        {hovered ? (
          <>
            <span className="text-fg">{display.slice(0, display.lastIndexOf(" "))}</span>{" "}
            <span className="text-fg-dim">{display.slice(display.lastIndexOf(" ") + 1)}</span>
          </>
        ) : (
          <span className="text-fg">{display}</span>
        )}
      </h1>
      <p className="mt-4 max-w-xl text-sm text-fg-muted">
        Non-accredited companion terminal for the professor-rs uplink — every
        roll, clip, and stray cred compounds into permanent academic record.
      </p>
    </section>
  );
}
