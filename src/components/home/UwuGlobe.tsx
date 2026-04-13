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

// --- Star field ---
const STAR_COUNT = 50;
const STAR_CHARS = [".", "·", "*", "✦"];
const SPARKLE_SEQ = [".", "·", "*", "✦", "*", "·", "."];
const SPARKLE_DURATION = 1.2; // seconds
const SPARKLE_STEP = SPARKLE_DURATION / SPARKLE_SEQ.length;
const SPARKLE_COOLDOWN_MIN = 1.0;
const SPARKLE_COOLDOWN_MAX = 3.0;
const SPARKLE_INTERVAL_MIN = 0.8;
const SPARKLE_INTERVAL_MAX = 1.5;
const STAR_DRIFT_AMP = 4;   // px
const STAR_DRIFT_FREQ = 0.4; // Hz
const STAR_PARALLAX = 0.2;
const STAR_SPRING = 0.015;
const STAR_DAMPING = 0.94;
const STAR_MAX_DISP = 20;
const STAR_EXCLUSION = 1.3;  // × globe radius
const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [199, 179, 255],
];

// --- Orbital rings ---
const ORBIT_CHARS = ["UwU", "OwO", ">w<", "^w^", ":3", "@", "#", "$"];
const RING_CONFIGS = [
  { rx: 1.15, ry: 0.28, tilt: -15 * Math.PI / 180, speed: 0.00096 * 1.8, count: 3, color: [20, 255, 200] as [number, number, number] },
  { rx: 1.45, ry: 0.32, tilt: -30 * Math.PI / 180, speed: 0.00096 * 1.3, count: 2, color: [255, 120, 180] as [number, number, number] },
];
const ORBIT_CAPTURE_DIST = 80;
const ORBIT_RELEASE_DIST = 120;
const ORBIT_MOUSE_SPEED = 4; // rad/s
const ORBIT_CAPTURE_DECAY_TARGET = 30;
const ORBIT_FLING_THRESHOLD = 8; // px/frame
const ORBIT_FLING_DRAG = 0.98;
const ORBIT_OFFSCREEN_MARGIN = 50;

type Star = {
  bx: number; by: number;
  dx: number; dy: number;
  vx: number; vy: number;
  phaseX: number; phaseY: number;
  ch: string;
  baseCh: string;
  fontSize: number;
  color: [number, number, number];
  baseAlpha: number;
  alpha: number;
  sparkleTime: number;
  cooldown: number;
};

type Orbiter = {
  ringIndex: number;
  theta: number;
  char: string;
  state: "orbiting" | "captured" | "flung";
  dx: number; dy: number;
  vx: number; vy: number;
  captureAngle: number;
  captureRadius: number;
  flungVx: number; flungVy: number;
  screenX: number; screenY: number;
};

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

function buildStars(W: number, H: number, globeRadius: number): Star[] {
  const stars: Star[] = [];
  const cx = W / 2;
  const cy = H / 2;
  const exclusion = globeRadius * STAR_EXCLUSION;

  for (let i = 0; i < STAR_COUNT; i++) {
    let x: number, y: number;
    do {
      x = Math.random() * W;
      y = Math.random() * H;
    } while (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < exclusion);

    const color = STAR_COLORS[Math.random() < 0.5 ? 0 : 1];
    const baseCh = STAR_CHARS[(Math.random() * STAR_CHARS.length) | 0];

    stars.push({
      bx: x, by: y,
      dx: 0, dy: 0,
      vx: 0, vy: 0,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      ch: baseCh,
      baseCh,
      fontSize: 8 + Math.random() * 4,
      color,
      baseAlpha: 0.2 + Math.random() * 0.3,
      alpha: 0.2 + Math.random() * 0.3,
      sparkleTime: -1,
      cooldown: Math.random() * 3,
    });
  }
  return stars;
}

