"use client";

import Link from "next/link";
import { useScramble } from "@/hooks/useScramble";
import type { SfxName } from "@/lib/sfx";

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
  const { display, scrambleTo, snapTo } = useScramble(label, {
    duration: durationMs,
    interval: tickMs,
    sfx: tickSfx,
    sfxEvery: 2,
  });

  const handleEnter = () => scrambleTo(label);
  const handleLeave = () => snapTo(label);
  const handleClick = () => onClick?.();

  const common = {
    "aria-label": label,
    className,
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
    onFocus: handleEnter,
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
