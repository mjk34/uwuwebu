"use client";

import { useEffect, useRef } from "react";
import { GLOBE_DATA } from "@/lib/globe-data";

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
const GLOBE_SCALE = 1;         // globe render scale
const SPIN_DELAY = 1;         // seconds before auto-rotation starts
// --- Face state triggers ---
const DIZZY_THRESHOLD = 3 * 2 * Math.PI; // 3 full rotations
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
const LEFT_EYE_CX = -0.42;
const RIGHT_EYE_CX = 0.42;
const EYE_CY = 0.0;
const MOUTH_CY = 0.22;
const EYE_MOUTH_Y_SPLIT = 0.17; // Y threshold: eye (below) vs mouth (above)

// Dizzy eye spin centers and speed
const LEYE_CX = -0.3685, LEYE_CY = -0.0786;
const REYE_CX = 0.3784, REYE_CY = -0.0903;
const EYE_SPIN_SPEED = 1.2;

// Dizzy face particles — @~@ spiral eyes and ~ mouth (baseTp=5)
const DIZZY_FACE_DATA: [number, number, number][] = [
  [-.343,-.274,.899],[.334,-.268,.904],[.376,-.268,.887],[-.471,-.252,.845],[-.448,-.252,.858],
  [-.365,-.252,.897],[-.32,-.252,.914],[-.3,-.252,.92],[.312,-.246,.918],[.357,-.246,.901],
  [.376,-.246,.893],[.421,-.246,.873],[.44,-.246,.864],[-.493,-.229,.839],[-.448,-.229,.864],
  [-.278,-.229,.933],[.27,-.223,.937],[.312,-.223,.924],[.421,-.223,.879],[.462,-.223,.858],
  [-.512,-.21,.833],[.228,-.204,.952],[-.535,-.187,.824],[-.236,-.187,.953],[.228,-.182,.957],
  [.248,-.182,.952],[.485,-.182,.855],[-.557,-.165,.814],[-.535,-.165,.828],[-.407,-.165,.899],
  [-.384,-.165,.909],[-.365,-.165,.917],[-.343,-.165,.925],[-.236,-.165,.958],[.205,-.159,.966],
  [.334,-.159,.929],[.485,-.159,.86],[-.429,-.145,.892],[-.407,-.145,.902],[-.384,-.145,.912],
  [-.365,-.145,.92],[-.214,-.145,.966],[.205,-.139,.969],[.357,-.139,.924],[.376,-.139,.916],
  [.398,-.139,.907],[.505,-.139,.852],[-.557,-.123,.821],[-.471,-.123,.873],[-.429,-.123,.895],
  [-.343,-.123,.931],[.205,-.117,.972],[.312,-.117,.943],[.485,-.117,.866],[.505,-.117,.855],
  [-.214,-.1,.972],[.312,-.094,.945],[.462,-.094,.882],[.485,-.094,.869],[.569,-.094,.817],
  [-.471,-.081,.878],[-.32,-.081,.944],[-.3,-.081,.95],[-.214,-.081,.973],[.205,-.075,.976],
  [.485,-.075,.871],[.569,-.075,.819],[-.493,-.059,.868],[-.343,-.059,.938],[-.32,-.059,.946],
  [-.191,-.059,.98],[.205,-.053,.977],[.312,-.053,.949],[.357,-.053,.933],[.462,-.053,.885],
  [.569,-.053,.821],[-.493,-.036,.869],[-.471,-.036,.881],[-.384,-.036,.923],[-.365,-.036,.93],
  [-.32,-.036,.947],[-.3,-.036,.953],[-.191,-.036,.981],[.205,-.03,.978],[.376,-.03,.926],
  [.398,-.03,.917],[.55,-.03,.835],[-.384,-.017,.923],[-.365,-.017,.931],[-.343,-.017,.939],
  [-.236,-.017,.972],[-.214,-.017,.977],[.228,-.011,.974],[.398,-.011,.917],[.55,-.011,.835],
  [-.493,.005,.87],[-.471,.005,.882],[-.448,.005,.894],[-.255,.005,.967],[-.236,.005,.972],
  [-.214,.005,.977],[.527,.011,.85],[-.471,.028,.882],[-.448,.028,.894],[-.429,.028,.903],
  [-.278,.028,.96],[.27,.034,.962],[.293,.034,.956],[-.448,.048,.893],[-.384,.048,.922],
  [-.3,.048,.953],[-.278,.048,.959],[.334,.053,.941],[.421,.053,.905],[.44,.053,.896],
  [.462,.053,.885],[-.429,.07,.901],[-.407,.07,.911],[-.365,.07,.929],[-.343,.07,.937],
  [-.32,.07,.945],[-.3,.07,.951],[.312,.075,.947],[.334,.075,.94],[.357,.075,.931],
  [.376,.075,.924],[.398,.075,.914],[.462,.075,.883],
];
const DIZZY_FACE_CHARS = ["@", "0", "O", "#", "%", "&"];

