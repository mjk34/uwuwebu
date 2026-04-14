# Globe Reactive Face States — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dizzy (@~@) and distressed (>_<) reactive face states to the UwU globe, triggered by spinning and grabbing.

**Architecture:** Extend the particle system with a face mask layer that reclassifies particles into roles (eye/mouth/cheek/body) based on the active face state. Track spin/drag metrics each frame to trigger state transitions. All changes in one file.

**Tech Stack:** Canvas 2D, requestAnimationFrame, pure math (no dependencies)

**Spec:** `docs/superpowers/specs/2026-04-14-globe-face-states-design.md`

---

## File map

- Modify: `src/components/home/UwuGlobe.tsx` (all tasks)

No new files. No dependency changes.

---

### Task 1: Add face state types, constants, and particle role field

Extend the type system and constants. No behavior change yet — the globe renders identically after this task.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx:1-91`

- [ ] **Step 1: Add face state type, role type, and new constants**

After the existing `CHEEK_COLOR` constant (line 9), add:

```typescript
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
```

After `SPIN_DELAY` (line 22), add:

```typescript
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
```

- [ ] **Step 2: Add `role` field to Particle type and `baseTp` field**

Replace the `Particle` type:

```typescript
type Particle = {
  bx: number; by: number; bz: number;
  dx: number; dy: number; dz: number;
  vx: number; vy: number; vz: number;
  tp: number; baseTp: number; ch: string;
  role: ParticleRole;
  pulse: number; pulseSpeed: number;
};
```

- [ ] **Step 3: Update `buildParticles` to set `baseTp` and initial `role`**

Replace the `buildParticles` function:

```typescript
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
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Compiles successfully. Globe renders identically — `role` is set but not yet used by the renderer.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): add face state types, constants, and particle role field"
```

---

### Task 2: Implement face mask functions

Three pure functions that reclassify particles based on face state. No wiring yet — just the math.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx` (after `buildStars`, before `UwuGlobe` component)

- [ ] **Step 1: Add the three mask functions**

Insert after `buildStars` (after line 139), before `export default function UwuGlobe()`:

```typescript
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
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Compiles. Functions defined but not called yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): implement face mask functions for normal, dizzy, distressed"
```

---

### Task 3: Add face state tracking and trigger logic

Wire up the state machine inside `frame()`. Track spin accumulation, drag duration, jerk, and cooldown timers.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx` (inside `useEffect`, ~line 147-178 and ~line 218-229)

- [ ] **Step 1: Add state variables after existing `let` declarations (line 177)**

After `let dragDx = 0, dragDy = 0;` add:

```typescript
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
      }
      if (next === "normal") {
        spinVelocity = DEF_VY;
        cumulativeSpin = 0;
        dragFrames = 0;
        jerkAccum = 0;
      }
    };
```

- [ ] **Step 2: Add trigger checks at the top of `frame()`, after the existing `if (!dragging)` block**

After the closing `}` of the `if (!dragging)` block (~line 229), add:

```typescript
      // --- Face state triggers ---
      // Dizzy: cumulative spin (only when not dragging and not already in a state)
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
```

- [ ] **Step 3: Update `onMouseUp` and `onTouchEnd` to handle distressed cooldown and reset drag tracking**

Replace `onMouseUp`:

```typescript
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
```

Replace `onTouchEnd`:

```typescript
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
```

- [ ] **Step 4: Add dizzy cooldown — in `setFaceState`, start timer when entering dizzy**

Update `setFaceState` — after the `if (next === "dizzy")` block, add:

```typescript
      if (next === "dizzy") {
        spinVelocity = 0;
        autoRotY = Math.round(autoRotY / (2 * Math.PI)) * 2 * Math.PI;
        wobbleStart = performance.now();
        cooldownTimer = window.setTimeout(() => {
          setFaceState("normal");
          cooldownTimer = null;
        }, COOLDOWN_DURATION);
      }
```

(This replaces the earlier dizzy block in `setFaceState` from Step 1 — include the timer.)

- [ ] **Step 5: Clean up cooldown timer on unmount**

In the cleanup return function, add before the existing `cancelAnimationFrame`:

```typescript
      if (cooldownTimer !== null) window.clearTimeout(cooldownTimer);
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Compiles. State transitions happen but rendering hasn't changed yet (roles are assigned but renderer still uses old `p.tp` logic).