function buildOrbiters(): Orbiter[] {
  const orbiters: Orbiter[] = [];
  for (let r = 0; r < RING_CONFIGS.length; r++) {
    const ring = RING_CONFIGS[r];
    const usedChars: string[] = [];
    for (let i = 0; i < ring.count; i++) {
      let ch: string;
      do {
        ch = ORBIT_CHARS[(Math.random() * ORBIT_CHARS.length) | 0];
      } while (usedChars.includes(ch));
      usedChars.push(ch);

      orbiters.push({
        ringIndex: r,
        theta: (i / ring.count) * Math.PI * 2,
        char: ch,
        state: "orbiting",
        dx: 0, dy: 0,
        vx: 0, vy: 0,
        captureAngle: 0,
        captureRadius: 0,
        flungVx: 0, flungVy: 0,
        screenX: 0, screenY: 0,
      });
    }
  }
  return orbiters;
}

function respawnOrbiter(o: Orbiter, orbiters: Orbiter[]): void {
  const ringmates = orbiters.filter(r => r.ringIndex === o.ringIndex && r !== o).map(r => r.char);
  let ch: string;
  do {
    ch = ORBIT_CHARS[(Math.random() * ORBIT_CHARS.length) | 0];
  } while (ringmates.includes(ch));

  o.char = ch;
  o.state = "orbiting";
  o.theta = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
  o.dx = 0; o.dy = 0;
  o.vx = 0; o.vy = 0;
  o.captureAngle = 0;
  o.captureRadius = 0;
  o.flungVx = 0; o.flungVy = 0;
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
    let stars = buildStars(W || window.innerWidth, H || window.innerHeight, Math.min(W || 400, H || 400, 700) * 0.38);
    const orbiters = buildOrbiters();
    let dragDx = 0, dragDy = 0;
    let mouseVxHist: number[] = [0, 0, 0];
    let mouseVyHist: number[] = [0, 0, 0];
    let prevMouseX = -9000, prevMouseY = -9000;

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
      stars = buildStars(W, H, Math.min(W, H, 700) * 0.38);
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
      const base = Math.min(W, H, 700);
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

      // --- Star field update & render ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Trigger new sparkles
      const activeSparkles = stars.filter(s => s.sparkleTime >= 0).length;
      if (activeSparkles < 2) {
        const eligible = stars.filter(s => s.sparkleTime < 0 && s.cooldown <= 0);
        if (eligible.length > 0 && Math.random() < 1 / (60 * (SPARKLE_INTERVAL_MIN + Math.random() * (SPARKLE_INTERVAL_MAX - SPARKLE_INTERVAL_MIN)))) {
          const pick = eligible[(Math.random() * eligible.length) | 0];
          pick.sparkleTime = 0;
        }
      }
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Drag parallax response
        s.vx += dragDx * STAR_PARALLAX;
        s.vy += dragDy * STAR_PARALLAX;

        // Spring-back
        s.vx -= s.dx * STAR_SPRING;
        s.vy -= s.dy * STAR_SPRING;
        s.vx *= STAR_DAMPING;
        s.vy *= STAR_DAMPING;
        s.dx += s.vx;
        s.dy += s.vy;

        // Clamp displacement
        const dm = Math.sqrt(s.dx * s.dx + s.dy * s.dy);
        if (dm > STAR_MAX_DISP) {
          s.dx *= STAR_MAX_DISP / dm;
          s.dy *= STAR_MAX_DISP / dm;
        }

        // Sparkle logic
        if (s.sparkleTime >= 0) {
          s.sparkleTime += 1 / 60;
          if (s.sparkleTime >= SPARKLE_DURATION) {
            s.sparkleTime = -1;
            s.ch = s.baseCh;
            s.alpha = s.baseAlpha;
            s.cooldown = SPARKLE_COOLDOWN_MIN + Math.random() * (SPARKLE_COOLDOWN_MAX - SPARKLE_COOLDOWN_MIN);
          } else {
            const step = Math.min(SPARKLE_SEQ.length - 1, (s.sparkleTime / SPARKLE_STEP) | 0);
            s.ch = SPARKLE_SEQ[step];
            const progress = s.sparkleTime / SPARKLE_DURATION;
            s.alpha = s.baseAlpha + (1.0 - s.baseAlpha) * Math.sin(progress * Math.PI);
          }
        } else {
          s.cooldown -= 1 / 60;
        }

        // Drift
        const driftX = Math.sin(t * STAR_DRIFT_FREQ * Math.PI * 2 + s.phaseX) * STAR_DRIFT_AMP;
        const driftY = Math.cos(t * STAR_DRIFT_FREQ * Math.PI * 2 + s.phaseY) * STAR_DRIFT_AMP;

        const fx = s.bx + s.dx + driftX;
        const fy = s.by + s.dy + driftY;

        ctx.font = `${s.fontSize.toFixed(1)}px ${FONT}`;
        ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${s.alpha.toFixed(2)})`;
        ctx.fillText(s.ch, fx, fy);
      }
      const projected: { i: number; sx: number; sy: number; sz: number; sc: number }[] = [];
      const globeRadius = Math.min(W, H, 700) * 0.38;

      // Unproject mouse onto sphere surface, then to world space
      const base = Math.min(W, H, 700);
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

      // --- Orbiter position computation ---
      for (let i = 0; i < orbiters.length; i++) {
        const o = orbiters[i];
        if (o.state === "flung") continue; // handled separately

        const ring = RING_CONFIGS[o.ringIndex];

        if (o.state === "orbiting") {
          o.theta += ring.speed;
        }

        // Ellipse position in ring-local coords
        const ex = Math.cos(o.theta) * ring.rx * globeRadius;
        const ey = Math.sin(o.theta) * ring.ry * globeRadius;

        // Apply ring tilt (rotation around X axis in 2D → gives y,z from ey)
        const cosT = Math.cos(ring.tilt);
        const sinT = Math.sin(ring.tilt);
        const oy = ey * cosT;
        const oz = ey * sinT;

        // Drag spring-back (same physics as stars)
        o.vx += dragDx * STAR_PARALLAX;
        o.vy += dragDy * STAR_PARALLAX;
        o.vx -= o.dx * STAR_SPRING;
        o.vy -= o.dy * STAR_SPRING;
        o.vx *= STAR_DAMPING;
        o.vy *= STAR_DAMPING;
        o.dx += o.vx;
        o.dy += o.vy;
        const odm = Math.sqrt(o.dx * o.dx + o.dy * o.dy);
        if (odm > STAR_MAX_DISP) {
          o.dx *= STAR_MAX_DISP / odm;
          o.dy *= STAR_MAX_DISP / odm;
        }

        const sx = W / 2 + ex + o.dx;
        const sy = H / 2 + oy + o.dy;

        o.screenX = sx;
        o.screenY = sy;

        // Push into projected array for depth sorting with globe particles
        projected.push({ i: -(i + 1), sx, sy, sz: oz, sc: globeRadius * 0.04 });
      }

      // --- Mouse capture & fling ---
      const avgVx = mouseVxHist.reduce((a, b) => a + b, 0) / mouseVxHist.length;
      const avgVy = mouseVyHist.reduce((a, b) => a + b, 0) / mouseVyHist.length;
      const mouseSpeed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);

      for (let i = 0; i < orbiters.length; i++) {
        const o = orbiters[i];

        if (o.state === "flung") {
          // Check if off-screen
          if (o.screenX < -ORBIT_OFFSCREEN_MARGIN || o.screenX > W + ORBIT_OFFSCREEN_MARGIN ||
              o.screenY < -ORBIT_OFFSCREEN_MARGIN || o.screenY > H + ORBIT_OFFSCREEN_MARGIN) {
            respawnOrbiter(o, orbiters);
          }
          continue;
        }

        if (!mouseActive) {
          if (o.state === "captured") o.state = "orbiting";
          continue;
        }

        const distToMouse = Math.sqrt((o.screenX - mouseX) ** 2 + (o.screenY - mouseY) ** 2);

        if (o.state === "orbiting") {
          if (distToMouse < ORBIT_CAPTURE_DIST && mouseActive) {
            o.state = "captured";
            o.captureAngle = Math.atan2(o.screenY - mouseY, o.screenX - mouseX);
            o.captureRadius = distToMouse;
          }
        } else if (o.state === "captured") {
          if (mouseSpeed > ORBIT_FLING_THRESHOLD) {
            o.state = "flung";
            o.flungVx = avgVx;
            o.flungVy = avgVy;
            continue;
          }

          if (distToMouse > ORBIT_RELEASE_DIST) {
            o.state = "orbiting";
            continue;
          }

          // Orbit around mouse
          o.captureAngle += ORBIT_MOUSE_SPEED / 60;
          o.captureRadius += (ORBIT_CAPTURE_DECAY_TARGET - o.captureRadius) * 0.05;
          o.screenX = mouseX + Math.cos(o.captureAngle) * o.captureRadius;
          o.screenY = mouseY + Math.sin(o.captureAngle) * o.captureRadius;

          // Update projected entry for this orbiter
          const projIdx = projected.findIndex(p => p.i === -(i + 1));
          if (projIdx >= 0) {
            projected[projIdx].sx = o.screenX;
            projected[projIdx].sy = o.screenY;
            projected[projIdx].sz = -1; // force to front when captured
          }
        }
      }

      // Reset drag delta each frame (consumed by stars and orbiters)
      dragDx = 0;
      dragDy = 0;

      projected.sort((a, b) => a.sz - b.sz);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const pr of projected) {
        // Orbiter rendering
        if (pr.i < 0) {
          const oi = -(pr.i + 1);
          const o = orbiters[oi];
          if (o.state !== "orbiting" && o.state !== "captured") continue;
          const ring = RING_CONFIGS[o.ringIndex];
          const facing = Math.max(0, (-pr.sz + 0.3 * globeRadius) / (0.6 * globeRadius));
          if (facing < 0.05) continue;
          const al = Math.min(1, facing);
          const fs = 14 + (pr.sz < 0 ? 2 : 0);
          // Glow layer
          ctx.font = `bold ${(fs + 2).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${ring.color[0]},${ring.color[1]},${ring.color[2]},${(al * 0.2).toFixed(2)})`;
          ctx.fillText(o.char, pr.sx, pr.sy);
          // Main layer
          ctx.font = `bold ${fs.toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${ring.color[0]},${ring.color[1]},${ring.color[2]},${al.toFixed(2)})`;
          ctx.fillText(o.char, pr.sx, pr.sy);
          continue;
        }

        const p = particles[pr.i];
        const facing = Math.max(0, (-pr.sz + 0.4) * 2.5);
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

      // Render flung orbiters (not depth-sorted, they're flying away)
      for (const o of orbiters) {
        if (o.state !== "flung") continue;
        o.screenX += o.flungVx;
        o.screenY += o.flungVy;
        o.flungVx *= ORBIT_FLING_DRAG;
        o.flungVy *= ORBIT_FLING_DRAG;
        const ring = RING_CONFIGS[o.ringIndex];
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillStyle = `rgba(${ring.color[0]},${ring.color[1]},${ring.color[2]},0.8)`;
        ctx.fillText(o.char, o.screenX, o.screenY);
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

      if (prevMouseX > -1000) {
        mouseVxHist.push(e.clientX - prevMouseX);
        mouseVyHist.push(e.clientY - prevMouseY);
        if (mouseVxHist.length > 3) mouseVxHist.shift();
        if (mouseVyHist.length > 3) mouseVyHist.shift();
      }
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      lastX = e.clientX;
      lastY = e.clientY;
      spinVelocity = dx * 0.0004;
      dragDx = dx;
      dragDy = dy;
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
        dragDx = dx;
        dragDy = dy;
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
