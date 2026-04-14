# Globe Reactive Face States

**Date:** 2026-04-14
**File:** `src/components/home/UwuGlobe.tsx` (primary), `src/lib/globe-data.ts` (read-only)

## Overview

The UwU globe gains two reactive face states — **dizzy** and **distressed** — triggered by user interaction. Each state changes the face geometry (which particles form the eyes/mouth), body color, and globe behavior. Both revert to normal after a cooldown.

## Face states

### Normal (default)

- **Eyes:** U U — current `tp=1` geometry in eye regions
- **Mouth:** W — current `tp=1` geometry in mouth region
- **Cheeks:** Current `tp=2` geometry (pink circles)
- **Body color:** Yellow `[250, 220, 120]`
- **Eye color:** Cyan `[20, 255, 200]`
- **Mouth color:** Cyan `[20, 255, 200]`
- **Cheek color:** Pink `[255, 120, 180]`
- **Behavior:** Auto-spin, mouse repulsion

### Dizzy (@~@)

- **Eyes:** @ shape — ring/annulus pattern at each eye center (hollow center, filled band). Conveys spiraling dizziness.
- **Mouth:** ~ shape — sine-wave band across mouth region
- **Cheeks:** Same tp=2 regions as normal
- **Body color:** Pale yellow `[255, 245, 180]`
- **Eye color:** White `[255, 255, 255]`
- **Mouth color:** Cyan `[20, 255, 200]`
- **Cheek color:** Pink `[255, 120, 180]`
- **Behavior:** Auto-spin stops, face snaps to front-facing, globe wobbles (damped sinusoidal oscillation on rotX/rotY)
- **Stress mark:** None

### Distressed (>_<)

- **Eyes:** > < — chevron/V shapes, left eye pointing right, right eye pointing left (mirrored)
- **Mouth:** _ — flat horizontal line
- **Cheeks:** Same tp=2 regions as normal
- **Body color:** Vertical gradient per-particle based on rotated Y coordinate:
  - Top (y ~ -1.0): Hot pink-red `[255, 80, 100]`
  - Middle (y ~ 0.0): Warm orange `[255, 160, 90]`
  - Bottom (y ~ 1.0): Golden yellow `[255, 210, 130]`
  - Gradient follows visual top/bottom (uses rotated Y, not base Y), so the flush stays on top regardless of tilt.
- **Eye color:** Cyan `[20, 255, 200]`
- **Mouth color:** Cyan `[20, 255, 200]`
- **Cheek color:** Pink `[255, 120, 180]`
- **Stress mark:** Manga-style anger vein on upper-right of globe (see Stress Mark section)
- **Behavior:** Normal rotation continues

## Face mask system

### Concept

All 3 face states use the same set of sphere particles from `GLOBE_DATA`. The difference is *which particles* get classified as eye, mouth, cheek, or body. A **face mask** is a function that takes a particle's base position `(bx, by, bz)` and returns a sub-type: `"body"`, `"eye"`, `"mouth"`, or `"cheek"`.

At startup, store each particle's base type from `GLOBE_DATA` as a reference. Each frame, the active mask determines what role each particle plays. The renderer uses the role + current face state to pick color.

### Mask definitions

All masks operate on front-facing particles (roughly `bz > 0.6`). Particles outside this region are always `"body"`.

**Current eye regions** (from GLOBE_DATA analysis):
- Left eye center: approximately `x = -0.56, y = 0.05`
- Right eye center: approximately `x = 0.56, y = 0.05`
- Eye radius: ~0.15 in x/y space

**Current mouth region:**
- Center: approximately `x = 0.0, y = 0.22`
- Width: ~0.3, height: ~0.08

**Current cheek regions:**
- Left: `x ~ -0.67, y ~ 0.33`
- Right: `x ~ 0.67, y ~ 0.33`

#### Normal mask (UwU)
Use the original `tp` values from `GLOBE_DATA` directly:
- `tp=1` in eye region -> `"eye"`
- `tp=1` in mouth region -> `"mouth"`
- `tp=2` -> `"cheek"`
- `tp=0` -> `"body"`

To distinguish eye vs mouth from the flat `tp=1`, use a Y threshold: particles with `by < 0.17` are eyes, `by >= 0.17` are mouth. Tune this value to match the visual split.

