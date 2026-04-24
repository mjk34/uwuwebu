"use client";

// Module-level singleton — mirrors the `prefers-reduced-motion` media query.
// Components that read this in per-frame loops (Three.js animate, canvas draw)
// benefit from avoiding a matchMedia call + subscription per effect.

let reduced = false;
if (typeof window !== "undefined") {
  try {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = mql.matches;
    // Single-slot handler — using onchange (not addEventListener) avoids
    // stacking duplicate listeners on dev HMR/fast-refresh module reloads.
    mql.onchange = (e) => { reduced = e.matches; };
  } catch {
    // Old browser with no matchMedia support — stay at default (motion enabled).
  }
}

export function isReducedMotion(): boolean {
  return reduced;
}
