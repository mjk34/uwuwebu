"use client";

import { useState, useEffect } from "react";
import { isMuted, setMuted } from "@/lib/session";
import { syncMuteState } from "@/lib/sfx";

export default function MuteToggle() {
  const [muted, setLocal] = useState(false);

  useEffect(() => {
    const stored = isMuted();
    setLocal(stored);
    syncMuteState(stored);
  }, []);

  const toggle = () => {
    const next = !muted;
    setLocal(next);
    setMuted(next);
    syncMuteState(next);
  };

  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      onClick={toggle}
      className={`flex h-8 w-8 items-center justify-center rounded border bg-bg-deep/70 transition-all focus-visible:outline-none focus-visible:ring-2 ${
        muted
          ? "border-danger/50 text-danger hover:border-danger hover:shadow-[0_0_12px_rgba(255,42,109,0.35)]"
          : "border-accent/40 text-accent hover:border-accent/70 hover:shadow-[0_0_12px_rgba(0,240,255,0.3)]"
      } focus-visible:ring-accent`}
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
            <line x1="17" y1="9" x2="22" y2="15" />
            <line x1="22" y1="9" x2="17" y2="15" />
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
