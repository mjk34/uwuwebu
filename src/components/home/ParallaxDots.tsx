"use client";

import { useEffect, useRef, useCallback } from "react";

const RED: [number, number, number] = [255, 42, 109];
const CYAN: [number, number, number] = [0, 240, 255];

const GAP = 44;
const DOT_R = 0.8;
const WAVE_SPEED = 180;     // px/s — how fast the pulse expands
const WAVE_WIDTH = 200;     // px — width of the soft ring
const WAVE_INTERVAL = 6.0;  // seconds between pulses
const DISPLACE = 6;         // max displacement px

type Dot = { bx: number; by: number; op: number };

export default function ParallaxDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    dots: [] as Dot[],
    w: 0, h: 0,
    reduced: false,
  });
  const rafRef = useRef(0);

  const buildDots = useCallback((w: number, h: number): Dot[] => {
    const dots: Dot[] = [];
    for (let x = -GAP; x < w + GAP; x += GAP) {
      for (let y = -GAP; y < h + GAP; y += GAP) {
        dots.push({
          bx: x,
          by: y,
          op: 0.4 + Math.random() * 0.25,
        });
      }
    }
    return dots;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      s.w = window.innerWidth;
      s.h = window.innerHeight;
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      canvas.style.width = `${s.w}px`;
      canvas.style.height = `${s.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.dots = buildDots(s.w, s.h);
    };
    resize();
    window.addEventListener("resize", resize);

    // Reduced motion — static dots
    if (s.reduced) {
      for (const d of s.dots) {
        ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${d.op})`;
        ctx.fillRect(d.bx - DOT_R, d.by - DOT_R, DOT_R * 2, DOT_R * 2);
      }
      return () => window.removeEventListener("resize", resize);
    }

    const t0 = performance.now();

    const draw = () => {
      const now = performance.now();
      const elapsed = (now - t0) / 1000;
      ctx.clearRect(0, 0, s.w, s.h);

      // Pulse origin: center of viewport
      const cx = s.w / 2;
      const cy = s.h / 2;

      // Looping wave — resets every WAVE_INTERVAL
      const cycle = elapsed % WAVE_INTERVAL;
      const waveR = cycle * WAVE_SPEED;
      // Max distance a wave needs to cover (corner to center)
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      const fade = 1 - (waveR / (maxDist + WAVE_WIDTH));

      const { dots } = s;
      const len = dots.length;
      const positions = new Float32Array(len * 3); // fx, fy, brighten

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const rx = d.bx - cx;
        const ry = d.by - cy;
        const dist = Math.sqrt(rx * rx + ry * ry);
        const wfDist = Math.abs(dist - waveR);

        let ox = 0, oy = 0;
        let brighten = 0;

        if (wfDist < WAVE_WIDTH && dist > 1) {
          const intensity = (1 - wfDist / WAVE_WIDTH) * fade;
          const a = Math.atan2(ry, rx);
          ox = Math.cos(a) * intensity * DISPLACE;
          oy = Math.sin(a) * intensity * DISPLACE;
          brighten = intensity * 0.5;
        }

        const off = i * 3;
        positions[off] = d.bx + ox;
        positions[off + 1] = d.by + oy;
        positions[off + 2] = brighten;
      }

      // Pass 1: bloom glow on pulsed dots
      for (let i = 0; i < len; i++) {
        const off = i * 3;
        const brighten = positions[off + 2];
        if (brighten < 0.05) continue;
        const fx = positions[off];
        const fy = positions[off + 1];
        if (fx < -30 || fx > s.w + 30 || fy < -30 || fy > s.h + 30) continue;
        const glowR = DOT_R * (8 + brighten * 18);
        const glowOp = Math.min(0.5, brighten * 0.6);
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR);
        grad.addColorStop(0, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${glowOp})`);
        grad.addColorStop(0.35, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${glowOp * 0.35})`);
        grad.addColorStop(1, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0)`);
        ctx.beginPath();
        ctx.arc(fx, fy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Pass 2: dots — red at rest, lerp to cyan in wave
      for (let i = 0; i < len; i++) {
        const off = i * 3;
        const fx = positions[off];
        const fy = positions[off + 1];
        if (fx < -5 || fx > s.w + 5 || fy < -5 || fy > s.h + 5) continue;
        const brighten = positions[off + 2];
        const t = Math.min(1, brighten * 2);
        const cr = RED[0] + (CYAN[0] - RED[0]) * t;
        const cg = RED[1] + (CYAN[1] - RED[1]) * t;
        const cb = RED[2] + (CYAN[2] - RED[2]) * t;
        const op = Math.min(1, dots[i].op + brighten);
        ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${op})`;
        ctx.fillRect(fx - DOT_R, fy - DOT_R, DOT_R * 2, DOT_R * 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [buildDots]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}
