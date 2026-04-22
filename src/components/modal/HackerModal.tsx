"use client";

import { useEffect, useRef, useState } from "react";
import TerminalBootLines, { type LineSpec } from "./TerminalBootLines";
import NeofetchSplash from "./NeofetchSplash";
import { setMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";
import { suppressScrambleSfx } from "@/hooks/useScramble";
import { setBgMusicDimmed } from "@/components/home/BgMusic";

type HackerModalProps = {
  onClose: () => void;
};

// Three command/response pairs + final prompt. Each command groups with its
// response (no pause between), and a 20ms beat separates the pairs. Line 6
// runs its dots at 5× weight so the spawn animation visibly slows mid-line.
const SPAWN_LINE = "[pid 6769] spawning auth daemon.............. ok";
const DOTS_FROM = SPAWN_LINE.indexOf(".");
const DOTS_TO = SPAWN_LINE.indexOf(" ok");

const FINGERPRINT_LINE = "fingerprint: SHA256:xK9v...3nUw — accept? (y/n) y";
// "Hesitation" beat: stretch the space before the final "y" to ~70ms so
// the confirmation keystroke lands with a visible pause.
const FP_GAP_FROM = FINGERPRINT_LINE.length - 2;
const FP_GAP_TO = FINGERPRINT_LINE.length - 1;

const BOOT_LINES: LineSpec[] = [
  { text: "$ curl -s uwuversity://uplink/handshake | jq .", pauseAfter: 0 },
  { text: '{ "status": "ready", "node": "professor-rs:4875" }', pauseAfter: 150, sfxAfterPause: "enter" },
  { text: "$ ssh -i ~/.uwu/id_ed25519 oracle@uwuversity.local", pauseAfter: 0 },
  { text: FINGERPRINT_LINE, slowFrom: FP_GAP_FROM, slowTo: FP_GAP_TO, slowMult: 40, pauseAfter: 150, sfxAfterPause: "enter", tailFrom: FINGERPRINT_LINE.length - 1, tailClassName: "text-accent" },
  { text: "$ sudo ./enroll --provider=discord --scope=full", pauseAfter: 0 },
  { text: SPAWN_LINE, slowFrom: DOTS_FROM, slowTo: DOTS_TO, slowMult: 14, pauseAfter: 150, tailFrom: SPAWN_LINE.length - 2, tailClassName: "text-ok" },
  { text: "awaiting operator >>>", className: "text-ok" },
];

const CTA_TEXT = "> ./auth/discord --connect";

let hasPlayedBoot = false;

export default function HackerModal({ onClose }: HackerModalProps) {
  const [splashDone, setSplashDone] = useState(hasPlayedBoot);
  const [bootDone, setBootDone] = useState(hasPlayedBoot);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hadHiddenRef = useRef(false);

  // Mark as seen once boot animation finishes (not on mount)
  // so strict-mode double-mount doesn't skip the animation
  useEffect(() => {
    if (bootDone) hasPlayedBoot = true;
  }, [bootDone]);

  // Open as modal — browser handles focus trapping, inert, and Escape
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    setBgMusicDimmed(true);
    const releaseScrambleSfx = suppressScrambleSfx();

    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      setBgMusicDimmed(false);
      releaseScrambleSfx();
      // Safety: if the modal unmounts while the pointer is still inside the
      // panel, restore the custom-cursor state we had before hover.
      const root = document.documentElement;
      root.classList.remove("cursor-system");
      if (hadHiddenRef.current) root.classList.add("cursor-hidden");
      hadHiddenRef.current = false;
    };
  }, [onClose]);

  const swapToSystemCursor = () => {
    const root = document.documentElement;
    hadHiddenRef.current = root.classList.contains("cursor-hidden");
    if (hadHiddenRef.current) root.classList.remove("cursor-hidden");
    root.classList.add("cursor-system");
  };

  const restoreCustomCursor = () => {
    const root = document.documentElement;
    root.classList.remove("cursor-system");
    if (hadHiddenRef.current) root.classList.add("cursor-hidden");
    hadHiddenRef.current = false;
  };

  useEffect(() => {
    if (!bootDone) return;
    const t = window.setTimeout(() => ctaRef.current?.focus(), 50);
    const blinkId = window.setInterval(() => {
      playSfx("cursor-blink");
    }, 1000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(blinkId);
    };
  }, [bootDone]);

  const handleDone = () => {
    setBootDone(true);
  };

  const handleConnect = () => {
    playSfx("click");
    setMockSession(true);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Discord authentication terminal"
      className="fixed inset-0 z-50 m-0 h-screen w-screen max-h-none max-w-none border-none bg-transparent p-0"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div
        onMouseEnter={swapToSystemCursor}
        onMouseLeave={restoreCustomCursor}
        className="relative w-full max-w-3xl overflow-hidden rounded-md border border-accent/40 bg-bg-deep shadow-[0_0_80px_-10px_rgba(0,240,255,0.4)]"
      >
        <div className="flex items-center justify-between border-b border-fg-dim/30 bg-bg-raised/40 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-ok animate-[status-pulse_2s_ease-in-out_infinite]"
            />
            <span className="text-ok/80">SECURE</span>
            <span className="text-fg-dim/40">│</span>
            <span>{"// tty/uwuversity/auth"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close terminal"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-accent/30 text-accent transition-colors hover:border-accent hover:bg-accent hover:text-bg-deep focus-visible:border-accent focus-visible:bg-accent focus-visible:text-bg-deep focus-visible:outline-none"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="min-h-[360px] px-7 py-6">
          <NeofetchSplash onDone={() => setSplashDone(true)} instant={hasPlayedBoot} />
          {splashDone && (
            <TerminalBootLines
              lines={BOOT_LINES}
              totalMs={3775}
              linePauseMs={10}
              onDone={handleDone}
              instant={hasPlayedBoot}
            />
          )}
          {bootDone && (
            <button
              ref={ctaRef}
              type="button"
              onClick={handleConnect}
              className="group mt-5 block w-full rounded-sm bg-accent/95 px-3 py-2 text-left font-mono text-base text-bg-deep transition-all hover:bg-accent hover:shadow-[0_0_32px_rgba(0,240,255,0.85),0_0_64px_rgba(0,240,255,0.45)] focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:shadow-[0_0_32px_rgba(0,240,255,0.85),0_0_64px_rgba(0,240,255,0.45)]"
            >
              <span>{CTA_TEXT}</span>
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-[0.85em] w-[0.5em] -translate-y-[1px] animate-[cursor-blink_1s_step-end_infinite] bg-bg-deep align-middle"
              />
            </button>
          )}
        </div>
        <div className="border-t border-fg-dim/30 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">
          {bootDone ? "press ENTER to execute" : "awaiting handshake"}
        </div>
      </div>
    </dialog>
  );
}
