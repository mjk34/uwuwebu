"use client";

import { useEffect, useRef, useState } from "react";
import TerminalBootLines from "./TerminalBootLines";
import { setMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Mark as seen so closing early still skips next time
  useEffect(() => {
    hasPlayedBoot = true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a, button, [tabindex="0"]',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (!bootDone) return;
    const t = window.setTimeout(() => ctaRef.current?.focus(), 50);
    // Play sound in sync with cursor blink (1s interval, sound on appear)
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Discord authentication terminal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/85 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-3xl overflow-hidden rounded-md border border-accent/40 bg-bg-deep shadow-[0_0_80px_-10px_rgba(199,179,255,0.4)]"
      >
        <div className="flex items-center justify-between border-b border-fg-dim/30 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">
          <span>{"// tty/uwuversity/auth"}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close terminal"
            className="text-fg-muted transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
          >
            [X]
          </button>
        </div>
        <div className="min-h-[360px] px-7 py-6">
          <TerminalBootLines
            lines={BOOT_LINES}
            onDone={handleDone}
            instant={hasPlayedBoot}
          />
          {bootDone && (
            <button
              ref={ctaRef}
              type="button"
              onClick={handleConnect}
              className="group mt-5 block w-full rounded-sm bg-accent/95 px-3 py-2 text-left font-mono text-base text-bg-deep transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
    </div>
  );
}
