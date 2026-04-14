"use client";

import { useEffect, useRef } from "react";
import { GLOBE_DATA } from "@/lib/globe-data";

const BODY_COLOR: [number, number, number] = [250, 220, 120];
const FACE_COLOR: [number, number, number] = [20, 255, 200];
const FACE_GLOW: [number, number, number] = [20, 255, 180];
const CHEEK_COLOR: [number, number, number] = [255, 120, 180];
// --- Face state colors ---
const BODY_COLOR_PALE: [number, number, number] = [255, 245, 180];
const EYE_COLOR_WHITE: [number, number, number] = [255, 255, 255];
const STRESS_COLOR: [number, number, number] = [255, 60, 60];
const STRESS_CHARS = ["#", "+", "*"];
// Distressed gradient stops (top → middle → bottom by rotated Y)
const ANGRY_TOP: [number, number, number] = [255, 80, 100];
const ANGRY_MID: [number, number, number] = [255, 160, 90];
const ANGRY_BOT: [number, number, number] = [255, 210, 130];

type FaceState = "normal" | "dizzy" | "distressed";
type ParticleRole = "body" | "eye" | "mouth" | "cheek";

const FONT_FALLBACKS = "'SF Mono', 'Fira Code', 'Courier New', monospace";

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
// --- Face state triggers ---
const DIZZY_THRESHOLD = 0.8;
const SPIN_DECAY = 0.995;
const DRAG_DURATION_THRESHOLD = 180; // frames (~3s at 60fps)
const JERK_THRESHOLD = 50;
const JERK_DECAY = 0.98;
const COOLDOWN_DURATION = 3000; // ms
const COLOR_LERP_DURATION = 300; // ms

// --- Wobble ---
const WOBBLE_DAMPING = 1.5;
const WOBBLE_FREQ_X = 6;
const WOBBLE_FREQ_Y = 7;
const WOBBLE_AMP_X = 0.08;
const WOBBLE_AMP_Y = 0.06;

// --- Face mask geometry ---
const LEFT_EYE_CX = -0.56;
const RIGHT_EYE_CX = 0.56;
const EYE_CY = 0.05;
const MOUTH_CY = 0.22;
const EYE_MOUTH_Y_SPLIT = 0.17; // Y threshold: eye (below) vs mouth (above)

// Dizzy mask — @ eyes (annulus), ~ mouth (sine wave)
const EYE_INNER_R = 0.05;
const EYE_OUTER_R = 0.13;
const WAVE_AMPLITUDE = 0.04;
const WAVE_FREQUENCY = 8;
const WAVE_BAND = 0.03;

// Distressed mask — > < eyes (chevrons), _ mouth (flat line)
const CHEVRON_SLOPE = 1.5;
const CHEVRON_LINE_W = 0.025;
const FLAT_MOUTH_HW = 0.15;
const FLAT_MOUTH_LW = 0.02;

// Stress mark positions (upper-right, on sphere surface)
const STRESS_POSITIONS: [number, number, number][] = [
  [0.40, -0.50, 0.77],   // center
  [0.35, -0.58, 0.73],   // top arm
  [0.45, -0.42, 0.79],   // bottom arm
  [0.32, -0.47, 0.82],   // left arm
  [0.48, -0.53, 0.70],   // right arm
];

const BODY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789@#%&*+-~";
const FACE_CHARS = ["U", "W", "#", "@", "%"];
const CHEEK_CHARS = ["o", "O", "*", "@"];

// --- Star field ---
const STAR_COUNT = 50;
const STAR_CHARS = [".", "·", "*", "✦"];
const SPARKLE_SEQ = [".", "·", "*", "✦", "*", "·", "."];
const SPARKLE_DURATION = 1.2; // seconds
const SPARKLE_STEP = SPARKLE_DURATION / SPARKLE_SEQ.length;
const SPARKLE_COOLDOWN_MIN = 0.3;
const SPARKLE_COOLDOWN_MAX = 1.0;
const SPARKLE_INTERVAL_MIN = 0.2;
const SPARKLE_INTERVAL_MAX = 0.5;
const STAR_DRIFT_AMP = 4;   // px
const STAR_DRIFT_FREQ = 0.4; // Hz
const STAR_PARALLAX = 0.2;
const STAR_SPRING = 0.015;
const STAR_DAMPING = 0.94;
const STAR_MAX_DISP = 20;
const STAR_EXCLUSION = 1.15;  // × globe radius (outside globe + padding for glyph size)
const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [199, 179, 255],
];

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
  depth: number; // 0=close to globe (more parallax), 1=far (less parallax)
};


