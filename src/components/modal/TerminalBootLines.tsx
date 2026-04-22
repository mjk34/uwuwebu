"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx, type SfxName } from "@/lib/sfx";

/**
 * A line can be a plain string (uses defaults) or a richer spec when you need
 * to override the gap after it or run a slow-typed range inside it.
 *   - pauseAfter: ms gap before the next line starts (overrides linePauseMs)
 *   - slowFrom/slowTo/slowMult: chars in [from, to) type at slowMult× weight
 *   - sfxAfterPause: fire this sfx once at the end of pauseAfter (pre-next-line)
 *   - className: Tailwind classes applied to this line's rendered row
 *   - tailFrom/tailClassName: chars at absolute index >= tailFrom render in
 *     tailClassName (e.g. color the final "ok" of a spawn line)
 */
export type LineSpec = {
  text: string;
  pauseAfter?: number;
  slowFrom?: number;
  slowTo?: number;
  slowMult?: number;
  sfxAfterPause?: SfxName;
  className?: string;
  tailFrom?: number;
  tailClassName?: string;
};

type LineInput = string | LineSpec;

type TerminalBootLinesProps = {
  lines: LineInput[];
  /** Target end-to-end duration in ms, from first character to last. */
  totalMs?: number;
  /** Default pause between lines (used when a LineSpec doesn't set pauseAfter). */
  linePauseMs?: number;
  onDone?: () => void;
  instant?: boolean;
};

function normalize(line: LineInput): LineSpec {
  return typeof line === "string" ? { text: line } : line;
}

export default function TerminalBootLines({
  lines,
  totalMs = 350,
  linePauseMs = 5,
  onDone,
  instant = false,
}: TerminalBootLinesProps) {
  const specs = lines.map(normalize);
  const texts = specs.map(s => s.text);
  const [printed, setPrinted] = useState<string[]>(instant ? texts : []);
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
      setPrinted(texts);
      setCurrent("");
      done.current = true;
      onDone?.();
      return;
    }

    done.current = false;
    setPrinted([]);
    setCurrent("");

    // Per-character weight: slow ranges run at slowMult so they consume more
    // of the totalMs budget. Default weight is 1.
    const charWeights: number[][] = specs.map(s => {
      const w = new Array(s.text.length).fill(1);
      if (s.slowFrom != null && s.slowTo != null) {
        const mult = s.slowMult ?? 3;
        const lo = Math.max(0, s.slowFrom);
        const hi = Math.min(s.text.length, s.slowTo);
        for (let i = lo; i < hi; i++) w[i] = mult;
      }
      return w;
    });
    const totalWeight = charWeights.reduce(
      (n, line) => n + line.reduce((a, b) => a + b, 0),
      0,
    );
    const pauses = specs.map((s, i) =>
      i === specs.length - 1 ? 0 : s.pauseAfter ?? linePauseMs,
    );
    const pauseTotal = pauses.reduce((a, b) => a + b, 0);
    const typeBudget = Math.max(1, totalMs - pauseTotal);
    const msPerWeight = totalWeight > 0 ? typeBudget / totalWeight : 0;

    // Precompute per-char start times within each line and per-line bounds.
    const lineStart: number[] = [];
    const lineEnd: number[] = [];
    const charStart: number[][] = [];
    let cursor = 0;
    for (let i = 0; i < specs.length; i++) {
      lineStart.push(cursor);
      const starts: number[] = [];
      for (let c = 0; c < charWeights[i].length; c++) {
        starts.push(cursor);
        cursor += charWeights[i][c] * msPerWeight;
      }
      charStart.push(starts);
      lineEnd.push(cursor);
      cursor += pauses[i];
    }
    const totalDur = cursor;

    // Flatten char lookup for SFX decisions (every 3rd non-space char).
    // Slow-range chars are also flagged so callers can suppress SFX on them
    // (e.g. spawn-line dots — the slowdown reads as a UI beat, not typing).
    const flat: string[] = [];
    const flatSlow: boolean[] = [];
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const lo = s.slowFrom != null ? Math.max(0, s.slowFrom) : -1;
      const hi = s.slowTo != null ? Math.min(s.text.length, s.slowTo) : -1;
      for (let c = 0; c < s.text.length; c++) {
        flat.push(s.text[c]);
        flatSlow.push(c >= lo && c < hi);
      }
    }

    // Pause-end sfx triggers: fired once when elapsed crosses each threshold.
    const pauseSfx: { time: number; sfx: SfxName }[] = [];
    for (let i = 0; i < specs.length; i++) {
      if (specs[i].sfxAfterPause && pauses[i] > 0) {
        pauseSfx.push({ time: lineEnd[i] + pauses[i], sfx: specs[i].sfxAfterPause! });
      }
    }

    let startTs = 0;
    let raf = 0;
    let sfxCursor = 0;
    let pauseSfxCursor = 0;

    const tick = (now: number) => {
      if (done.current) return;
      if (!startTs) startTs = now;
      const elapsed = now - startTs;

      // Find the line currently being typed (or just finished) by elapsed time.
      let li = texts.length - 1;
      for (let i = 0; i < texts.length; i++) {
        if (elapsed < lineEnd[i]) { li = i; break; }
      }
      let charsInLine: number;
      if (elapsed < lineStart[li]) {
        charsInLine = 0;
      } else if (elapsed >= lineEnd[li]) {
        charsInLine = texts[li].length;
      } else {
        // Find the largest c whose start time has been reached.
        const starts = charStart[li];
        let lo = 0, hi = starts.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (starts[mid] <= elapsed) lo = mid + 1;
          else hi = mid;
        }
        charsInLine = lo;
      }

      setPrinted(texts.slice(0, li));
      setCurrent(texts[li].slice(0, charsInLine));

      // Fire typing SFX for each new character that appeared this frame.
      let cumChars = 0;
      for (let i = 0; i < li; i++) cumChars += texts[i].length;
      cumChars += charsInLine;
      while (sfxCursor < cumChars) {
        const ch = flat[sfxCursor];
        if (ch !== " " && !flatSlow[sfxCursor] && sfxCursor % 3 === 0) playSfx("type");
        sfxCursor++;
      }

      // Fire pause-end SFX (e.g. heavy enter-key beat before next command).
      while (pauseSfxCursor < pauseSfx.length && elapsed >= pauseSfx[pauseSfxCursor].time) {
        playSfx(pauseSfx[pauseSfxCursor].sfx);
        pauseSfxCursor++;
      }

      if (elapsed >= totalDur) {
        setPrinted(texts);
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

  const renderLine = (text: string, spec?: LineSpec) => {
    const tailFrom = spec?.tailFrom;
    const tailCls = spec?.tailClassName;
    // Split into body + tail when the visible slice has reached tailFrom.
    let body = text;
    let tail = "";
    if (tailFrom != null && tailCls && text.length > tailFrom) {
      body = text.slice(0, tailFrom);
      tail = text.slice(tailFrom);
    }
    const bodyNode = body.startsWith("$") ? (
      <>
        <span className="text-accent">$</span>
        {body.slice(1)}
      </>
    ) : body;
    return (
      <>
        {bodyNode}
        {tail && <span className={tailCls}>{tail}</span>}
      </>
    );
  };

  return (
    <div className="font-mono text-sm leading-6 text-fg-muted">
      {printed.map((line, i) => (
        <div key={i} className={specs[i]?.className}>{renderLine(line, specs[i])}</div>
      ))}
      {current && (
        <div className={specs[printed.length]?.className}>
          {renderLine(current, specs[printed.length])}
        </div>
      )}
    </div>
  );
}
