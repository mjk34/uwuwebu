"use client";

import { useEffect, useRef, useState } from "react";
import type { MockGameDemo } from "@/lib/mock";
import DemoCard from "./DemoCard";
import { useReducedMotion } from "@/lib/client-values";


type GameDemoCarouselProps = {
  demos: MockGameDemo[];
  intervalMs?: number;
};

export default function GameDemoCarousel({
  demos,
  intervalMs = 7000,
}: GameDemoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const timerRef = useRef<number | null>(null);

  const go = (next: number) => {
    const n = ((next % demos.length) + demos.length) % demos.length;
    setIndex(n);
  };
  const prev = () => go(index - 1);
  const next = () => go(index + 1);

  useEffect(() => {
    if (reduced || paused) return;
    timerRef.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % demos.length);
    }, intervalMs);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, reduced, demos.length, intervalMs]);

  if (reduced) {
    return (
      <section aria-label="Game demos" className="px-8 pb-10 sm:px-14 lg:px-20">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim">
              {"// DEMO REEL"}
            </div>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-fg">
              In rotation
            </h2>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <DemoCard key={d.id} demo={d} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Game demos"
      className="relative z-[2] px-8 pb-10 sm:px-14 lg:px-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim">
            {"// DEMO REEL"}
          </div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-fg">
            In rotation
          </h2>
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          {demos.map((d, i) => (
            <div
              key={d.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-8 bg-accent" : "w-3 bg-fg-dim/60"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous demo"
          className="absolute left-[-1rem] top-1/2 z-10 -translate-y-1/2 border border-accent/50 bg-bg-deep/80 px-2 py-3 font-mono text-lg font-bold text-accent backdrop-blur-sm transition-colors hover:bg-accent hover:text-bg-deep focus-visible:bg-accent focus-visible:text-bg-deep focus-visible:outline-none"
        >
          &lt;
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next demo"
          className="absolute right-[-1rem] top-1/2 z-10 -translate-y-1/2 border border-accent/50 bg-bg-deep/80 px-2 py-3 font-mono text-lg font-bold text-accent backdrop-blur-sm transition-colors hover:bg-accent hover:text-bg-deep focus-visible:bg-accent focus-visible:text-bg-deep focus-visible:outline-none"
        >
          &gt;
        </button>
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {demos.map((d) => (
              <div key={d.id} className="w-full shrink-0 px-1">
                <DemoCard demo={d} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
