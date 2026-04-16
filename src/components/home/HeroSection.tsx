"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScramble } from "@/hooks/useScramble";
import { menuStore } from "@/lib/menu-store";

const DEFAULT_TEXT = "UwUVERSITY";
const HOVER_TEXT = "ENROLL. GRIND. ASCEND.";
const HOVER_PARTS = [
  { text: "ENROLL. ", className: "text-fg" },
  { text: "GRIND. ", className: "text-accent" },
  { text: "ASCEND.", className: "text-danger" },
] as const;
const GLITCH_FACES = [
  "OwO", "QwQ", "ÒwÓ", "0w0", "ówò",
];
const GLITCH_IDLE_MIN = 6000;
const GLITCH_IDLE_MAX = 12000;
const GLITCH_HOLD = 1000;

export default function HeroSection() {
  const { display, scrambleTo, stop: stopScramble } = useScramble(DEFAULT_TEXT);
  const [hovered, setHovered] = useState(false);
  const glitchRef = useRef<number | null>(null);
  const glitchPhaseRef = useRef<number | null>(null);
  const scheduleGlitchRef = useRef<(() => void) | null>(null);

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

  const scheduleGlitch = useCallback(() => {
    const delay = GLITCH_IDLE_MIN + Math.random() * (GLITCH_IDLE_MAX - GLITCH_IDLE_MIN);
    glitchRef.current = window.setTimeout(() => {
      let face: string;
      do {
        face = GLITCH_FACES[Math.floor(Math.random() * GLITCH_FACES.length)];
      } while (face === "UwU");

      const glitchedText = face + DEFAULT_TEXT.slice(3);

      scrambleTo(glitchedText, {
        duration: 250,
        onDone: () => {
          glitchRef.current = window.setTimeout(() => {
            scrambleTo(DEFAULT_TEXT, {
              duration: 250,
              onDone: () => scheduleGlitchRef.current?.(),
            });
          }, GLITCH_HOLD);
        },
      });
    }, delay);
  }, [scrambleTo]);

  useEffect(() => {
    scheduleGlitchRef.current = scheduleGlitch;
  }, [scheduleGlitch]);

  useEffect(() => {
    return () => {
      stopScramble();
      stopGlitch();
    };
  }, [stopScramble, stopGlitch]);

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
    scrambleTo(HOVER_TEXT);
  };

  const handleLeave = () => {
    setHovered(false);
    scrambleTo(DEFAULT_TEXT);
  };

  return (
    <section
      aria-label="UwUversity intro"
      className="relative z-[2] flex w-full flex-col justify-end overflow-hidden px-4 pb-4 pt-16 sm:px-14 sm:pt-20 lg:px-20"
    >
      <h1
        tabIndex={0}
        aria-label={HOVER_TEXT}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className="w-fit cursor-default font-mono text-2xl font-black uppercase leading-[0.95] tracking-tight tabular-nums outline-none xs:text-3xl sm:text-5xl lg:text-7xl"
      >
        {hovered ? (
          <>
            {(() => {
              let pos = 0;
              return HOVER_PARTS.map((seg) => {
                const start = pos;
                pos += seg.text.length;
                return (
                  <span key={seg.className} className={seg.className}>
                    {display.slice(start, pos)}
                  </span>
                );
              });
            })()}
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
