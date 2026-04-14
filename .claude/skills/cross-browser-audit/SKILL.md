---
name: cross-browser-audit
description: Use when reviewing or completing frontend code that uses Web APIs (Audio, Canvas, Touch, MediaQuery, autoplay), or when asked to check cross-browser compatibility. Targets Chrome, Edge, Firefox, and Safari (including iOS).
---

# cross-browser-audit

Systematic audit of frontend code for cross-browser issues across Chrome, Edge, Firefox, and Safari. Walk each category, flag issues, report findings.

## When to use

- After implementing features that touch Web APIs (audio, canvas, touch, media queries)
- Before shipping any interactive/animated component
- When asked to "check cross-browser" or "harden for browsers"
- After fixing a browser-specific bug (audit for siblings)

## Audit checklist

Work through each category against every changed file. Skip categories that don't apply.

### 1. Audio & autoplay

| Issue | Detail |
|-------|--------|
| AudioContext creation | Wrap in try/catch. Use `webkitAudioContext` fallback. A suspended context must not block UI. |
| Autoplay policy | `audio.play()` without a user gesture silently fails on all browsers. Safari is strictest. |
| Gesture unlocking | `play()` must be called synchronously inside the gesture handler. Don't use `{ once: true }` on the listener -- if `play()` rejects (buffer not ready on Safari), the listener is gone. Retry until `play()` resolves, then remove. |
| Audio in animations | Audio failures must never block visual transitions. Wrap call sites in try/catch independent of whether the audio functions themselves are guarded. |

### 2. Canvas

| Issue | Detail |
|-------|--------|
| CSS variables in `ctx.font` | Canvas doesn't participate in the CSS cascade. `var(--foo)` silently fails -- canvas uses browser default font (~10px). Resolve via `getComputedStyle(document.documentElement).getPropertyValue('--var').trim()` at mount, not per-frame. |
| Font string quoting | Next.js CSS variable values may be quoted (`'__GeistMono_abc123'`). Canvas font parsing handles this, but verify the resolved string isn't empty. |
| DPR scaling | Always read `devicePixelRatio`, scale canvas dimensions, and `setTransform` accordingly. Safari on Retina displays renders blurry without this. |

### 3. Touch & pointer events

| Issue | Detail |
|-------|--------|
| `preventDefault` scope | Never call `e.preventDefault()` unconditionally on `touchmove` -- it blocks all scrolling. Only prevent default when the user is actively interacting (e.g., `dragging` flag is true). |
| Passive listeners | Chrome defaults `touchstart`/`touchmove` to passive on document-level targets. If you need `preventDefault`, register with `{ passive: false }` on the specific container element, not `document`. |
| Pointer vs touch | Use `pointerdown`/`pointermove` for unified input when possible. Fall back to separate `mouse*`/`touch*` only when you need multi-touch or touch-specific data. |

### 4. Performance (per-frame traps)

| Issue | Detail |
|-------|--------|
| `matchMedia` in rAF | `window.matchMedia()` creates a new `MediaQueryList` object each call. Cache it once before the frame loop. Listen for `change` events to update. |
| `getComputedStyle` in rAF | Resolve CSS values at mount or on resize, not per-frame. |
| `getBoundingClientRect` in rAF | Acceptable if needed for mouse position, but cache on resize if used for layout constants. |

### 5. State & render timing

| Issue | Detail |
|-------|--------|
| React state batching | When two state updates control different render branches (e.g., `setDisplay` + `setHovered`), set the data state first, then the branch-switching state. Otherwise one frame renders with stale data in the new branch. |
| CSS transition + unmount | If a component fades out then unmounts, ensure the timeout matches the CSS `transition-duration`. Safari sometimes fires `transitionend` late. |

### 6. Navigation & interactive elements

| Issue | Detail |
|-------|--------|
| Dead links | Verify every interactive element has a working `href` or `onClick`. `as="button"` with no handler = dead click. |
| Next.js `<Link>` + onClick | `onClick` on a Next.js `<Link>` fires alongside client-side navigation. Don't `e.preventDefault()` unless you're canceling navigation intentionally. |

## Report format

After auditing, produce:

```
## Cross-browser audit: <component/area>

| # | Category | File | Issue | Severity | Browsers |
|---|----------|------|-------|----------|----------|
| 1 | Audio    | sfx.ts | No try/catch on AudioContext setup | High | Edge, Safari |
| 2 | Canvas   | Globe.tsx | CSS var in ctx.font | Medium | All |
| ... | | | | | |

**No issues found in:** <list clean categories>
```

Severity:
- **High** -- feature broken or page crashes
- **Medium** -- silent failure, degraded experience
- **Low** -- console warning, cosmetic

## Gotchas

- Safari iOS is almost always the strictest browser. If it works on iOS Safari, it likely works everywhere.
- Edge is Chromium-based but has its own AudioContext quirks (suspended state handling differs).
- Firefox is the most permissive with autoplay and gesture requirements -- don't use it as your only test browser.
- `{ once: true }` on event listeners is dangerous for any handler where the callback might fail -- the listener is removed regardless of whether the callback succeeded.
- Canvas font size bugs are invisible -- canvas silently falls back to a default font if parsing fails, so the text still renders, just wrong.
