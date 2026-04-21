"use client";

import { useEffect, useRef, useState } from "react";
import TerminalBootLines from "./TerminalBootLines";
import { setMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";
import { setBgMusicDimmed } from "@/components/home/BgMusic";

type HackerModalProps = {
  onClose: () => void;
};

const BOOT_LINES = [
  "$ curl -s uwuversity://uplink/handshake | jq .",
  '{ "status": "ready", "node": "professor-rs:4875" }',
  "$ ssh -i ~/.uwu/id_ed25519 oracle@uwuversity.local",
  "fingerprint: SHA256:xK9v...3nUw — accept? (y/n) y",
  "$ sudo ./enroll --provider=discord --scope=full",
  "[pid 6769] spawning auth daemon.............. ok",
  "awaiting operator >>>",
];

const CTA_TEXT = "> ./auth/discord --connect";

let hasPlayedBoot = false;

export default function HackerModal({ onClose }: HackerModalProps) {
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

    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      setBgMusicDimmed(false);
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
        <div className="flex items-center justify-between border-b border-fg-dim/30 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">
          <span>{"// tty/uwuversity/auth"}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close terminal"
            className="flex min-h-11 min-w-11 items-center justify-center text-fg-muted transition-all hover:text-accent hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)] focus-visible:text-accent focus-visible:outline-none"
          >
            [X]
          </button>
        </div>
        <div className="min-h-[360px] px-7 py-6">
          <TerminalBootLines
            lines={BOOT_LINES}
            totalMs={700}
            linePauseMs={8}
            onDone={handleDone}
            instant={hasPlayedBoot}
          />
          {bootDone && (
            <button
              ref={ctaRef}
              type="button"
              onClick={handleConnect}
              className="group mt-5 block w-full rounded-sm bg-accent/95 px-3 py-2 text-left font-mono text-base text-bg-deep transition-all hover:bg-accent hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
