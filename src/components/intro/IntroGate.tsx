"use client";

import { useSyncExternalStore } from "react";
import LiquefiedIntro from "./LiquefiedIntro";
import { readSession, SessionKeys, writeSession } from "@/lib/session";

const INTRO_CHANGE = "uwuversity:intro-change";

function subscribe(cb: () => void): () => void {
  window.addEventListener(INTRO_CHANGE, cb);
  return () => window.removeEventListener(INTRO_CHANGE, cb);
}
function getSnapshot(): boolean {
  return readSession(SessionKeys.introPlayed) === "1";
}
function getServerSnapshot(): boolean {
  return true; // suppress intro during SSR; client swaps in real value on hydrate
}

export default function IntroGate() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (dismissed) return null;
  return (
    <LiquefiedIntro
      onFinish={() => {
        writeSession(SessionKeys.introPlayed, "1");
        window.dispatchEvent(new Event(INTRO_CHANGE));
      }}
    />
  );
}
