"use client";

import { useEffect, useRef, useState } from "react";

type LiquefiedIntroProps = {
  onFinish: () => void;
};

type Phase = "load" | "reveal" | "hold" | "glitch" | "fade" | "done";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#@$%&";

const FILLER = "______________";
const TEMPLATE = `${FILLER}U W U${FILLER}`;
const ROW_LEN = TEMPLATE.length;
const UWU_INDICES = new Set<number>();
for (let i = 0; i < TEMPLATE.length; i++) {
  if (TEMPLATE[i] === "U" || TEMPLATE[i] === "W") UWU_INDICES.add(i);
}

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

const OPACITIES = [0.2, 0.5, 0.8] as const;
function randomOpacity(): number {
  return OPACITIES[Math.floor(Math.random() * 3)];
}

function makeBlankChars(): string[] {
  return Array.from({ length: ROW_LEN }, () => " ");
}
function makeBlankOpacities(): number[] {
  return Array.from({ length: ROW_LEN }, () => 0.15);
}

type GlitchFrame = {
  offsetX: number;
  skewX: number;
  scaleX: number;
  whiteOn: boolean;
  splitPx: number;
  clipTop: number;
  clipBottom: number;
};

function randomGlitchFrame(intensity: number): GlitchFrame {
  const jitter = intensity * 20;
  // White flickers off more as intensity grows — that's when the split is visible
  const whiteOn = Math.random() > intensity * 0.4;
  // Split distance grows with intensity; bigger when white is off
  const baseSplit = intensity * 12;
  const splitPx = whiteOn ? baseSplit * 0.3 : baseSplit + Math.random() * 8;
  return {
    offsetX: (Math.random() - 0.5) * jitter,
    skewX: (Math.random() - 0.5) * intensity * 8,
    scaleX: 1 + (Math.random() - 0.5) * intensity * 0.15,
    whiteOn,
    splitPx,
    clipTop: Math.random() * 40,
    clipBottom: 60 + Math.random() * 40,
  };
}