- [ ] **Step 7: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): add face state tracking and trigger logic"
```

---

### Task 4: Update renderer to use roles and face-state-dependent colors

Replace the old `p.tp`-based render switch with role+state rendering, including color lerp.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx` (~line 400-426, the render loop)

- [ ] **Step 1: Add color helper functions before `frame()`**

Insert after `applyMask` and before the component function:

```typescript
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
```

- [ ] **Step 2: Update the projected array to include rotated Y**

In the `projected` array type declaration, add `ry`:

```typescript
      const projected: { i: number; sx: number; sy: number; sz: number; sc: number; ry: number }[] = [];
```

In the projection loop where `projected.push(...)` is called, include the rotated Y:

```typescript
        projected.push({ i, sx, sy, sz, sc, ry });
```

This requires capturing `ry` from the `rotate3D` call. The existing line is:
```typescript
        const [rx, ry, rz] = rotate3D(p.bx + p.dx, p.by + p.dy, p.bz + p.dz);
```
The variable `ry` is already available — just pass it through.

- [ ] **Step 3: Replace the render loop (the `for (const pr of projected)` block)**

Replace the entire block from `for (const pr of projected) {` through the closing `}` before `rafRef.current = requestAnimationFrame(frame);`:

```typescript
      // Color lerp progress (0..1)
      const lerpT = Math.min(1, (performance.now() - colorLerpStart) / COLOR_LERP_DURATION);

      for (const pr of projected) {
        const p = particles[pr.i];
        const facing = Math.max(0, (-pr.sz + 0.4) * 2.5);
        if (facing < 0.02) continue;

        const glow = 0.3 + Math.sin(p.pulse) * 0.1;
        const fs = Math.max(7, Math.min(18, pr.sc * 0.09));

        if (p.role === "eye") {
          const eyeColor = faceState === "dizzy" ? EYE_COLOR_WHITE : FACE_COLOR;
          const eyeGlow = faceState === "dizzy" ? EYE_COLOR_WHITE : FACE_GLOW;
          const al = Math.min(facing, 1) * (glow + 0.7);
          ctx.font = `bold ${(fs * 1.3).toFixed(1)}px ${FONT}`;
          ctx.fillStyle = `rgba(${eyeGlow[0]},${eyeGlow[1]},${eyeGlow[2]},${(al * 0.25).toFixed(2)})`;
          ctx.fillText(p.ch, pr.sx, pr.sy);
          ctx.fillStyle = `rgba(${eyeColor[0]},${eyeColor[1]},${eyeColor[2]},${al.toFixed(2)})`;
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
        } else {
          // Body — color depends on face state
          let bodyColor: [number, number, number];
          if (faceState === "distressed") {
            bodyColor = angryBodyColor(pr.ry); // actual rotated Y for gradient
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
```

- [ ] **Step 4: Verify build passes and test visually**

Run: `npm run build`
Then: `npm run dev` — spin the globe fast to trigger dizzy, drag long/hard to trigger distressed. Verify:
- Dizzy: body goes pale yellow, eyes go white, globe wobbles then recovers
- Distressed: body gets red→orange→yellow gradient, face shows >_< (chevron eyes, flat mouth)
- Normal: reverts after cooldown

- [ ] **Step 5: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): render particles by role with face-state colors and lerp"
```

---

### Task 5: Add stress mark particles for distressed state

Inject the anger vein cross into the particle render pipeline during distressed state.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx` (render section, after projected sort)

- [ ] **Step 1: Inject stress mark entries into the projected array**

After `projected.sort((a, b) => a.sz - b.sz);` and before the `// Color lerp progress` line, add:

