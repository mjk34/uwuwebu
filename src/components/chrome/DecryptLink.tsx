"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { scrambleStep } from "@/lib/decrypt";
import { playSfx, type SfxName } from "@/lib/sfx";

type DecryptLinkProps = {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  durationMs?: number;
  tickMs?: number;
  as?: "link" | "button";
  tickSfx?: SfxName;
};

export default function DecryptLink({
  label,
  href,
  onClick,
  className,
  durationMs = 420,
  tickMs = 28,
  as,
  tickSfx = "tick",
}: DecryptLinkProps) {
  const [display, setDisplay] = useState(label);
  const rafTimer = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);

  const stopAnim = useCallback(() => {
    if (rafTimer.current !== null) {
      window.clearInterval(rafTimer.current);
      rafTimer.current = null;
    }
    startedAt.current = null;
    setDisplay(label);
  }, [label]);

  const runAnim = useCallback(() => {
    if (typeof window === "undefined") return;
    if (rafTimer.current !== null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(label);
      return;
    }
    startedAt.current = performance.now();
    let tickCount = 0;
    rafTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - (startedAt.current ?? 0);
      const progress = Math.min(1, elapsed / durationMs);
      const revealedCount = Math.floor(progress * label.length);
      setDisplay(scrambleStep(label, revealedCount));
      if (tickCount % 2 === 0) playSfx(tickSfx);
      tickCount += 1;
      if (progress >= 1) {
        window.clearInterval(rafTimer.current!);
        rafTimer.current = null;
        setDisplay(label);
      }
    }, tickMs);
  }, [label, durationMs, tickMs, tickSfx]);

  useEffect(() => {
    return () => {
      if (rafTimer.current !== null) {
        window.clearInterval(rafTimer.current);
        rafTimer.current = null;
      }
    };
  }, []);

  const handleEnter = () => {
    runAnim();
  };

  const handleLeave = () => {
    stopAnim();
  };

  const handleClick = () => {
    onClick?.();
  };

  const common = {
    "aria-label": label,
    className,
    onMouseEnter: handleEnter,
    onFocus: handleEnter,
    onMouseLeave: handleLeave,
    onBlur: handleLeave,
    onClick: handleClick,
  } as const;

  const visible = (
    <span aria-hidden="true" className="font-mono tabular-nums">
      {display}
    </span>
  );

  const kind = as ?? (href ? "link" : "button");

  if (kind === "link" && href) {
    return (
      <Link href={href} {...common}>
        {visible}
      </Link>
    );
  }

  return (
    <button type="button" {...common}>
      {visible}
    </button>
  );
}
