"use client";

import { useEffect, useRef } from "react";
import { isMuted } from "@/lib/session";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const DEFAULT_VOLUME = 0.04;
const DIMMED_VOLUME = 0.008;

// Singleton — syncBgMusicMute reaches across from MuteToggle
let bgAudio: HTMLAudioElement | null = null;
// Ref-counted so overlapping surfaces (side menu + auth modal) don't race the restore
let dimCount = 0;

export function syncBgMusicMute(mute: boolean): void {
  if (bgAudio) bgAudio.muted = mute;
}

export function setBgMusicDimmed(dim: boolean): void {
  dimCount = Math.max(0, dimCount + (dim ? 1 : -1));
  if (bgAudio) bgAudio.volume = dimCount > 0 ? DIMMED_VOLUME : DEFAULT_VOLUME;
}

export default function BgMusic() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(`${basePath}/music/home.mp3`);
    audio.volume = dimCount > 0 ? DIMMED_VOLUME : DEFAULT_VOLUME;
    audio.muted = isMuted();
    bgAudio = audio;

    const onEnded = () => {
      timerRef.current = window.setTimeout(() => {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, 10000);
    };
    audio.addEventListener("ended", onEnded);

    // Defer playback until after a user gesture (autoplay policy).
    // Safari may reject play() if the audio hasn't buffered yet,
    // so retry on subsequent gestures until it actually starts.
    let playing = false;
    const tryPlay = () => {
      if (playing) return;
      audio.play().then(() => {
        playing = true;
        document.removeEventListener("pointerdown", tryPlay);
        document.removeEventListener("keydown", tryPlay);
      }, () => {});
    };
    document.addEventListener("pointerdown", tryPlay);
    document.addEventListener("keydown", tryPlay);

    return () => {
      document.removeEventListener("pointerdown", tryPlay);
      document.removeEventListener("keydown", tryPlay);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      bgAudio = null;
    };
  }, []);

  return null;
}
