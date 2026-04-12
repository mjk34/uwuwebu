"use client";

import { isMuted, setMuted } from "@/lib/session";
import { useSubscribedValue } from "@/lib/client-values";

export default function MuteToggle() {
  const muted = useSubscribedValue(
    () => isMuted(),
    ["uwuversity:mute-change"],
    true,
  );

  const toggle = () => {
    setMuted(!muted);
  };

  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded border border-fg-dim/30 bg-bg-deep/70 text-fg-muted transition-colors hover:border-accent/70 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 L6 9 H2 V15 H6 L11 19 Z" fill="currentColor" stroke="none" />
        {muted ? (
          <>
            <line x1="17" y1="9" x2="22" y2="14" />
            <line x1="22" y1="9" x2="17" y2="14" />
          </>
        ) : (
          <>
            <path d="M16 8 Q19 12 16 16" />
            <path d="M19 6 Q23 12 19 18" />
          </>
        )}
      </svg>
    </button>
  );
}
