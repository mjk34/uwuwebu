"use client";

import { useEffect, useRef } from "react";
import { isMuted } from "@/lib/session";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Expose audio element so mute toggle can reach it directly
let bgAudio: HTMLAudioElement | null = null;

export function syncBgMusicMute(mute: boolean): void {
  if (bgAudio) bgAudio.muted = mute;
}

export default function BgMusic() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(`${basePath}/music/home.mp3`);
    audio.volume = 0.04;
    audio.muted = isMuted();
    bgAudio = audio;

    const onEnded = () => {
      timerRef.current = window.setTimeout(() => {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, 10000);
    };
    audio.addEventListener("ended", onEnded);

    const startId = window.setTimeout(() => {
      audio.play().catch(() => {});
    }, 3500);

    return () => {
      window.clearTimeout(startId);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
      bgAudio = null;
    };
  }, []);

  return null;
}