type Particle = {
  bx: number; by: number; bz: number;
  dx: number; dy: number; dz: number;
  vx: number; vy: number; vz: number;
  tp: number; baseTp: number; ch: string;
  role: ParticleRole;
  pulse: number; pulseSpeed: number;
};

function buildParticles(): Particle[] {
  return GLOBE_DATA.map((d) => {
    const tp = d[3];
    let ch: string;
    if (tp === 1) ch = FACE_CHARS[(Math.random() * FACE_CHARS.length) | 0];
    else if (tp === 2) ch = CHEEK_CHARS[(Math.random() * CHEEK_CHARS.length) | 0];
    else ch = BODY_CHARS[(Math.random() * BODY_CHARS.length) | 0];
    // Distinguish eye vs mouth from tp=1 using Y threshold
    let role: ParticleRole;
    if (tp === 2) role = "cheek";
    else if (tp === 1 && d[1] < EYE_MOUTH_Y_SPLIT) role = "eye";
    else if (tp === 1) role = "mouth";
    else role = "body";
    return {
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp, baseTp: tp, ch, role,
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

  const maxDist = globeRadius * 2.2; // stars stay within this radius of center

  // Scale star font size based on viewport — smaller on mobile
  const viewMin = Math.min(W, H);
  const fontBase = viewMin < 500 ? 10 : 20;
  const fontRange = viewMin < 500 ? 5 : 10;

  for (let i = 0; i < STAR_COUNT; i++) {
    let x: number, y: number;
    do {
      const angle = Math.random() * Math.PI * 2;
      const dist = exclusion + Math.random() * (maxDist - exclusion);
      x = cx + Math.cos(angle) * dist;
      y = cy + Math.sin(angle) * dist;
    } while (x < 0 || x > W || y < 0 || y > H);

    const color = STAR_COLORS[Math.random() < 0.5 ? 0 : 1];
    const baseCh = STAR_CHARS[(Math.random() * STAR_CHARS.length) | 0];
    const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    // depth: 0 = closest to globe, 1 = farthest
    const depth = Math.min(1, (distFromCenter - exclusion) / (maxDist - exclusion));

    stars.push({
      bx: x, by: y,
      dx: 0, dy: 0,
      vx: 0, vy: 0,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      ch: baseCh,
      baseCh,
      fontSize: fontBase + Math.random() * fontRange,
      color,
      baseAlpha: 0.2 + Math.random() * 0.3,
      alpha: 0.2 + Math.random() * 0.3,
      sparkleTime: Math.random() < 0.15 ? 0 : -1, // some start sparkling immediately
      cooldown: Math.random() * 1.5,
      depth,
    });
  }
  return stars;
}

// --- Face masks ---
// Each mask classifies a front-facing particle into a role.
// Only operates on particles with bz > 0.6 (front hemisphere).

function maskNormal(p: Particle): ParticleRole {
  if (p.baseTp === 2) return "cheek";
  if (p.baseTp === 1 && p.by < EYE_MOUTH_Y_SPLIT) return "eye";
  if (p.baseTp === 1) return "mouth";
  return "body";
}

function maskDizzy(p: Particle): ParticleRole {
  if (p.bz < 0.6) return "body";
  // Cheeks — same regions as normal
  if (p.baseTp === 2) return "cheek";
  // @ eyes — annulus test at each eye center
  const dlx = Math.sqrt((p.bx - LEFT_EYE_CX) ** 2 + (p.by - EYE_CY) ** 2);
  const drx = Math.sqrt((p.bx - RIGHT_EYE_CX) ** 2 + (p.by - EYE_CY) ** 2);
  if ((dlx > EYE_INNER_R && dlx < EYE_OUTER_R) ||
      (drx > EYE_INNER_R && drx < EYE_OUTER_R)) return "eye";
  // ~ mouth — sine wave band
  const waveY = MOUTH_CY + WAVE_AMPLITUDE * Math.sin(p.bx * WAVE_FREQUENCY);
  if (Math.abs(p.by - waveY) < WAVE_BAND && Math.abs(p.bx) < 0.35) return "mouth";
  return "body";
}

function maskDistressed(p: Particle): ParticleRole {
  if (p.bz < 0.6) return "body";
  // Cheeks — same regions as normal
  if (p.baseTp === 2) return "cheek";
  // > left eye — two diagonal lines meeting at tip (rightward-pointing chevron)
  const ldx = p.bx - LEFT_EYE_CX;
  const ldy = p.by - EYE_CY;
  if (ldx < 0.01 && (
    Math.abs(ldy - CHEVRON_SLOPE * ldx) < CHEVRON_LINE_W ||
    Math.abs(ldy + CHEVRON_SLOPE * ldx) < CHEVRON_LINE_W
  )) return "eye";
  // < right eye — mirrored (leftward-pointing chevron)
  const rdx = p.bx - RIGHT_EYE_CX;
  const rdy = p.by - EYE_CY;
  if (rdx > -0.01 && (
    Math.abs(rdy - CHEVRON_SLOPE * (-rdx)) < CHEVRON_LINE_W ||
    Math.abs(rdy + CHEVRON_SLOPE * (-rdx)) < CHEVRON_LINE_W
  )) return "eye";
  // _ mouth — horizontal flat line
  if (Math.abs(p.by - MOUTH_CY) < FLAT_MOUTH_LW && Math.abs(p.bx) < FLAT_MOUTH_HW) return "mouth";
  return "body";
}

function applyMask(particles: Particle[], state: FaceState): void {
  const fn = state === "dizzy" ? maskDizzy
    : state === "distressed" ? maskDistressed
    : maskNormal;
  for (let i = 0; i < particles.length; i++) {
    particles[i].role = fn(particles[i]);
  }
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

    // Resolve CSS variable for canvas — canvas ctx.font can't read var()
    const geistMono = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-geist-mono")
      .trim();
    const FONT = geistMono
      ? `${geistMono}, ${FONT_FALLBACKS}`
      : FONT_FALLBACKS;

    // Cache reduced-motion preference once; update on change
    const motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionMql.matches;
    const onMotionChange = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    motionMql.addEventListener("change", onMotionChange);

    let W = 0, H = 0;
    let rotY = 0, rotX = DEF_RX, autoRotY = Math.PI - (20 * Math.PI / 180);
    let dragging = false, lastX = 0, lastY = 0;
    let spinVelocity = DEF_VY;
    let mouseX = -9000, mouseY = -9000, mouseActive = false;
    let stars = buildStars(W || window.innerWidth, H || window.innerHeight, Math.min(W || 400, H || 400, 700) * 0.38);
    let dragDx = 0, dragDy = 0;

    // --- Face state ---
    let faceState: FaceState = "normal";
    let cumulativeSpin = 0;
    let dragFrames = 0;
    let jerkAccum = 0;
    let cooldownTimer: number | null = null;
    let wobbleStart = 0;
    let colorLerpStart = 0;
    let prevFaceState: FaceState = "normal";

    const setFaceState = (next: FaceState) => {
      if (next === faceState) return;
      prevFaceState = faceState;
      colorLerpStart = performance.now();
      faceState = next;
      applyMask(particles, next);
      if (next === "dizzy") {
        spinVelocity = 0;
        // Snap face to front — nearest multiple of 2*PI
        autoRotY = Math.round(autoRotY / (2 * Math.PI)) * 2 * Math.PI;
        wobbleStart = performance.now();
        cooldownTimer = window.setTimeout(() => {
          setFaceState("normal");
          cooldownTimer = null;
        }, COOLDOWN_DURATION);
      }
      if (next === "normal") {
        spinVelocity = DEF_VY;
        cumulativeSpin = 0;
        dragFrames = 0;
        jerkAccum = 0;
      }
    };

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
      const reduced = reducedMotion;

      if (!dragging) {
        // Wait SPIN_DELAY seconds before starting auto-rotation
        if (elapsed > SPIN_DELAY) {
          autoRotY += spinVelocity;
        }
        rotX += (DEF_RX - rotX) * 0.035;
      }

      // --- Face state triggers ---
      cumulativeSpin += Math.abs(spinVelocity);
      cumulativeSpin *= SPIN_DECAY;

      if (dragging) {
        dragFrames++;
        jerkAccum += Math.abs(dragDx) + Math.abs(dragDy);
        jerkAccum *= JERK_DECAY;
      }

      // Distressed takes priority (active grab)
      if (faceState === "normal" && dragging &&
          (dragFrames > DRAG_DURATION_THRESHOLD || jerkAccum > JERK_THRESHOLD)) {
        setFaceState("distressed");
      } else if (faceState === "normal" && !dragging &&
                 cumulativeSpin > DIZZY_THRESHOLD) {
        setFaceState("dizzy");
      }

      // Wobble (dizzy only)
      if (faceState === "dizzy") {
        const we = (performance.now() - wobbleStart) / 1000;
        const decay = Math.exp(-we * WOBBLE_DAMPING);
        rotX = DEF_RX + Math.sin(we * WOBBLE_FREQ_X) * WOBBLE_AMP_X * decay;
        rotY = Math.cos(we * WOBBLE_FREQ_Y) * WOBBLE_AMP_Y * decay;
      }

      ctx.clearRect(0, 0, W, H);

      // --- Star field update & render ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Trigger new sparkles (single pass — no .filter())
      if (!reduced) {
        let activeSparkles = 0;
        let eligibleCount = 0;
        let eligiblePick = -1;
        for (let i = 0; i < stars.length; i++) {
          if (stars[i].sparkleTime >= 0) { activeSparkles++; }
          else if (stars[i].cooldown <= 0) {
            eligibleCount++;
            if (Math.random() < 1 / eligibleCount) eligiblePick = i;
          }
        }
        if (activeSparkles < 6 && eligiblePick >= 0 &&
            Math.random() < 1 / (60 * (SPARKLE_INTERVAL_MIN + Math.random() * (SPARKLE_INTERVAL_MAX - SPARKLE_INTERVAL_MIN)))) {
          stars[eligiblePick].sparkleTime = 0;
        }
      }
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Drag parallax response — close stars move more, far stars move less
        const parallax = 0.35 - s.depth * 0.25; // close=0.35, far=0.10
        s.vx += dragDx * parallax;
        s.vy += dragDy * parallax;

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
        if (!reduced && s.sparkleTime >= 0) {
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
        const driftX = reduced ? 0 : Math.sin(t * STAR_DRIFT_FREQ * Math.PI * 2 + s.phaseX) * STAR_DRIFT_AMP;
        const driftY = reduced ? 0 : Math.cos(t * STAR_DRIFT_FREQ * Math.PI * 2 + s.phaseY) * STAR_DRIFT_AMP;

        const fx = s.bx + s.dx + driftX;
        const fy = s.by + s.dy + driftY;

        // Hide stars that drift behind the globe
        const distFromCenter = Math.sqrt((fx - W / 2) ** 2 + (fy - H / 2) ** 2);
        const globeR = Math.min(W, H, 700) * 0.38;
        if (distFromCenter < globeR) continue;

        ctx.font = `${s.fontSize.toFixed(1)}px ${FONT}`;
        // Glow layer when sparkling
        if (s.sparkleTime >= 0) {
          const glowAlpha = (s.alpha * 0.3).toFixed(2);
          ctx.font = `${(s.fontSize * 1.6).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${glowAlpha})`;
          ctx.fillText(s.ch, fx, fy);
          ctx.font = `${s.fontSize.toFixed(1)}px ${FONT}`;
        }
        ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${s.alpha.toFixed(2)})`;
        ctx.fillText(s.ch, fx, fy);
      }

      // Dark circle behind globe to mask the dot grid background
      const globeRadius = Math.min(W, H, 700) * 0.38;
      const gcx = W / 2, gcy = H / 2;
      const maskR = globeRadius * 1.05;
      const grad = ctx.createRadialGradient(gcx, gcy, globeRadius * 0.6, gcx, gcy, maskR);
      grad.addColorStop(0, "rgba(13,14,20,1)");
      grad.addColorStop(0.85, "rgba(13,14,20,0.95)");
      grad.addColorStop(1, "rgba(13,14,20,0)");
      ctx.beginPath();
      ctx.arc(gcx, gcy, maskR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      const projected: { i: number; sx: number; sy: number; sz: number; sc: number }[] = [];

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

      // Reset drag delta each frame (consumed by stars)
      dragDx = 0;
      dragDy = 0;

      projected.sort((a, b) => a.sz - b.sz);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const pr of projected) {
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
      dragDx = dx;
      dragDy = dy;
    };

    const onMouseUp = () => {
      dragging = false;
      if (faceState === "distressed" && cooldownTimer === null) {
        cooldownTimer = window.setTimeout(() => {
          setFaceState("normal");
          cooldownTimer = null;
        }, COOLDOWN_DURATION);
      }
      dragFrames = 0;
    };
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
      if (dragging) e.preventDefault();
    };

    const onTouchEnd = () => {
      dragging = false;
      mouseActive = false;
      if (faceState === "distressed" && cooldownTimer === null) {
        cooldownTimer = window.setTimeout(() => {
          setFaceState("normal");
          cooldownTimer = null;
        }, COOLDOWN_DURATION);
      }
      dragFrames = 0;
    };

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
      if (cooldownTimer !== null) window.clearTimeout(cooldownTimer);
      cancelAnimationFrame(rafRef.current);
      motionMql.removeEventListener("change", onMotionChange);
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