#### Dizzy mask (@~@)
- **Eyes:** Ring/annulus test at each eye center. A particle is an eye if:
  `innerRadius < distance(particle, eyeCenter) < outerRadius`
  This creates the hollow @ look. Approximate: inner=0.05, outer=0.13.
- **Mouth:** Sine wave band. A particle is mouth if:
  `|by - (mouthCenterY + amplitude * sin(bx * frequency))| < bandWidth`
  Approximate: amplitude=0.04, frequency=8, bandWidth=0.03.
- **Cheeks:** Same region test as normal.
- Everything else: `"body"`.

#### Distressed mask (>_<)
- **Left eye (>):** Two diagonal lines meeting at a point. A particle is an eye if it's near either arm:
  `|by - leftEyeCenter.y - slope * (bx - leftEyeCenter.x)| < lineWidth` OR
  `|by - leftEyeCenter.y + slope * (bx - leftEyeCenter.x)| < lineWidth`
  With `bx < leftEyeCenter.x` (arms extend leftward from tip). Slope ~1.5, lineWidth ~0.025.
- **Right eye (<):** Mirrored — arms extend rightward.
- **Mouth (_):** Horizontal band:
  `|by - mouthCenterY| < lineWidth AND |bx| < mouthHalfWidth`
  Approximate: lineWidth=0.02, mouthHalfWidth=0.15.
- **Cheeks:** Same region test as normal.
- Everything else: `"body"`.

### Mask tuning

The exact thresholds (radii, slopes, line widths) will need visual tuning against the actual particle density. The values above are starting estimates from the GLOBE_DATA coordinate ranges. Approach: get the math right, then adjust constants until the shapes read clearly.

## Stress mark (distressed only)

- **What:** Manga-style anger cross/vein — a cluster of ASCII characters forming a cruciform shape
- **Position:** Upper-right of the sphere surface, approximately `(x=0.4, y=-0.5)` with `z > 0` (front-facing)
- **Particle type:** New type `tp=3`. These are NOT in `GLOBE_DATA` — they're a small fixed set of ~5 positions generated at runtime only during distressed state.
- **Shape:** One center particle + 4 arm particles offset in a cross pattern. Arms curve slightly outward.
- **Characters:** Randomly picked from `["#", "+", "*"]`, re-randomized each frame for twitchy effect
- **Color:** Solid red `[255, 60, 60]` with glow layer (same render technique as face glow — draw twice, once larger and translucent, once sharp)
- **Size:** Slightly larger than body chars (fs * 1.2)
- **Animation:** Pulse scale/opacity — `0.8 + sin(t * 8) * 0.2` for a throbbing angry feel
- **Rendering:** Included in the normal depth-sorted particle pass so it rotates with the globe and occludes/is occluded correctly
- **Lifecycle:** Appears when entering distressed state, disappears on recovery to normal

## Trigger mechanics

### Dizzy trigger

Track cumulative spin intensity each frame:

```
cumulativeSpin += |spinVelocity|
cumulativeSpin *= 0.995          // slow decay per frame
```

When `cumulativeSpin > DIZZY_THRESHOLD` (~0.8, tune visually) AND not currently dragging:
1. Set face state to `"dizzy"`
2. Stop auto-rotation (`spinVelocity = 0`)
3. Snap `autoRotY` so face is front-facing (nearest multiple of 2*PI)
4. Begin wobble animation (see below)
5. Start 3s cooldown timer

After cooldown:
1. Set face state to `"normal"`
2. Resume auto-rotation at `DEF_VY`
3. Reset `cumulativeSpin = 0`

### Distressed trigger

Track two metrics while dragging:

```
// Duration: frames spent dragging (reset on mouseup)
dragFrames += 1                         // each frame while dragging

// Jerk: accumulated movement intensity
jerkAccum += |dragDx| + |dragDy|        // each frame while dragging
jerkAccum *= 0.98                       // decay per frame (even while dragging)
```

Enter distressed when EITHER:
- `dragFrames > DRAG_DURATION_THRESHOLD` (~180, i.e. ~3s at 60fps)
- `jerkAccum > JERK_THRESHOLD` (~50, tune visually)

On entering distressed:
1. Set face state to `"distressed"`
2. Spawn stress mark particles

