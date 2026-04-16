"use client";

import { useEffect, useRef } from "react";
import { GLOBE_DATA } from "@/lib/globe-data";
import {
  DIZZY_FACE_DATA, DIZZY_FACE_CHARS, DIZZY_CHEEK_DATA,
  ANGRY_FACE_DATA, ANGRY_FACE_CHARS,
  ANGRY_MARK_DATA, ANGRY_MARK_CHARS, ANGRY_MARK_CENTER,
} from "@/lib/globe-face-data";

const BODY_COLOR: [number, number, number] = [250, 220, 120];
const FACE_COLOR: [number, number, number] = [20, 255, 200];
const FACE_GLOW: [number, number, number] = [20, 255, 180];
const CHEEK_COLOR: [number, number, number] = [255, 120, 180];
// --- Face state colors ---
const BODY_COLOR_PALE: [number, number, number] = [255, 245, 170];
const DIZZY_FACE_COLOR: [number, number, number] = [255, 255, 255];
const DIZZY_FACE_GLOW: [number, number, number] = [240, 240, 220];
const DIZZY_CHEEK_COLOR: [number, number, number] = [20, 255, 220];
const ANGRY_FACE_COLOR: [number, number, number] = [20, 255, 200];
const ANGRY_FACE_GLOW: [number, number, number] = [20, 255, 180];
const ANGRY_MARK_COLOR: [number, number, number] = [255, 60, 60];
const ANGRY_MARK_GLOW: [number, number, number] = [255, 80, 70];
// Distressed gradient stops — matches Facebook angry emoji (top → middle → bottom)
const ANGRY_TOP: [number, number, number] = [240, 75, 95];
const ANGRY_MID: [number, number, number] = [240, 150, 105];
const ANGRY_BOT: [number, number, number] = [245, 200, 100];

type FaceState = "normal" | "dizzy" | "distressed";
type ParticleRole = "body" | "eye" | "mouth" | "cheek" | "hidden" | "angryface" | "stressmark" | "dizzyface" | "dizzycheek";

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
const SPIN_DELAY = 1;         // seconds before auto-rotation starts
// --- Face state triggers ---
const DIZZY_THRESHOLD = 3 * 2 * Math.PI; // 3 full rotations
const SPIN_DECAY = 0.995;               // cumulative spin bleed-off per frame
const DIZZY_SPEED_THRESHOLD = 0.012;    // min |spinVelocity| to count toward dizzy
const DRAG_DURATION_THRESHOLD = 480; // frames (~8s at 60fps)
const JERK_THRESHOLD = 800;       // px/s sustained movement
const DIRECTION_CHANGE_THRESHOLD = 5; // direction reversals while dragging
const COOLDOWN_DURATION = 1500; // ms
// --- Angry shake-off ---
const SHAKE_DURATION = 2000;  // ms — head-shake before returning to normal
const SHAKE_FREQ = 18;        // Hz — rapid left-right oscillation
const SHAKE_AMP = 0.18;       // radians — shake amplitude
const SHAKE_DAMPING = 2.5;    // exponential decay rate
const COLOR_LERP_DURATION = 300; // ms

// --- Wobble ---
const WOBBLE_DAMPING = 1.5;
const WOBBLE_FREQ_X = 6;
const WOBBLE_FREQ_Y = 7;
const WOBBLE_AMP_X = 0.08;
const WOBBLE_AMP_Y = 0.06;

// --- Face mask geometry ---
const EYE_MOUTH_Y_SPLIT = 0.17; // Y threshold: eye (below) vs mouth (above)

