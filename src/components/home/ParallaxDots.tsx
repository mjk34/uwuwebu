"use client";

import { useEffect, useRef, useState } from "react";

const LAYERS = [
  { gap: 50, radius: 0.8, opacity: 0.25, speed: 8 },
  { gap: 50, radius: 0.8, opacity: 0.4, speed: 24 },
  { gap: 50, radius: 0.8, opacity: 0.75, speed: 48 },
];

export default function ParallaxDots() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setOffset({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {LAYERS.map((layer, i) => (
        <div
          key={i}
          className="absolute inset-[-100px] will-change-transform"
          style={{
            backgroundImage: `radial-gradient(circle ${layer.radius}px, rgba(199,179,255,${layer.opacity}) 100%, transparent 100%)`,
            backgroundSize: `${layer.gap}px ${layer.gap}px`,
            transform: `translate(${offset.x * layer.speed}px, ${offset.y * layer.speed}px)`,
          }}
        />
      ))}
    </div>
  );
}