export default function LiquefiedIntro({ onFinish }: LiquefiedIntroProps) {
  const [phase, setPhase] = useState<Phase>("load");
  const [loadPct, setLoadPct] = useState(0);

  // Stash onFinish so effects don't restart if parent re-renders with a new
  // inline callback (would tear down the wave interval mid-reveal).
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Middle row (resolves to UWU)
  const [midChars, setMidChars] = useState<string[]>(makeBlankChars);
  const [midOpacities, setMidOpacities] = useState<number[]>(makeBlankOpacities);

  // Top row (decorative — clears fully)
  const [topChars, setTopChars] = useState<string[]>(makeBlankChars);
  const [topOpacities, setTopOpacities] = useState<number[]>(makeBlankOpacities);

  // Bottom row (decorative — clears fully)
  const [botChars, setBotChars] = useState<string[]>(makeBlankChars);
  const [botOpacities, setBotOpacities] = useState<number[]>(makeBlankOpacities);

  const [wavePos, setWavePos] = useState(-1);
  const [glitch, setGlitch] = useState<GlitchFrame | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const finished = useRef(false);

  // Scramble all rows during load — density ramps up over time
  useEffect(() => {
    if (phase !== "load") return;
    const startTime = performance.now();
    const loadDuration = 245; // ms — matches timeout below

    const id = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      // density: 0.03 → 0.95 over the load duration
      const density = Math.min(0.95, 0.03 + (elapsed / loadDuration) * 0.92);

      const scrambleRow = (prev: string[]) =>
        prev.map((_, i) => {
          if (TEMPLATE[i] === " " && !UWU_INDICES.has(i)) return " ";
          return Math.random() < density ? randomGlyph() : " ";
        });
      const scrambleOp = (prev: number[]) => prev.map(() => randomOpacity());

      setMidChars(scrambleRow);
      setMidOpacities(scrambleOp);
      setTopChars(scrambleRow);
      setTopOpacities(scrambleOp);
      setBotChars(scrambleRow);
      setBotOpacities(scrambleOp);

      // Loading bar during load phase: 0 → 20%
      const barPct = Math.min(20, Math.round((elapsed / loadDuration) * 20));
      setLoadPct(barPct);
    }, 40);
    return () => window.clearInterval(id);
  }, [phase]);

  // Loading phase — scramble for a beat then start wave
  useEffect(() => {
    if (phase !== "load") return;
    const id = window.setTimeout(() => setPhase("reveal"), 245);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Reveal wave — synced with loading bar
  useEffect(() => {
    if (phase !== "reveal") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      finished.current = true;
      onFinishRef.current();
      return;
    }

    let pos = 0;
    const totalLen = ROW_LEN;
    const tickMs = 10;

    const scrambleId = window.setInterval(() => {
      // Middle row — UWU stays after wave
      setMidChars((prev) =>
        prev.map((_, i) => {
          if (i < pos - 8) {
            if (UWU_INDICES.has(i)) return TEMPLATE[i];
            return " ";
          }
          if (TEMPLATE[i] === " " && !UWU_INDICES.has(i)) return " ";
          return randomGlyph();
        }),
      );
      setMidOpacities((prev) =>
        prev.map((o, i) => {
          if (i < pos - 8) return o;
          return randomOpacity();
        }),
      );

      // Top row — everything clears after wave
      setTopChars((prev) =>
        prev.map((_, i) => {
          if (i < pos - 8) return " ";
          if (TEMPLATE[i] === " " && !UWU_INDICES.has(i)) return " ";
          return randomGlyph();
        }),
      );
      setTopOpacities((prev) =>
        prev.map((o, i) => {
          if (i < pos - 8) return o;
          return randomOpacity();
        }),
      );

      // Bottom row — everything clears after wave
      setBotChars((prev) =>
        prev.map((_, i) => {
          if (i < pos - 8) return " ";
          if (TEMPLATE[i] === " " && !UWU_INDICES.has(i)) return " ";
          return randomGlyph();
        }),
      );
      setBotOpacities((prev) =>
        prev.map((o, i) => {
          if (i < pos - 8) return o;
          return randomOpacity();
        }),
      );
    }, 35);

    const waveId = window.setInterval(() => {
      pos += 1;
      setWavePos(pos);
      const pct = Math.min(100, 20 + Math.round((pos / (totalLen + 4)) * 80));
      setLoadPct(pct);
      if (pos > totalLen + 4) {
        window.clearInterval(waveId);
        window.clearInterval(scrambleId);
        // Middle — only UWU remains
        setMidChars(
          Array.from(TEMPLATE, (_, i) =>
            UWU_INDICES.has(i) ? TEMPLATE[i] : " ",
          ),
        );
        // Top & bottom — fully clear
        setTopChars(makeBlankChars());
        setBotChars(makeBlankChars());
        setLoadPct(100);
        setPhase("hold");
      }
    }, tickMs);

    return () => {
      window.clearInterval(scrambleId);
      window.clearInterval(waveId);
    };
  }, [phase]);

  // Hold briefly, then glitch — stop decrypt sound
  useEffect(() => {
    if (phase !== "hold") return;
    const id = window.setTimeout(() => setPhase("glitch"), 0);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Glitch phase — UWU jitters with RGB split, then fade
  useEffect(() => {
    if (phase !== "glitch") return;
    const start = performance.now();
    const glitchDuration = 600;

    const id = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / glitchDuration);
      // Intensity ramps up then peaks
      const intensity = Math.min(1, progress * 1.5);
      setGlitch(randomGlitchFrame(intensity));

      if (progress >= 1) {
        window.clearInterval(id);
        setPhase("fade");
      }
    }, 40);

    return () => window.clearInterval(id);
  }, [phase]);

  // Fade phase — smooth opacity transition out
  useEffect(() => {
    if (phase !== "fade") return;
    // Trigger CSS fade
    const rafId = requestAnimationFrame(() => setFadeOut(true));
    const id = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      setPhase("done");
      onFinishRef.current();
    }, 500);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(id);
    };
  }, [phase]);

  const skip = () => {
    if (finished.current) return;
    finished.current = true;
    setPhase("done");
    onFinishRef.current();
  };

  if (phase === "done") return null;

  const isLoad = phase === "load";
  const isGlitch = phase === "glitch" || phase === "fade";

  /** Render a single row of scramble chars */
  const renderRow = (
    chars: string[],
    opacities: number[],
    hasUwu: boolean,
  ) =>
    chars.map((ch, i) => {
      const isUwu = hasUwu && UWU_INDICES.has(i);
      const dist = isLoad ? 999 : i - wavePos;

      // Fully resolved
      if (dist < -8) {
        if (isUwu) return <span key={i} className="text-accent">{ch}</span>;
        return <span key={i} className="text-transparent">{ch}</span>;
      }
      // Trail — UWU fading in (middle row only)
      if (dist < 0 && isUwu) {
        const o = Math.min(1, 0.3 + ((-dist / 8) * 0.7));
        return <span key={i} style={{ color: `rgba(0,240,255,${o})` }}>{ch}</span>;
      }
      // Everything else — use pre-computed random opacity
      return <span key={i} style={{ color: `rgba(0,240,255,${opacities[i]})` }}>{ch}</span>;
    });

  const glitchStyle: React.CSSProperties = isGlitch && glitch
    ? {
        transform: `translate(${glitch.offsetX}px, 0px) skewX(${glitch.skewX}deg) scaleX(${glitch.scaleX})`,
        opacity: glitch.whiteOn ? 1 : 0,
        clipPath: `inset(${glitch.clipTop}% 0 ${100 - glitch.clipBottom}% 0)`,
      }
    : {};

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-black transition-opacity duration-500 ease-out outline-none ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* 3-row scramble block */}
      <div className="relative flex flex-col items-center gap-0">
        {/* RGB split layers — cyan left, red right; visible during glitch */}
        {isGlitch && glitch && (
          <>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center mix-blend-screen"
              aria-hidden="true"
              style={{
                transform: `translateX(${-glitch.splitPx}px)`,
                opacity: 0.6,
              }}
            >
              <pre className="select-none font-mono text-4xl font-black tracking-[0.2em] text-accent sm:text-5xl md:text-6xl lg:text-7xl">
                {"     U W U     "}
              </pre>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center mix-blend-screen"
              aria-hidden="true"
              style={{
                transform: `translateX(${glitch.splitPx}px)`,
                opacity: 0.6,
              }}
            >
              <pre className="select-none font-mono text-4xl font-black tracking-[0.2em] text-danger sm:text-5xl md:text-6xl lg:text-7xl">
                {"     U W U     "}
              </pre>
            </div>
          </>
        )}

        <pre
          className="select-none font-mono text-3xl font-black tracking-[0.2em] sm:text-4xl md:text-5xl lg:text-6xl"
          aria-hidden="true"
        >
          {renderRow(topChars, topOpacities, false)}
        </pre>
        <pre
          className="select-none font-mono text-4xl font-black tracking-[0.2em] sm:text-5xl md:text-6xl lg:text-7xl"
          aria-label="UwUversity"
          style={glitchStyle}
        >
          {renderRow(midChars, midOpacities, true)}
        </pre>
        <pre
          className="select-none font-mono text-3xl font-black tracking-[0.2em] sm:text-4xl md:text-5xl lg:text-6xl"
          aria-hidden="true"
        >
          {renderRow(botChars, botOpacities, false)}
        </pre>
      </div>

      {/* Loading bar — bottom (hidden during glitch/fade) */}
      <div
        className={`absolute bottom-12 left-1/2 flex w-[60vw] max-w-md -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-300 ${
          isGlitch ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          className="h-px w-full bg-accent/20"
          role="progressbar"
          aria-valuenow={loadPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading"
        >
          <div
            className="h-full bg-accent/60 transition-all duration-150 ease-out"
            style={{ width: `${loadPct}%` }}
          />
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim">
            {`>> LOADING — ${loadPct}%`}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim/50">
            UWUVERSITY://UPLINK/INIT
          </span>
        </div>
      </div>
    </div>
  );
}
