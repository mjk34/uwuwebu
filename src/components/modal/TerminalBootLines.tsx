"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";

type TerminalBootLinesProps = {
  lines: string[];
  /** Target end-to-end duration in ms, from first character to last. */
  totalMs?: number;
  /** Pause between lines (included in totalMs). */
  linePauseMs?: number;
  onDone?: () => void;
  instant?: boolean;
};

export default function TerminalBootLines({
  lines,
  totalMs = 350,
  linePauseMs = 5,
  onDone,
  instant = false,
}: TerminalBootLinesProps) {
  const [printed, setPrinted] = useState<string[]>(instant ? lines : []);
  const [current, setCurrent] = useState("");
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
    setPrinted([]);
    setCurrent("");

    // Precompute a fixed timeline: when each line starts/ends (ms from t=0).
    // Time spent typing is (totalMs - pauses between lines); last line has no
    // trailing pause so completion == end of last line.
    const totalChars = lines.reduce((n, l) => n + l.length, 0);
    const pauseTotal = Math.max(0, lines.length - 1) * linePauseMs;
    const typeTotal = Math.max(1, totalMs - pauseTotal);
    const msPerChar = totalChars > 0 ? typeTotal / totalChars : 0;
    const lineStart: number[] = [];
    const lineEnd: number[] = [];
    let cursor = 0;
    for (let i = 0; i < lines.length; i++) {
      lineStart.push(cursor);
      cursor += lines[i].length * msPerChar;
      lineEnd.push(cursor);
      if (i < lines.length - 1) cursor += linePauseMs;
    }
    const totalDur = cursor;

    // Flatten char lookup for SFX decisions (every 3rd non-space char).
    const flat: string[] = [];
    for (const l of lines) for (const c of l) flat.push(c);

    let startTs = 0;
    let raf = 0;
    let sfxCursor = 0;

    const tick = (now: number) => {
      if (done.current) return;
      if (!startTs) startTs = now;
      const elapsed = now - startTs;

      // Find the line currently being typed (or just finished) by elapsed time.
      let li = lines.length - 1;
      for (let i = 0; i < lines.length; i++) {
        if (elapsed < lineEnd[i]) { li = i; break; }
      }
      const charsInLine = elapsed < lineStart[li]
        ? 0
        : elapsed >= lineEnd[li]
          ? lines[li].length
          : Math.floor((elapsed - lineStart[li]) / msPerChar);

      setPrinted(lines.slice(0, li));
      setCurrent(lines[li].slice(0, charsInLine));

      // Fire typing SFX for each new character that appeared this frame.
      let cumChars = 0;
      for (let i = 0; i < li; i++) cumChars += lines[i].length;
      cumChars += charsInLine;
      while (sfxCursor < cumChars) {
        const ch = flat[sfxCursor];
        if (ch !== " " && sfxCursor % 3 === 0) playSfx("type");
        sfxCursor++;
      }

      if (elapsed >= totalDur) {
        setPrinted(lines);
        setCurrent("");
        done.current = true;
        onDone?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      done.current = true;
      if (raf) cancelAnimationFrame(raf);
    };
    // Omitted deps (lines, totalMs, linePauseMs, onDone) are stable constants/callbacks
    // from the only call site. Effect should only re-run when `instant` changes.
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
