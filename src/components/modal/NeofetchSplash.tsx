"use client";

import { useEffect } from "react";
import { KORO_ART } from "./koroArt";

type NeofetchSplashProps = {
  onDone: () => void;
  /** Skip hold + animation — used when the modal has been opened before. */
  instant?: boolean;
};

// uwuversity-themed "system info". Labels render in the accent color; values
// in fg-muted. Colorized numerics get their own token (see accentValue helper).
const INFO: Array<[label: string, value: string]> = [
  ["OS", 'uwuOS 4.7.0 "CyberSol"'],
  ["Host", "professor-rs:4875"],
  ["Kernel", "poise 0.6 + serenity 0.12"],
  ["Uptime", "42 epochs, 6 raids"],
  ["Shell", "uwush 1.3.7"],
  ["Display", "tty/auth @ 1280x720"],
  ["Terminal", "HackerModal 0.1.0"],
  ["CPU", "Discord Gateway x16 @ 2.4 GHz"],
  ["Memory", "2.4 TiB / 4.0 TiB (60%)"],
  ["Uplink", "ed25519 SHA256:xK9v...3nUw"],
  ["Provider", "discord [oauth2/full]"],
  ["Locale", "en_UWU.UTF-8"],
];

const SWATCHES = [
  "bg-fg-dim",
  "bg-danger",
  "bg-ok",
  "bg-[#ffb800]",
  "bg-accent",
  "bg-[#9b5cff]",
  "bg-accent-dim",
  "bg-fg",
];

const HOLD_MS = 800;

export default function NeofetchSplash({ onDone, instant = false }: NeofetchSplashProps) {
  useEffect(() => {
    if (instant) {
      onDone();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 300 : HOLD_MS;
    const t = window.setTimeout(onDone, hold);
    return () => window.clearTimeout(t);
  }, [onDone, instant]);

  return (
    <div
      className={`mb-3 flex flex-col gap-3 md:flex-row md:items-start md:gap-5 ${
        instant ? "" : "animate-[splash-in_420ms_ease-out]"
      }`}
    >
      <pre
        aria-hidden="true"
        className="shrink-0 whitespace-pre font-mono text-[8px] leading-[10px] text-accent"
      >
        {KORO_ART}
      </pre>
      <div className="min-w-0 flex-1 font-mono text-sm leading-[23px] text-fg-muted">
        <div>
          <span className="text-accent">operator</span>
          <span className="text-fg-dim">@</span>
          <span className="text-ok">uwuversity</span>
        </div>
        <div className="text-fg-dim">-----------------------</div>
        {INFO.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="w-[96px] shrink-0 text-accent">{label}</span>
            <span className="min-w-0 text-fg truncate">{value}</span>
          </div>
        ))}
        <div className="mt-2 flex gap-[2px]" aria-hidden="true">
          {SWATCHES.map((cls, i) => (
            <div key={i} className={`h-3.5 w-6 ${cls}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