On mouse/touch release while distressed:
1. Start 3s cooldown timer
2. After cooldown: set face state to `"normal"`, remove stress mark, reset accumulators

### Priority

If both triggers would fire simultaneously, distressed wins (active grab takes precedence). Dizzy can only activate while `dragging === false`.

## Wobble animation (dizzy only)

On entering dizzy state:
- Record `wobbleStart = performance.now()`
- Each frame during dizzy, apply oscillation:
  ```
  elapsed = (now - wobbleStart) / 1000
  decay = exp(-elapsed * 1.5)          // exponential damping
  rotX += sin(elapsed * 6) * 0.08 * decay
  rotY += cos(elapsed * 7) * 0.06 * decay
  ```
- The slightly different frequencies on X vs Y create a wobbly Lissajous-like pattern
- Damping brings it to rest within ~2s, then the globe sits still for the remaining ~1s of cooldown

## Color transitions

When face state changes, lerp all colors from current to target over 0.3s (18 frames at 60fps). Track a `colorTransitionProgress` value: 0 at state change, increments to 1 over 0.3s.

For the distressed body gradient, the lerp target for each particle is computed from its rotated Y coordinate each frame (since the gradient follows orientation).

## Renderer changes

The current render block at ~line 400 switches on `p.tp` (0, 1, 2). This needs to change:

1. **Before rendering:** For each particle, compute its current role via the active mask function. Cache this in a `role` field on the particle (updated each frame when state changes, or on state transition only if performance is a concern).

2. **Render switch:** Instead of `if (p.tp === 1)`, switch on the computed role AND the current face state to determine:
   - Which color to use (eye color depends on state: cyan for normal/distressed, white for dizzy)
   - Which font weight/size to use
   - Whether to draw glow layer

3. **Stress mark particles:** When in distressed state, append the 5 stress mark positions to the projected list before depth sorting. Render them with the stress mark color and glow.

## Data flow summary

```
GLOBE_DATA (static)
    |
    v
buildParticles() -- stores base (bx, by, bz) and original tp
    |
    v
frame() each tick:
    |-- check triggers -> maybe transition faceState
    |-- active mask(faceState) classifies each particle -> role
    |-- wobble logic (if dizzy)
    |-- color lerp (if transitioning)
    |-- render: role + faceState -> color, size, glow
    |-- stress mark (if distressed): inject extra particles
```

## Constants to tune

| Constant | Starting value | What it controls |
|----------|---------------|------------------|
| `DIZZY_THRESHOLD` | 0.8 | Cumulative spin needed to trigger dizzy |
| `SPIN_DECAY` | 0.995 | Per-frame decay of cumulative spin |
| `DRAG_DURATION_THRESHOLD` | 180 | Frames of continuous drag before distressed (~3s) |
| `JERK_THRESHOLD` | 50 | Accumulated jerk intensity for distressed |
| `JERK_DECAY` | 0.98 | Per-frame decay of jerk accumulator |
| `COOLDOWN_DURATION` | 3000 | ms before reverting to normal |
| `COLOR_LERP_DURATION` | 300 | ms for color transition |
| `WOBBLE_DAMPING` | 1.5 | Exponential decay rate for wobble |
| `WOBBLE_FREQ_X` | 6 | Wobble oscillation frequency (X axis) |
| `WOBBLE_FREQ_Y` | 7 | Wobble oscillation frequency (Y axis) |
| `WOBBLE_AMP_X` | 0.08 | Wobble amplitude (X axis) |
| `WOBBLE_AMP_Y` | 0.06 | Wobble amplitude (Y axis) |
| `EYE_INNER_R` | 0.05 | @ eye inner radius (dizzy) |
| `EYE_OUTER_R` | 0.13 | @ eye outer radius (dizzy) |
| `WAVE_AMPLITUDE` | 0.04 | ~ mouth wave height (dizzy) |
| `WAVE_FREQUENCY` | 8 | ~ mouth wave cycles (dizzy) |
| `CHEVRON_SLOPE` | 1.5 | > < eye angle (distressed) |
| `LINE_WIDTH` | 0.025 | Thickness of mask shape lines |

## Scope

All changes are confined to `UwuGlobe.tsx`. No new files, no new dependencies, no changes to `globe-data.ts`. The particle type system is extended at runtime only.
