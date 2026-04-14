"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrambleStep } from "@/lib/decrypt";
import { playSfx } from "@/lib/sfx";
import { menuStore } from "@/lib/menu-store";

const DEFAULT_TEXT = "UwUVERSITY";
const HOVER_TEXT = "ENROLL. GRIND. ASCEND.";
const GLITCH_FACES = [
  "OwO", "QwQ", "ÒwÓ", "0w0", "ówò",
];
const GLITCH_IDLE_MIN = 6000; // ms
const GLITCH_IDLE_MAX = 12000;
const GLITCH_HOLD = 1000; // ms to hold the new face

export default function HeroSection() {
  const [display, setDisplay] = useState(DEFAULT_TEXT);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const glitchRef = useRef<number | null>(null);
  const glitchPhaseRef = useRef<number | null>(null);

  const stopAnim = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedAt.current = null;
  }, []);

  const stopGlitch = useCallback(() => {
    if (glitchRef.current !== null) {
      window.clearTimeout(glitchRef.current);
      glitchRef.current = null;
    }
    if (glitchPhaseRef.current !== null) {
      window.clearInterval(glitchPhaseRef.current);
      glitchPhaseRef.current = null;
    }
  }, []);

  const runScramble = useCallback(
    (target: string, duration = 500, onDone?: () => void) => {
      stopAnim();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        setDisplay(target);
        onDone?.();
        return;
      }
      startedAt.current = performance.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - (startedAt.current ?? 0);
        const progress = Math.min(1, elapsed / duration);
        const revealed = Math.floor(progress * target.length);
        setDisplay(scrambleStep(target, revealed));
        if (progress < 1) playSfx("tick");
        if (progress >= 1) {
          stopAnim();
          setDisplay(target);
          onDone?.();
        }
      }, 30);
    },
    [stopAnim],
  );

  // Idle glitch cycle: scramble-in face → hold → scramble-out to UwU
  const scheduleGlitch = useCallback(() => {
    const delay = GLITCH_IDLE_MIN + Math.random() * (GLITCH_IDLE_MAX - GLITCH_IDLE_MIN);
    glitchRef.current = window.setTimeout(() => {
      // Pick a random face (not the current UwU prefix)
      let face: string;
      do {
        face = GLITCH_FACES[Math.floor(Math.random() * GLITCH_FACES.length)];
      } while (face === "UwU");

      const glitchedText = face + DEFAULT_TEXT.slice(3);

      // Scramble-in to the new face (only first 3 chars, fast)
      runScramble(glitchedText, 250, () => {
        // Hold for GLITCH_HOLD ms, then scramble back
        glitchRef.current = window.setTimeout(() => {
          runScramble(DEFAULT_TEXT, 250, () => {
            scheduleGlitch();
          });
        }, GLITCH_HOLD);
      });
    }, delay);
  }, [runScramble]);

  useEffect(() => {
    return () => {
      stopAnim();
      stopGlitch();
    };
  }, [stopAnim, stopGlitch]);

  // Start glitch cycle on mount
  useEffect(() => {
    if (!hovered) {
      scheduleGlitch();
    }
    return () => stopGlitch();
  }, [hovered, scheduleGlitch, stopGlitch]);

  const handleEnter = () => {
    if (hovered) return;
    if (menuStore.getOpen()) return;
    stopGlitch();
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
      className="relative z-[2] flex w-full flex-col justify-end overflow-hidden px-4 pb-4 pt-16 sm:px-14 sm:pt-20 lg:px-20"
    >
      <h1
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="w-fit cursor-default font-mono text-2xl font-black uppercase leading-[0.95] tracking-tight tabular-nums xs:text-3xl sm:text-5xl lg:text-7xl"
      >
        {hovered ? (
          <>
            <span className="text-fg">{display.slice(0, 8)}</span>
            <span className="text-accent">{display.slice(8, 15)}</span>
            <span className="text-danger">{display.slice(15)}</span>
          </>
        ) : (
          <span className="text-fg">{display}</span>
        )}
      </h1>
      <p className="mt-2 max-w-xl text-xs text-fg-muted sm:mt-4 sm:text-sm">
        Non-accredited companion terminal for the professor-rs uplink — every
        roll, clip, and stray cred compounds into permanent academic record.
      </p>
    </section>
  );
}
