"use client";

import { useEffect, useRef } from "react";

const DOT_SIZE = 6;
const RING_SIZE = 36;
const RING_BORDER = 1.5;
/** Per-frame lerp at 60 fps — higher = snappier ring follow */
const RING_EASE = 0.22;

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafRef = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (isTouchDevice) return;

    document.documentElement.classList.add("cursor-hidden");

    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (!visibleRef.current) {
        visibleRef.current = true;
        if (dotRef.current) dotRef.current.style.opacity = "1";
        if (ringRef.current) ringRef.current.style.opacity = "1";
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - DOT_SIZE / 2}px, ${e.clientY - DOT_SIZE / 2}px)`;
      }
    };

    const onLeave = () => {
      visibleRef.current = false;
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };

    let prevT = 0;
    const tick = (t: number) => {
      const dt = prevT ? (t - prevT) / 1000 : 1 / 60;
      prevT = t;

      // Frame-rate-independent exponential ease: at 60fps ease≈RING_EASE,
      // at lower fps the factor grows so the ring doesn't fall behind.
      const ease = 1 - Math.pow(1 - RING_EASE, dt * 60);
      ringPos.current.x += (pos.current.x - ringPos.current.x) * ease;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * ease;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x - RING_SIZE / 2}px, ${ringPos.current.y - RING_SIZE / 2}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("cursor-hidden");
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          backgroundColor: "#fff",
        }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: "50%",
          border: `${RING_BORDER}px solid rgba(0, 240, 255, 0.5)`,
        }}
      />
    </>
  );
}