// Dizzy cheek particles — wavy ~ line (baseTp=6)
const DIZZY_CHEEK_DATA: [number, number, number][] = [
  [-.22,.25,.943],[-.207,.247,.947],[-.194,.238,.952],[-.181,.226,.957],[-.168,.212,.963],
  [-.155,.2,.967],[-.142,.192,.971],[-.129,.19,.973],[-.116,.194,.974],[-.104,.204,.973],
  [-.091,.217,.972],[-.078,.231,.97],[-.065,.242,.968],[-.052,.249,.967],[-.039,.249,.968],
  [-.026,.244,.969],[-.013,.233,.972],[0,.22,.975],[.013,.207,.978],[.026,.196,.98],
  [.039,.191,.981],[.052,.191,.98],[.065,.198,.978],[.078,.209,.975],[.091,.223,.971],
  [.104,.236,.966],[.116,.246,.962],[.129,.25,.96],[.142,.248,.958],[.155,.24,.958],
  [.168,.228,.959],[.181,.214,.96],[.194,.202,.96],[.207,.193,.959],[.22,.19,.957],
];

// Angry face particles — brows, eyes, frown (left eye mirrored to right for symmetry)
const ANGRY_FACE_DATA: [number, number, number][] = [
  [-.526,-.028,.85],[-.478,.003,.878],[-.503,.023,.864],[-.456,.032,.889],[-.478,.051,.877],
  [-.456,.055,.888],[-.41,.063,.91],[-.385,.068,.92],[-.339,.077,.938],[-.41,.086,.908],
  [-.385,.091,.918],[-.362,.095,.927],[-.339,.1,.936],[-.317,.104,.943],[-.292,.108,.95],
  [-.246,.117,.962],[-.223,.121,.967],[-.199,.126,.972],[-.176,.13,.976],[-.153,.134,.979],
  [-.362,.118,.925],[-.339,.123,.933],[-.317,.127,.94],[-.292,.131,.947],[-.269,.136,.954],
  [-.246,.14,.959],[-.223,.144,.964],[-.199,.149,.969],[-.176,.153,.972],[-.153,.157,.976],
  [-.128,.162,.978],[-.106,.166,.98],[-.339,.147,.929],[-.317,.151,.936],[-.292,.155,.944],
  [-.269,.16,.95],[-.246,.164,.955],[-.199,.173,.965],[-.176,.177,.968],[-.128,.186,.974],
  [-.106,.19,.976],[-.339,.174,.924],[-.317,.174,.932],[-.292,.174,.94],[-.269,.174,.947],
  [-.246,.174,.953],[-.317,.197,.928],[-.269,.197,.943],[-.339,.222,.914],[-.292,.222,.93],
  [-.269,.222,.937],[.526,-.028,.85],[.478,.003,.878],[.503,.023,.864],[.456,.032,.889],
  [.478,.051,.877],[.456,.055,.888],[.41,.063,.91],[.385,.068,.92],[.339,.077,.938],
  [.41,.086,.908],[.385,.091,.918],[.362,.095,.927],[.339,.1,.935],[.317,.104,.943],
  [.292,.108,.95],[.246,.117,.962],[.223,.121,.967],[.199,.126,.972],[.176,.13,.976],
  [.153,.134,.979],[.362,.118,.925],[.339,.123,.933],[.317,.127,.94],[.292,.131,.947],
  [.269,.136,.953],[.246,.14,.959],[.223,.144,.964],[.199,.149,.969],[.176,.153,.972],
  [.153,.157,.976],[.128,.162,.978],[.106,.166,.98],[.339,.147,.929],[.317,.151,.936],
  [.292,.155,.944],[.269,.16,.95],[.246,.164,.955],[.199,.173,.965],[.176,.177,.968],
  [.128,.186,.974],[.106,.19,.976],[.339,.174,.925],[.317,.174,.932],[.292,.174,.94],
  [.269,.174,.947],[.246,.174,.954],[.317,.197,.928],[.269,.197,.943],[.339,.222,.914],
  [.292,.222,.93],[.269,.222,.937],
  [-.125,.423,.897],[-.1,.413,.905],[-.075,.405,.911],[-.05,.4,.915],[-.025,.396,.918],
  [0,.395,.919],[.025,.396,.918],[.05,.4,.915],[.075,.405,.911],[.1,.413,.905],
  [.125,.423,.897],[-.1,.435,.895],[-.075,.427,.901],[-.05,.422,.905],[-.025,.418,.908],
  [0,.417,.909],[.025,.418,.908],[.05,.422,.905],[.075,.427,.901],[.1,.435,.895],
];
const ANGRY_FACE_CHARS = ["X", "V", "#", "@", "%", "W"];

