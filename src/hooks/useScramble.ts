"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrambleStep } from "@/lib/decrypt";
import { playSfx, type SfxName } from "@/lib/sfx";

type UseScrambleOpts = {
  duration?: number;
  interval?: number;
  sfx?: SfxName;
  sfxEvery?: number;
};

export function useScramble(initial: string, opts: UseScrambleOpts = {}) {
  const {
    duration: defaultDuration = 500,
    interval = 30,
    sfx = "tick",
    sfxEvery = 1,
  } = opts;

  const [display, setDisplay] = useState(initial);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const scrambleTo = useCallback(
    (target: string, callOpts?: { onDone?: () => void; duration?: number }) => {
      stop();
      const dur = callOpts?.duration ?? defaultDuration;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        setDisplay(target);
        callOpts?.onDone?.();
        return;
      }
      setDisplay(scrambleStep(target, 0));
      startRef.current = performance.now();
      let tickCount = 0;
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - (startRef.current ?? 0);
        const progress = Math.min(1, elapsed / dur);
        const revealed = Math.floor(progress * target.length);
        setDisplay(scrambleStep(target, revealed));
        if (progress < 1 && tickCount % sfxEvery === 0) playSfx(sfx);
        tickCount += 1;
        if (progress >= 1) {
          stop();
          setDisplay(target);
          callOpts?.onDone?.();
        }
      }, interval);
    },
    [stop, defaultDuration, interval, sfx, sfxEvery],
  );

  const snapTo = useCallback(
    (text: string) => {
      stop();
      setDisplay(text);
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  return { display, scrambleTo, snapTo, stop };
}
