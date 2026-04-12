const GLYPHS = "!<>-_\\/[]{}—=+*^?#________";

export function scrambleStep(target: string, revealedCount: number): string {
  const n = Math.max(0, Math.min(revealedCount, target.length));
  let out = target.slice(0, n);
  for (let i = n; i < target.length; i++) {
    const ch = target[i];
    if (ch === " ") {
      out += " ";
      continue;
    }
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

export function scrambleTicks(target: string, totalTicks: number): number {
  return Math.max(1, Math.ceil(target.length / Math.max(1, totalTicks / target.length)));
}
