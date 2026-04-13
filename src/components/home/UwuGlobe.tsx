"use client";

import { useEffect, useRef } from "react";
import { GLOBE_DATA } from "@/lib/globe-data";

const BODY_COLOR: [number, number, number] = [250, 220, 120];
const FACE_COLOR: [number, number, number] = [20, 255, 200];
const FACE_GLOW: [number, number, number] = [20, 255, 180];
const CHEEK_COLOR: [number, number, number] = [255, 120, 180];
const FONT = "var(--font-geist-mono), 'SF Mono', 'Fira Code', 'Courier New', monospace";

const DEF_RX = -0.1;
const DEF_VY = 0.00096;
const REPULSE_ANGLE = 0.25;   // radians — outer reach of influence
const REPULSE_FORCE = 2.5;
const RING_CENTER = 0.1;      // radians — where the ring peaks
const RING_WIDTH = 0.05;      // radians — ring falloff width
const DRIFT_AMOUNT = 0.00008;
const SPRING_BACK = 0.015;
const MAX_DISPLACEMENT = 0.15;
const GLOBE_SCALE = 1;         // globe render scale
const SPIN_DELAY = 1;         // seconds before auto-rotation starts

const BODY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789@#%&*+-~";
const FACE_CHARS = ["U", "W", "#", "@", "%"];
const CHEEK_CHARS = ["o", "O", "*", "@"];

type Particle = {
  bx: number; by: number; bz: number;
  dx: number; dy: number; dz: number;
  vx: number; vy: number; vz: number;
  tp: number; ch: string;
  pulse: number; pulseSpeed: number;
};

function buildParticles(): Particle[] {
  return GLOBE_DATA.map((d) => {
    const tp = d[3];
    let ch: string;
    if (tp === 1) ch = FACE_CHARS[(Math.random() * FACE_CHARS.length) | 0];
    else if (tp === 2) ch = CHEEK_CHARS[(Math.random() * CHEEK_CHARS.length) | 0];
    else ch = BODY_CHARS[(Math.random() * BODY_CHARS.length) | 0];
    return {
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp, ch,
      pulse: Math.random() * 6.28,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    };
  });
}