```typescript
      // Stress mark particles (distressed only)
      if (faceState === "distressed") {
        const stressPulse = 0.8 + Math.sin(t * 8) * 0.2;
        for (let si = 0; si < STRESS_POSITIONS.length; si++) {
          const sp = STRESS_POSITIONS[si];
          const [srx, sry, srz] = rotate3D(sp[0], sp[1], sp[2]);
          const [ssx, ssy, ssz, ssc] = project(srx, sry, srz);
          // Only render if front-facing
          if (srz < 0.4) {
            const sFacing = Math.max(0, (-ssz + 0.4) * 2.5);
            if (sFacing > 0.02) {
              const sfs = Math.max(7, Math.min(18, ssc * 0.09)) * 1.2;
              const sal = Math.min(sFacing, 1) * stressPulse;
              const sCh = STRESS_CHARS[(Math.random() * STRESS_CHARS.length) | 0];
              // Glow layer
              ctx.font = `bold ${(sfs * 1.4).toFixed(1)}px ${FONT}`;
              ctx.fillStyle = `rgba(${STRESS_COLOR[0]},${STRESS_COLOR[1]},${STRESS_COLOR[2]},${(sal * 0.3).toFixed(2)})`;
              ctx.fillText(sCh, ssx, ssy);
              // Sharp layer
              ctx.font = `bold ${sfs.toFixed(1)}px ${FONT}`;
              ctx.fillStyle = `rgba(${STRESS_COLOR[0]},${STRESS_COLOR[1]},${STRESS_COLOR[2]},${sal.toFixed(2)})`;
              ctx.fillText(sCh, ssx, ssy);
            }
          }
        }
      }
```

Note: The stress marks are rendered after the depth-sorted particles. Since they sit on the upper-right surface (z > 0.7), they'll naturally be in front of most body particles. For simplicity, they render on top; if depth interleaving is needed later, they can be inserted into the projected array before sorting.

- [ ] **Step 2: Verify build and test visually**

Run: `npm run build`
Then: `npm run dev` — drag the globe for >3s or jerk it aggressively. Verify:
- Red cruciform stress mark appears on upper-right of globe
- Characters twitch (re-randomized each frame)
- Pulses in opacity
- Rotates with the globe
- Disappears when state reverts to normal

- [ ] **Step 3: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): add stress mark particles for distressed state"
```

---

### Task 6: Tune and polish

Visual tuning pass. Adjust mask thresholds, trigger sensitivity, and color values so all three faces read clearly.

**Files:**
- Modify: `src/components/home/UwuGlobe.tsx` (constants section)

- [ ] **Step 1: Run dev server and test each state**

Run: `npm run dev`

Test matrix:
- [ ] Normal: UwU face, yellow body, auto-spin works
- [ ] Dizzy trigger: spin globe fast with mouse flicks, verify @~@ appears
- [ ] Dizzy visuals: pale yellow body, white eyes, globe wobbles, face front-facing
- [ ] Dizzy recovery: after 3s cooldown, reverts to normal, auto-spin resumes
- [ ] Distressed trigger (duration): grab and hold for 3+ seconds
- [ ] Distressed trigger (jerk): rapid aggressive dragging
- [ ] Distressed visuals: gradient body, >_< face, stress mark
- [ ] Distressed recovery: release, wait 3s, reverts to normal
- [ ] Priority: distressed wins over dizzy when both could trigger
- [ ] Color transitions: smooth lerp between states (no jarring pops)
- [ ] Mobile touch: all triggers work on touch devices

- [ ] **Step 2: Adjust constants as needed**

Common tuning adjustments:
- If dizzy triggers too easily: increase `DIZZY_THRESHOLD`
- If dizzy triggers too rarely: decrease `DIZZY_THRESHOLD` or `SPIN_DECAY`
- If @ eyes don't look ring-like: adjust `EYE_INNER_R` and `EYE_OUTER_R`
- If ~ mouth isn't visible: increase `WAVE_BAND` or `WAVE_AMPLITUDE`
- If > < eyes are too thin: increase `CHEVRON_LINE_W`
- If _ mouth is too short: increase `FLAT_MOUTH_HW`
- If wobble is too aggressive: decrease `WOBBLE_AMP_X`/`WOBBLE_AMP_Y`
- If wobble damps too fast: decrease `WOBBLE_DAMPING`

- [ ] **Step 3: Final build check**

Run: `npm run build`
Expected: Clean compile, no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/UwuGlobe.tsx
git commit -m "feat(globe): tune face state thresholds and mask geometry"
```
