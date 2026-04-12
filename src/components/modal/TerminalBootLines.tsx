"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";

type TerminalBootLinesProps = {
  lines: string[];
  charMs?: number;
  linePauseMs?: number;
  onDone?: () => void;
  instant?: boolean;
};

export default function TerminalBootLines({
  lines,
  charMs = 7,
  linePauseMs = 60,
  onDone,
  instant = false,
}: TerminalBootLinesProps) {
  const [printed, setPrinted] = useState<string[]>(instant ? lines : []);
  const [current, setCurrent] = useState("");
  const lineIdx = useRef(0);
  const charIdx = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    if (instant) {
      done.current = true;
      onDone?.();
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPrinted(lines);
      setCurrent("");
      done.current = true;
      onDone?.();
      return;
    }

    done.current = false;
    lineIdx.current = 0;
    charIdx.current = 0;
    setPrinted([]);
    setCurrent("");

    let timer: number | null = null;
    const tick = () => {
      if (done.current) return;
      const li = lineIdx.current;
      if (li >= lines.length) {
        done.current = true;
        onDone?.();
        return;
      }
      const target = lines[li];
      const ci = charIdx.current;
      if (ci < target.length) {
        const nextChar = target[ci];
        setCurrent(target.slice(0, ci + 1));
        charIdx.current = ci + 1;
        if (nextChar !== " " && ci % 3 === 0) playSfx("type");
        timer = window.setTimeout(tick, charMs);
      } else {
        setPrinted((prev) => [...prev, target]);
        setCurrent("");
        lineIdx.current = li + 1;
        charIdx.current = 0;
        timer = window.setTimeout(tick, linePauseMs);
      }
    };
    timer = window.setTimeout(tick, linePauseMs);
    return () => {
      done.current = true;
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant]);

  return (
    <div className="font-mono text-sm leading-6 text-fg-muted">
      {printed.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {current && <div>{current}</div>}
    </div>
  );
}
