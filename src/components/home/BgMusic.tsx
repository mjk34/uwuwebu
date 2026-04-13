"use client";

import { useEffect, useRef } from "react";
import { startBgMusic } from "@/lib/sfx";

export default function BgMusic() {
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Start music after intro finishes (~3s) so the first user click
    // has already unlocked AudioContext via the intro overlay
    const id = window.setTimeout(() => {
      stopRef.current = startBgMusic();
    }, 3500);

    return () => {
      window.clearTimeout(id);
      stopRef.current?.();
    };
  }, []);

  return null;
}
