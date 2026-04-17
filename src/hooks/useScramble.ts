"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrambleStep } from "@/lib/decrypt";
import { playSfx, type SfxName } from "@/lib/sfx";

type UseScrambleOpts = {
  duration?: number;
  interval?: number;
  sfx?: SfxName;
  sfxEvery?: number;
  /** When false, disables the inverse length-scaling so duration is literal. */
  scaleByLength?: boolean;
};

export function useScramble(initial: string, opts: UseScrambleOpts = {}) {
  const {
    duration: defaultDuration = 240,
    interval = 18,
    sfx = "tick",
    sfxEvery = 2,
    scaleByLength = true,
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
      const baseDur = callOpts?.duration ?? defaultDuration;
      let dur: number;
      if (scaleByLength) {
        // Compress total animation into a [200, 300]ms window regardless of
        // target length: short strings get the top end, long strings floor at 200.
        const nonSpaceLen = target.replace(/\s/g, "").length;
        const scaled = baseDur * (6 / Math.max(6, nonSpaceLen));
        dur = Math.round(Math.max(200, Math.min(300, scaled)));
      } else {
        dur = baseDur;
      }
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
    [stop, defaultDuration, interval, sfx, sfxEvery, scaleByLength],
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
