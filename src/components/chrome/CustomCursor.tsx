"use client";

import { useEffect, useRef } from "react";

const DOT_SIZE = 6;
const RING_SIZE = 36;
const RING_BORDER = 1.5;

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

    document.documentElement.style.cursor = "none";

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

    const tick = () => {
      ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.15;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.15;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x - RING_SIZE / 2}px, ${ringPos.current.y - RING_SIZE / 2}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.style.cursor = "";
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