// Angry stress mark particles — upper-right of globe, breathing pulse
const ANGRY_MARK_DATA: [number, number, number][] = [
  [.566,-.526,.635],[.555,-.515,.653],[.577,-.515,.634],[.566,-.504,.652],[.577,-.504,.643],
  [.555,-.493,.67],[.566,-.493,.661],[.577,-.493,.651],[.632,-.493,.598],[.335,-.482,.81],
  [.346,-.482,.805],[.533,-.482,.695],[.632,-.482,.607],[.643,-.482,.595],[.335,-.471,.816],
  [.346,-.471,.811],[.533,-.471,.703],[.632,-.471,.615],[.335,-.46,.822],[.346,-.46,.818],
  [.368,-.46,.808],[.379,-.46,.803],[.555,-.46,.693],[.599,-.46,.655],[.61,-.46,.645],
  [.632,-.46,.624],[.335,-.449,.828],[.522,-.449,.725],[.533,-.449,.717],[.544,-.449,.709],
  [.599,-.449,.663],[.357,-.438,.825],[.368,-.438,.82],[.401,-.427,.81],[.434,-.427,.793],
  [.489,-.427,.761],[.522,-.427,.738],[.577,-.427,.696],[.302,-.416,.858],[.423,-.416,.805],
  [.456,-.416,.787],[.577,-.416,.703],[.324,-.405,.855],[.335,-.405,.851],[.456,-.405,.792],
  [.467,-.405,.786],[.566,-.405,.718],[.335,-.394,.856],[.357,-.394,.847],[.445,-.394,.804],
  [.335,-.383,.861],[.357,-.383,.852],[.379,-.383,.842],[.577,-.383,.721],[.346,-.372,.861],
  [.357,-.372,.857],[.566,-.372,.736],[.346,-.361,.866],[.357,-.361,.862],[.368,-.361,.857],
  [.39,-.361,.847],[.401,-.361,.842],[.566,-.35,.746],[.39,-.339,.856],[.412,-.339,.846],
  [.423,-.339,.84],[.588,-.339,.734],[.599,-.339,.725],[.423,-.328,.845],[.577,-.328,.748],
  [.588,-.328,.739],[.599,-.328,.73],[.61,-.328,.721],[.401,-.317,.859],[.577,-.317,.753],
  [.588,-.306,.749],[.599,-.306,.74],[.401,-.295,.867],[.412,-.295,.862],[.423,-.295,.857],
  [.643,-.295,.707],[.665,-.284,.691],[.676,-.284,.68],[.401,-.273,.874],[.423,-.273,.864],
  [.544,-.273,.793],[.632,-.273,.725],[.654,-.273,.706],[.687,-.273,.673],[.423,-.262,.867],
  [.544,-.262,.797],[.555,-.262,.79],[.676,-.262,.689],[.709,-.262,.655],[.39,-.251,.886],
  [.478,-.251,.842],[.5,-.251,.829],[.511,-.251,.822],[.522,-.251,.815],[.544,-.251,.801],
  [.588,-.251,.769],[.698,-.251,.671],[.412,-.24,.879],[.478,-.24,.845],[.555,-.24,.796],
  [.599,-.24,.764],[.379,-.229,.897],[.456,-.229,.86],[.478,-.229,.848],[.489,-.229,.842],
  [.599,-.229,.767],[.61,-.229,.759],[.643,-.229,.731],[.357,-.218,.908],[.379,-.218,.899],
  [.599,-.218,.771],[.61,-.218,.762],[.621,-.218,.753],[.368,-.207,.906],[.39,-.207,.897],
  [.434,-.207,.877],[.456,-.207,.866],[.643,-.207,.737],[.654,-.207,.728],[.346,-.196,.918],
  [.357,-.196,.913],[.423,-.196,.885],[.434,-.196,.879],[.456,-.196,.868],[.654,-.196,.731],
  [.368,-.185,.911],[.423,-.185,.887],[.456,-.185,.871],[.643,-.185,.743],[.357,-.174,.918],
  [.423,-.174,.889],[.434,-.174,.884],[.401,-.152,.903],[.434,-.152,.888],[.423,-.141,.895],
];
const ANGRY_MARK_CHARS = ["*", "X", "+", "#", "%"];
const ANGRY_MARK_CENTER: [number, number, number] = [0.491, -0.332, 0.787];

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
    let dirChanges = 0;
    let prevDragDx = 0, prevDragDy = 0;
    let shaking = false;      // true during shake animation
    let shakeLocked = false;   // true from shake start until back to normal (blocks all input)
    let shakeStart = 0;
    let cooldownTimer: number | null = null;
    let cooldownTimer2: number | null = null;
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

      if (!dragging && !shaking) {
        // Wait SPIN_DELAY seconds before starting auto-rotation
        if (elapsed > SPIN_DELAY) {
          autoRotY += spinVelocity;
        }
        rotX += (DEF_RX - rotX) * 0.035;
      }

      // --- Face state triggers ---
      cumulativeSpin += Math.abs(spinVelocity);

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
      if (faceState === "normal" && dragging && dirChanges >= 2 &&
          (dragFrames > DRAG_DURATION_THRESHOLD ||
           dirChanges >= DIRECTION_CHANGE_THRESHOLD ||
           jerkAccum > JERK_THRESHOLD)) {
        setFaceState("distressed");
      } else if (faceState === "normal" && !dragging &&
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
        rotX += (DEF_RX - rotX) * 0.035;
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

      const projected: { i: number; sx: number; sy: number; sz: number; sc: number; ry: number }[] = [];

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

        const [rx, ry, rz] = rotate3D(pbx + p.dx, pby + p.dy, pbz + p.dz);
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

      for (const pr of projected) {
        const p = particles[pr.i];
        if (p.role === "hidden") continue;
        const facing = Math.max(0, (-pr.sz + 0.4) * 2.5);
        if (facing < 0.02) continue;

        const glow = 0.3 + Math.sin(p.pulse) * 0.1;
        const fs = Math.max(7, Math.min(18, pr.sc * 0.09));

        if (p.role === "eye") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${FACE_GLOW[0]},${FACE_GLOW[1]},${FACE_GLOW[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${FACE_COLOR[0]},${FACE_COLOR[1]},${FACE_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "mouth") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${FACE_GLOW[0]},${FACE_GLOW[1]},${FACE_GLOW[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${FACE_COLOR[0]},${FACE_COLOR[1]},${FACE_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "cheek") {
          const al = Math.min(facing, 1) * (glow + 0.6);
          ctx.font = `bold ${(fs * 1.2).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${CHEEK_COLOR[0]},${CHEEK_COLOR[1]},${CHEEK_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "angryface") {
          // Angry face features — red with glow
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${ANGRY_FACE_GLOW[0]},${ANGRY_FACE_GLOW[1]},${ANGRY_FACE_GLOW[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${ANGRY_FACE_COLOR[0]},${ANGRY_FACE_COLOR[1]},${ANGRY_FACE_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "stressmark") {
          // Stress mark — pulsing red
          const pulse = 0.85 + 0.15 * Math.sin(t * 3.5);
          const al = Math.min(facing, 1) * (glow + 0.7) * pulse;
          const mfs = fs * 1.2 * (0.9 + 0.2 * Math.sin(t * 3.5));
          ctx.font = `bold ${mfs.toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${ANGRY_MARK_GLOW[0]},${ANGRY_MARK_GLOW[1]},${ANGRY_MARK_GLOW[2]},${(al * 0.3).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${ANGRY_MARK_COLOR[0]},${ANGRY_MARK_COLOR[1]},${ANGRY_MARK_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "dizzyface") {
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${DIZZY_FACE_GLOW[0]},${DIZZY_FACE_GLOW[1]},${DIZZY_FACE_GLOW[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${DIZZY_FACE_COLOR[0]},${DIZZY_FACE_COLOR[1]},${DIZZY_FACE_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else if (p.role === "dizzycheek") {
          const al = Math.min(facing, 1) * (glow + 0.6);
          ctx.font = `bold ${(fs * 1.2).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${DIZZY_CHEEK_COLOR[0]},${DIZZY_CHEEK_COLOR[1]},${DIZZY_CHEEK_COLOR[2]},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        } else {
          // Body — color depends on face state
          let bodyColor: [number, number, number];
          if (faceState === "distressed") {
            bodyColor = angryBodyColor(pr.ry);
          } else if (faceState === "dizzy") {
            bodyColor = BODY_COLOR_PALE;
          } else {
            bodyColor = BODY_COLOR;
          }
          // Lerp from previous state's color if transitioning
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
          ctx.font = `${fs.toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${bodyColor[0] | 0},${bodyColor[1] | 0},${bodyColor[2] | 0},${al.toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    // Input handlers
    const onMouseDown = (e: MouseEvent) => {
      if (shakeLocked) return;
      dragging = true;
      cumulativeSpin = 0;
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
      rotY += dx * 0.01;
      rotX += dy * 0.01;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      lastX = e.clientX;
      lastY = e.clientY;
      spinVelocity = dx * 0.0008;
      dragDx = dx;
      dragDy = dy;
    };

    const startShake = () => {
      shaking = true;
      shakeLocked = true;
      dragging = false;
      spinVelocity = 0;
      // Snap face to front
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

    const onMouseUp = () => {
      dragging = false;
      if (faceState === "distressed" && !shaking) {
        // User let go — cancel the 3s forced timer, shake in 0.5s
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
    const onMouseLeave = () => { mouseActive = false; };

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      if (shakeLocked) return;
      if (e.touches.length === 1) {
        dragging = true;
        cumulativeSpin = 0;
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
        rotY += dx * 0.01;
        rotX += dy * 0.01;
        rotX = Math.max(-1.2, Math.min(1.2, rotX));
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        spinVelocity = dx * 0.0008;
        dragDx = dx;
        dragDy = dy;
      }
      if (dragging) e.preventDefault();
    };

    const onTouchEnd = () => {
      dragging = false;
      mouseActive = false;
      if (faceState === "distressed" && !shaking) {
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
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