// Dizzy eye spin centers and speed
const LEYE_CX = -0.3685, LEYE_CY = -0.0786;
const REYE_CX = 0.3784, REYE_CY = -0.0903;
const EYE_SPIN_SPEED = 1.2;


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
  const particles: Particle[] = GLOBE_DATA.map((d) => {
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
  // Angry face particles — separate from UwU, hidden by default (baseTp=3)
  for (const d of ANGRY_FACE_DATA) {
    particles.push({
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp: 3, baseTp: 3,
      ch: ANGRY_FACE_CHARS[(Math.random() * ANGRY_FACE_CHARS.length) | 0],
      role: "hidden",
      pulse: Math.random() * 6.28,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    });
  }
  // Angry stress mark particles — hidden by default (baseTp=4)
  for (const d of ANGRY_MARK_DATA) {
    particles.push({
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp: 4, baseTp: 4,
      ch: ANGRY_MARK_CHARS[(Math.random() * ANGRY_MARK_CHARS.length) | 0],
      role: "hidden",
      pulse: Math.random() * 6.28,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    });
  }
  // Dizzy face particles — hidden by default (baseTp=5)
  for (const d of DIZZY_FACE_DATA) {
    particles.push({
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp: 5, baseTp: 5,
      ch: DIZZY_FACE_CHARS[(Math.random() * DIZZY_FACE_CHARS.length) | 0],
      role: "hidden",
      pulse: Math.random() * 6.28,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    });
  }
  // Dizzy cheek particles — hidden by default (baseTp=6)
  for (const d of DIZZY_CHEEK_DATA) {
    particles.push({
      bx: d[0], by: d[1], bz: d[2],
      dx: 0, dy: 0, dz: 0,
      vx: 0, vy: 0, vz: 0,
      tp: 6, baseTp: 6,
      ch: CHEEK_CHARS[(Math.random() * CHEEK_CHARS.length) | 0],
      role: "hidden",
      pulse: Math.random() * 6.28,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    });
  }
  return particles;
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
    let attempts = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const dist = exclusion + Math.random() * (maxDist - exclusion);
      x = cx + Math.cos(angle) * dist;
      y = cy + Math.sin(angle) * dist;
      if (++attempts > 200) { x = Math.random() * W; y = Math.random() * H; break; }
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
  if (p.baseTp === 3 || p.baseTp === 4 || p.baseTp === 5 || p.baseTp === 6) return "hidden";
  if (p.baseTp === 2) return "cheek";
  if (p.baseTp === 1 && p.by < EYE_MOUTH_Y_SPLIT) return "eye";
  if (p.baseTp === 1) return "mouth";
  return "body";
}

function maskDizzy(p: Particle): ParticleRole {
  if (p.baseTp === 5) return "dizzyface";
  if (p.baseTp === 6) return "dizzycheek";
  // Hide UwU face, cheeks, angry particles
  if (p.baseTp === 1 || p.baseTp === 2 || p.baseTp === 3 || p.baseTp === 4) return "hidden";
  return "body";
}

function maskDistressed(p: Particle): ParticleRole {
  if (p.baseTp === 3) return "angryface";
  if (p.baseTp === 4) return "stressmark";
  // Hide UwU face, cheeks, and dizzy particles
  if (p.baseTp === 1 || p.baseTp === 2 || p.baseTp === 5 || p.baseTp === 6) return "hidden";
  return "body";
}

function applyMask(particles: Particle[], state: FaceState): void {
  const fn = state === "dizzy" ? maskDizzy
    : state === "distressed" ? maskDistressed
    : maskNormal;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const prev = p.role;
    p.role = fn(p);
    // Swap character when a face particle becomes body (hide UwU remnants)
    // or when a body particle becomes face (blend in)
    if (p.role !== prev) {
      if (p.role === "body") {
        p.ch = BODY_CHARS[(Math.random() * BODY_CHARS.length) | 0];
      } else if (p.role === "eye" || p.role === "mouth") {
        p.ch = FACE_CHARS[(Math.random() * FACE_CHARS.length) | 0];
      } else if (p.role === "cheek") {
        p.ch = CHEEK_CHARS[(Math.random() * CHEEK_CHARS.length) | 0];
      } else if (p.role === "angryface") {
        p.ch = ANGRY_FACE_CHARS[(Math.random() * ANGRY_FACE_CHARS.length) | 0];
      } else if (p.role === "stressmark") {
        p.ch = ANGRY_MARK_CHARS[(Math.random() * ANGRY_MARK_CHARS.length) | 0];
      } else if (p.role === "dizzyface") {
        p.ch = DIZZY_FACE_CHARS[(Math.random() * DIZZY_FACE_CHARS.length) | 0];
      } else if (p.role === "dizzycheek") {
        p.ch = CHEEK_CHARS[(Math.random() * CHEEK_CHARS.length) | 0];
      }
    }
  }
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Distressed body gradient: top=red, mid=orange, bottom=golden based on rotated Y (-1..1)
function angryBodyColor(ry: number): [number, number, number] {
  // ry is rotated Y in -1..1 range. Map to 0..1 (top to bottom).
  const t = (ry + 1) / 2; // 0=top, 1=bottom
  if (t < 0.5) {
    const lt = t / 0.5;
    return lerpColor(ANGRY_TOP, ANGRY_MID, lt);
  }
  const lt = (t - 0.5) / 0.5;
  return lerpColor(ANGRY_MID, ANGRY_BOT, lt);
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

    // --- Glyph bitmap cache ---
    // Pre-renders each unique char+size+bold+color to an offscreen canvas.
    // drawImage from a cached bitmap is 5-10× faster than fillText.
    let cacheDpr = window.devicePixelRatio || 1;
    const measureCtx = document.createElement("canvas").getContext("2d")!;
    const glyphCache = new Map<string, { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }>();

    const getGlyph = (
      ch: string, size: number, bold: boolean,
      r: number, g: number, b: number,
    ) => {
      const key = `${ch}|${size}|${bold ? 1 : 0}|${r}|${g}|${b}`;
      const hit = glyphCache.get(key);
      if (hit) return hit;

      const fontStr = `${bold ? "bold " : ""}${size}px ${FONT}`;
      measureCtx.font = fontStr;
      const m = measureCtx.measureText(ch);
      const pad = 2;
      const w = Math.ceil(m.width) + pad * 2;
      const h = Math.ceil(size * 1.3) + pad * 2;

      const gcv = document.createElement("canvas");
      gcv.width = w * cacheDpr;
      gcv.height = h * cacheDpr;
      const gc = gcv.getContext("2d")!;
      gc.scale(cacheDpr, cacheDpr);
      gc.font = fontStr;
      gc.textAlign = "center";
      gc.textBaseline = "middle";
      gc.fillStyle = `rgb(${r},${g},${b})`;
      gc.fillText(ch, w / 2, h / 2);

      const entry = { cv: gcv, ox: w / 2, oy: h / 2, w, h };
      glyphCache.set(key, entry);
      return entry;
    };

    let W = 0, H = 0;
    let rotY = 0, rotX = DEF_RX, autoRotY = Math.PI - (20 * Math.PI / 180);
    let dragging = false, lastX = 0, lastY = 0;
    let spinVelocity = DEF_VY;
    let mouseX = -9000, mouseY = -9000, mouseActive = false;
    let stars = buildStars(W || window.innerWidth, H || window.innerHeight, Math.min(W || 400, H || 400, 700) * 0.38);
    let prevT = performance.now() / 1000;
    const projected: { i: number; sx: number; sy: number; sz: number; sc: number; ry: number }[] = [];
    let dragDx = 0, dragDy = 0;
    let dragStartTime = 0;
    let dragTotalDx = 0;
    const FLICK_WINDOW = 500; // ms — quick grab threshold
    const FLICK_MULTIPLIER = 0.0012; // velocity boost for flicks

    // --- Face state ---
    let faceState: FaceState = "normal";
    let cumulativeSpin = 0;
    let dragFrames = 0;
    let jerkAccum = 0;
    let dirChanges = 0;
    let prevDragDx = 0, prevDragDy = 0;
    let shaking = false;      // true during shake animation
    let shakeLocked = false;   // true from shake start until back to normal (blocks all input)
    let shakeStart = 0;
    let cooldownTimer: number | null = null;
    let cooldownTimer2: number | null = null;
    let lastRecovery = 0;        // timestamp of last return to normal
    const RECOVERY_COOLDOWN = 3000; // ms before triggers can fire again
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
        shakeLocked = true;
        dragging = false;
        const FRONT_FACING = Math.PI;
        autoRotY = Math.round((autoRotY - FRONT_FACING) / (2 * Math.PI)) * 2 * Math.PI + FRONT_FACING;
        wobbleStart = performance.now();
        cooldownTimer = window.setTimeout(() => {
          cooldownTimer2 = window.setTimeout(() => {
            setFaceState("normal");
            cooldownTimer2 = null;
          }, 500);
        }, 2000);
      }
      if (next === "distressed") {
        // 3s max before forced shake-off (even if still dragging)
        cooldownTimer = window.setTimeout(() => {
          cooldownTimer = null;
          startShake();
        }, COOLDOWN_DURATION);
      }
      if (next === "normal") {
        shaking = false;
        shakeLocked = false;
        lastRecovery = performance.now();
        cumulativeSpin = 0;
        dragFrames = 0;
        jerkAccum = 0;
        dirChanges = 0;
        prevDragDx = 0;
        prevDragDy = 0;
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
      if (dpr !== cacheDpr) {
        cacheDpr = dpr;
        glyphCache.clear();
      }
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
      const dt = t - prevT;
      prevT = t;
      const elapsed = (performance.now() - startTime) / 1000;
      const reduced = reducedMotion;
      const dtScale = dt * 60; // normalize to 60fps baseline

      if (!dragging && !shaking && !reduced) {
        // Wait SPIN_DELAY seconds before starting auto-rotation
        if (elapsed > SPIN_DELAY) {
          autoRotY += spinVelocity * dtScale;
        }
        const recoveryEase = 1 - Math.pow(1 - 0.035, dtScale);
        rotX += (DEF_RX - rotX) * recoveryEase;
      }

      // --- Face state triggers ---
      if (Math.abs(spinVelocity) > DIZZY_SPEED_THRESHOLD) {
        cumulativeSpin += Math.abs(spinVelocity) * dtScale;
      }
      cumulativeSpin *= Math.pow(SPIN_DECAY, dtScale);

      if (dragging) {
        dragFrames++;
        jerkAccum += Math.abs(dragDx) + Math.abs(dragDy);
        // Detect direction reversals (sign flip on either axis)
        if ((prevDragDx * dragDx < 0) || (prevDragDy * dragDy < 0)) {
          dirChanges++;
          jerkAccum = 0; // reset on direction change
        }
        prevDragDx = dragDx;
        prevDragDy = dragDy;
      }

      // Distressed requires shaking (direction changes) — smooth spinning won't trigger it
      const canTrigger = faceState === "normal" && performance.now() - lastRecovery > RECOVERY_COOLDOWN;
      if (canTrigger && dragging && dirChanges >= 2 &&
          (dragFrames > DRAG_DURATION_THRESHOLD ||
           dirChanges >= DIRECTION_CHANGE_THRESHOLD ||
           jerkAccum > JERK_THRESHOLD)) {
        setFaceState("distressed");
      } else if (canTrigger && !dragging &&
                 cumulativeSpin > DIZZY_THRESHOLD) {
        setFaceState("dizzy");
      }

      // Wobble (dizzy only — delayed start, sits still until wobbleStart)
      if (faceState === "dizzy") {
        const we = (performance.now() - wobbleStart) / 1000;
        if (we > 0) {
          const decay = Math.exp(-we * WOBBLE_DAMPING);
          rotX = DEF_RX + Math.sin(we * WOBBLE_FREQ_X) * WOBBLE_AMP_X * decay;
          rotY = Math.cos(we * WOBBLE_FREQ_Y) * WOBBLE_AMP_Y * decay;
        }
      }

      // Shake-off (distressed → recovery)
      if (shaking) {
        const se = (performance.now() - shakeStart) / 1000;
        const decay = Math.exp(-se * SHAKE_DAMPING);
        rotY = Math.sin(se * SHAKE_FREQ) * SHAKE_AMP * decay;
        const shakeEase = 1 - Math.pow(1 - 0.035, dtScale);
        rotX += (DEF_RX - rotX) * shakeEase;
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

        // Spring-back (dt-corrected damping)
        s.vx -= s.dx * STAR_SPRING;
        s.vy -= s.dy * STAR_SPRING;
        const starDamp = Math.pow(STAR_DAMPING, dtScale);
        s.vx *= starDamp;
        s.vy *= starDamp;
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
          s.sparkleTime += dt;
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
          s.cooldown -= dt;
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

        const starSz = Math.round(s.fontSize);
        // Glow layer when sparkling (cached bitmap)
        if (s.sparkleTime >= 0) {
          const sg = getGlyph(s.ch, Math.round(s.fontSize * 1.6), false, s.color[0], s.color[1], s.color[2]);
          ctx.globalAlpha = s.alpha * 0.3;
          ctx.drawImage(sg.cv, fx - sg.ox, fy - sg.oy, sg.w, sg.h);
        }
        const sg = getGlyph(s.ch, starSz, false, s.color[0], s.color[1], s.color[2]);
        ctx.globalAlpha = s.alpha;
        ctx.drawImage(sg.cv, fx - sg.ox, fy - sg.oy, sg.w, sg.h);
        ctx.globalAlpha = 1;
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

      projected.length = 0;

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
        if (p.role === "hidden") continue; // skip physics for hidden particles
        p.pulse += p.pulseSpeed;

        // Stress mark breathing animation — pulse in/out from center
        if (p.role === "stressmark") {
          const s = 0.15 * Math.sin(t * 3.0);
          const dx = p.bx - ANGRY_MARK_CENTER[0];
          const dy = p.by - ANGRY_MARK_CENTER[1];
          const dz = p.bz - ANGRY_MARK_CENTER[2];
          p.dx = dx * s;
          p.dy = dy * s;
          p.dz = dz * s;
        }

        // Dizzy eye spin — orbit face particles around eye centers
        let pbx = p.bx, pby = p.by, pbz = p.bz;
        if (p.role === "dizzyface") {
          const cx = p.bx < 0 ? LEYE_CX : REYE_CX;
          const cy = p.bx < 0 ? LEYE_CY : REYE_CY;
          const edx = p.bx - cx, edy = p.by - cy;
          const a = t * EYE_SPIN_SPEED;
          const ca = Math.cos(a), sa = Math.sin(a);
          const rx2 = cx + edx * ca - edy * sa;
          const ry2 = cy + edx * sa + edy * ca;
          const r2 = rx2 * rx2 + ry2 * ry2;
          if (r2 < 0.99) { pbx = rx2; pby = ry2; pbz = Math.sqrt(1 - r2); }
        }

        if (!reduced) {
          p.vx += Math.sin(t * 0.7 + p.bx * 5) * DRIFT_AMOUNT * dtScale;
          p.vy += Math.cos(t * 0.9 + p.by * 5) * DRIFT_AMOUNT * dtScale;
          p.vz += Math.sin(t * 1.1 + p.bz * 5) * DRIFT_AMOUNT * dtScale;

          p.vx -= p.dx * SPRING_BACK * dtScale;
          p.vy -= p.dy * SPRING_BACK * dtScale;
          p.vz -= p.dz * SPRING_BACK * dtScale;

          const pDamp = Math.pow(0.94, dtScale);
          p.vx *= pDamp; p.vy *= pDamp; p.vz *= pDamp;
          p.dx += p.vx; p.dy += p.vy; p.dz += p.vz;

          const dm = Math.sqrt(p.dx * p.dx + p.dy * p.dy + p.dz * p.dz);
          if (dm > MAX_DISPLACEMENT) {
            const s = MAX_DISPLACEMENT / dm;
            p.dx *= s; p.dy *= s; p.dz *= s;
          }
        }

        const [rx, ry, rz] = rotate3D(pbx + p.dx, pby + p.dy, pbz + p.dz);
        const [sx, sy, sz, sc] = project(rx, ry, rz);

        // 3D sphere-mapped repulsion — front-facing only
        if (!reduced && mouseOnSphere && rz < 0) {
          const dot = p.bx * mwx + p.by * mwy + p.bz * mwz;
          const angDist = Math.acos(Math.max(-1, Math.min(1, dot)));
          if (angDist < REPULSE_ANGLE) {
            const ringOff = (angDist - RING_CENTER) / RING_WIDTH;
            const ring = Math.exp(-ringOff * ringOff);
            const variation = 0.6 + 0.4 * Math.sin(p.pulse * 3.7 + p.bx * 11);
            const force = ring * variation * REPULSE_FORCE;
            const dx = p.bx - mwx, dy = p.by - mwy, dz = p.bz - mwz;
            const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            p.vx += (dx / dl) * force * 0.012 * dtScale;
            p.vy += (dy / dl) * force * 0.012 * dtScale;
            p.vz += (dz / dl) * force * 0.012 * dtScale;
          }
        }

        projected.push({ i, sx, sy, sz, sc, ry });
      }

      // Reset drag delta each frame (consumed by stars)
      dragDx = 0;
      dragDy = 0;

      projected.sort((a, b) => a.sz - b.sz);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Color lerp progress (0..1)
      const lerpT = Math.min(1, (performance.now() - colorLerpStart) / COLOR_LERP_DURATION);

      // Draw a glyph with optional glow underlay (fillText for correct glow compositing)
      const drawGlyph = (
        ch: string, x: number, y: number, fontSize: number, bold: boolean,
        color: [number, number, number], alpha: number,
        glowColor?: [number, number, number], glowMul?: number,
      ) => {
        const sz = Math.round(fontSize);
        ctx.font = `${bold ? "bold " : ""}${sz}px ${FONT}`;
        if (glowColor && glowMul) {
          ctx.fillStyle = `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${(alpha * glowMul).toFixed(2)})`;
          ctx.fillText(ch, x, y);
        }
        ctx.fillStyle = `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha.toFixed(2)})`;
        ctx.fillText(ch, x, y);
      };

      for (const pr of projected) {
        const p = particles[pr.i];
        if (p.role === "hidden") continue;
        const facing = Math.max(0, (-pr.sz + 0.4) * 2.5);
        if (facing < 0.02) continue;

        const glow = 0.3 + Math.sin(p.pulse) * 0.1;
        const fs = Math.max(7, Math.min(18, pr.sc * 0.09));

        if (p.role === "eye" || p.role === "mouth") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          drawGlyph(p.ch, pr.sx, pr.sy, fs * 1.3, true, FACE_COLOR, al, FACE_GLOW, 0.25);
        } else if (p.role === "cheek") {
          const al = Math.min(facing, 1) * (glow + 0.6);
          drawGlyph(p.ch, pr.sx, pr.sy, fs * 1.2, true, CHEEK_COLOR, al);
        } else if (p.role === "angryface") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          drawGlyph(p.ch, pr.sx, pr.sy, fs * 1.3, true, ANGRY_FACE_COLOR, al, ANGRY_FACE_GLOW, 0.25);
        } else if (p.role === "stressmark") {
          const pulse = 0.85 + 0.15 * Math.sin(t * 3.5);
          const al = Math.min(facing, 1) * (glow + 0.7) * pulse;
          const mfs = fs * 1.2 * (0.9 + 0.2 * Math.sin(t * 3.5));
          drawGlyph(p.ch, pr.sx, pr.sy, mfs, true, ANGRY_MARK_COLOR, al, ANGRY_MARK_GLOW, 0.3);
        } else if (p.role === "dizzyface") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          drawGlyph(p.ch, pr.sx, pr.sy, fs * 1.3, true, DIZZY_FACE_COLOR, al, DIZZY_FACE_GLOW, 0.25);
        } else if (p.role === "dizzycheek") {
          const al = Math.min(facing, 1) * (glow + 0.6);
          drawGlyph(p.ch, pr.sx, pr.sy, fs * 1.2, true, DIZZY_CHEEK_COLOR, al);
        } else {
          // Body — uses fillText (color varies per-particle during distressed gradient)
          let bodyColor: [number, number, number];
          if (faceState === "distressed") {
            bodyColor = angryBodyColor(pr.ry);
          } else if (faceState === "dizzy") {
            bodyColor = BODY_COLOR_PALE;
          } else {
            bodyColor = BODY_COLOR;
          }
          if (lerpT < 1) {
            let prevColor: [number, number, number];
            if (prevFaceState === "distressed") {
              prevColor = angryBodyColor(pr.ry);
            } else if (prevFaceState === "dizzy") {
              prevColor = BODY_COLOR_PALE;
            } else {
              prevColor = BODY_COLOR;
            }
            bodyColor = lerpColor(prevColor, bodyColor, lerpT);
          }
          const al = Math.min(facing, 1) * (glow + 0.35);
          ctx.font = `${Math.round(fs)}px ${FONT}`;
          ctx.fillStyle = `rgba(${bodyColor[0] | 0},${bodyColor[1] | 0},${bodyColor[2] | 0},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    // Input handlers
    // --- Shared drag helpers (mouse + touch) ---
    const startDrag = (clientX: number, clientY: number) => {
      if (shakeLocked) return;
      dragging = true;
      dragStartTime = performance.now();
      dragTotalDx = 0;
      lastX = clientX;
      lastY = clientY;
    };

    const moveDrag = (clientX: number, clientY: number) => {
      if (!dragging) return;
      const dx = clientX - lastX, dy = clientY - lastY;
      rotY += dx * 0.01;
      rotX += dy * 0.01;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      lastX = clientX;
      lastY = clientY;
      dragTotalDx += dx;
      spinVelocity = dx * 0.0008;
      dragDx = dx;
      dragDy = dy;
    };

    const startShake = () => {
      shaking = true;
      shakeLocked = true;
      dragging = false;
      spinVelocity = 0;
      const FRONT_FACING = Math.PI;
      autoRotY = Math.round((autoRotY - FRONT_FACING) / (2 * Math.PI)) * 2 * Math.PI + FRONT_FACING;
      rotY = 0;
      shakeStart = performance.now();
      cooldownTimer = window.setTimeout(() => {
        shaking = false;
        cooldownTimer2 = window.setTimeout(() => {
          setFaceState("normal");
          cooldownTimer2 = null;
        }, 500);
      }, SHAKE_DURATION);
    };

    const endDrag = () => {
      if (dragging && performance.now() - dragStartTime < FLICK_WINDOW) {
        spinVelocity = dragTotalDx * FLICK_MULTIPLIER;
      }
      dragging = false;
      if (faceState === "distressed" && !shaking && !shakeLocked) {
        if (cooldownTimer !== null) window.clearTimeout(cooldownTimer);
        cooldownTimer = window.setTimeout(() => {
          cooldownTimer = null;
          startShake();
        }, 500);
      }
      dragFrames = 0;
      dirChanges = 0;
      jerkAccum = 0;
      prevDragDx = 0;
      prevDragDy = 0;
    };

    // --- Mouse handlers ---
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      mouseX = e.clientX - r.left;
      mouseY = e.clientY - r.top;
      mouseActive = mouseX >= 0 && mouseX <= r.width && mouseY >= 0 && mouseY <= r.height;
      moveDrag(e.clientX, e.clientY);
    };

    const onMouseUp = () => { endDrag(); };
    const onMouseLeave = () => { mouseActive = false; };

    // --- Touch handlers ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
      const r = container.getBoundingClientRect();
      mouseX = e.touches[0].clientX - r.left;
      mouseY = e.touches[0].clientY - r.top;
      mouseActive = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const r = container.getBoundingClientRect();
      mouseX = e.touches[0].clientX - r.left;
      mouseY = e.touches[0].clientY - r.top;
      mouseActive = true;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      if (dragging) e.preventDefault();
    };

    const onTouchEnd = () => {
      endDrag();
      mouseActive = false;
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
      if (cooldownTimer2 !== null) window.clearTimeout(cooldownTimer2);
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
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive 3D ASCII globe"
        className="block h-full w-full"
      >Interactive 3D ASCII globe</canvas>
    </div>
  );
}