export default function UwuGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const cv = canvasRef.current;
    if (!container || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const particles = buildParticles();
    const startTime = performance.now();

    let W = 0, H = 0;
    let rotY = 0, rotX = DEF_RX, autoRotY = Math.PI - (20 * Math.PI / 180);
    let dragging = false, lastX = 0, lastY = 0;
    let spinVelocity = DEF_VY;
    let mouseX = -9000, mouseY = -9000, mouseActive = false;

    const resize = () => {
      const r = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      W = r.width;
      H = r.height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rotate3D = (x: number, y: number, z: number): [number, number, number] => {
      const cy = Math.cos(rotY + autoRotY), sy = Math.sin(rotY + autoRotY);
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
      return [x1, y1, z2];
    };

    // Inverse rotation — camera space back to world space
    const unrotate3D = (x1: number, y1: number, z2: number): [number, number, number] => {
      const cy = Math.cos(rotY + autoRotY), sy = Math.sin(rotY + autoRotY);
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      const y = y1 * cx + z2 * sx;
      const z1 = -y1 * sx + z2 * cx;
      const x = x1 * cy + z1 * sy;
      const z = -x1 * sy + z1 * cy;
      return [x, y, z];
    };

    const project = (x: number, y: number, z: number): [number, number, number, number] => {
      const base = Math.min(W, H, 800);
      const fov = 2.4;
      const scale = base * 0.38 * fov / (fov + z);
      return [W / 2 + x * scale, H / 2 + y * scale, z, scale];
    };

    const frame = () => {
      const t = performance.now() / 1000;
      const elapsed = (performance.now() - startTime) / 1000;

      if (!dragging) {
        // Wait SPIN_DELAY seconds before starting auto-rotation
        if (elapsed > SPIN_DELAY) {
          autoRotY += spinVelocity;
        }
        rotX += (DEF_RX - rotX) * 0.035;
      }

      ctx.clearRect(0, 0, W, H);
      const projected: { i: number; sx: number; sy: number; sz: number; sc: number }[] = [];

      // Unproject mouse onto sphere surface, then to world space
      const base = Math.min(W, H, 800);
      const approxScale = base * 0.38;
      const mx3d = (mouseX - W / 2) / approxScale;
      const my3d = (mouseY - H / 2) / approxScale;
      const mr2 = mx3d * mx3d + my3d * my3d;
      const mouseOnSphere = mouseActive && mr2 < 1;
      let mwx = 0, mwy = 0, mwz = 0;
      if (mouseOnSphere) {
        const mz3d = -Math.sqrt(1 - mr2);
        [mwx, mwy, mwz] = unrotate3D(mx3d, my3d, mz3d);
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pulse += p.pulseSpeed;

        p.vx += Math.sin(t * 0.7 + p.bx * 5) * DRIFT_AMOUNT;
        p.vy += Math.cos(t * 0.9 + p.by * 5) * DRIFT_AMOUNT;
        p.vz += Math.sin(t * 1.1 + p.bz * 5) * DRIFT_AMOUNT;

        p.vx -= p.dx * SPRING_BACK;
        p.vy -= p.dy * SPRING_BACK;
        p.vz -= p.dz * SPRING_BACK;

        p.vx *= 0.94; p.vy *= 0.94; p.vz *= 0.94;
        p.dx += p.vx; p.dy += p.vy; p.dz += p.vz;

        const dm = Math.sqrt(p.dx * p.dx + p.dy * p.dy + p.dz * p.dz);
        if (dm > MAX_DISPLACEMENT) {
          const s = MAX_DISPLACEMENT / dm;
          p.dx *= s; p.dy *= s; p.dz *= s;
        }

        const [rx, ry, rz] = rotate3D(p.bx + p.dx, p.by + p.dy, p.bz + p.dz);
        const [sx, sy, sz, sc] = project(rx, ry, rz);

        // 3D sphere-mapped repulsion — front-facing only
        if (mouseOnSphere && rz < 0) {
          const dot = p.bx * mwx + p.by * mwy + p.bz * mwz;
          const angDist = Math.acos(Math.max(-1, Math.min(1, dot)));
          if (angDist < REPULSE_ANGLE) {
            const ringOff = (angDist - RING_CENTER) / RING_WIDTH;
            const ring = Math.exp(-ringOff * ringOff);
            const variation = 0.6 + 0.4 * Math.sin(p.pulse * 3.7 + p.bx * 11);
            const force = ring * variation * REPULSE_FORCE;
            const dx = p.bx - mwx, dy = p.by - mwy, dz = p.bz - mwz;
            const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            p.vx += (dx / dl) * force * 0.012;
            p.vy += (dy / dl) * force * 0.012;
            p.vz += (dz / dl) * force * 0.012;
          }
        }

        projected.push({ i, sx, sy, sz, sc });
      }

      projected.sort((a, b) => a.sz - b.sz);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const pr of projected) {
        const p = particles[pr.i];
        const facing = Math.max(0, (-pr.sz + 0.8) * 1.8);
        if (facing < 0.02) continue;

        const glow = 0.3 + Math.sin(p.pulse) * 0.1;
        const fs = Math.max(7, Math.min(18, pr.sc * 0.09));

        if (p.tp === 1) {
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${FACE_GLOW[0]},${FACE_GLOW[1]},${FACE_GLOW[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${FACE_COLOR[0]},${FACE_COLOR[1]},${FACE_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.tp === 2) {
          const al = Math.min(facing, 1) * (glow + 0.6);
          ctx.font = `bold ${(fs * 1.2).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${CHEEK_COLOR[0]},${CHEEK_COLOR[1]},${CHEEK_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else {
          const al = Math.min(facing, 1) * (glow + 0.35);
          ctx.font = `${fs.toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${BODY_COLOR[0]},${BODY_COLOR[1]},${BODY_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    // Input handlers
    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      mouseX = e.clientX - r.left;
      mouseY = e.clientY - r.top;
      mouseActive = mouseX >= 0 && mouseX <= r.width && mouseY >= 0 && mouseY <= r.height;

      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      lastX = e.clientX;
      lastY = e.clientY;
      spinVelocity = dx * 0.0004;
    };

    const onMouseUp = () => { dragging = false; };
    const onMouseLeave = () => { mouseActive = false; };

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        const r = container.getBoundingClientRect();
        mouseX = e.touches[0].clientX - r.left;
        mouseY = e.touches[0].clientY - r.top;
        mouseActive = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const r = container.getBoundingClientRect();
      mouseX = e.touches[0].clientX - r.left;
      mouseY = e.touches[0].clientY - r.top;
      mouseActive = true;
      if (dragging) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        rotY += dx * 0.005;
        rotX += dy * 0.005;
        rotX = Math.max(-1.2, Math.min(1.2, rotX));
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        spinVelocity = dx * 0.0004;
      }
      e.preventDefault();
    };

    const onTouchEnd = () => { dragging = false; mouseActive = false; };

    resize();
    window.addEventListener("resize", resize);
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("touchstart", onTouchStart);
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[1] flex items-center justify-center"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
