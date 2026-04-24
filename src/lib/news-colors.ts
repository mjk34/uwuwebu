import type { Cat } from "@/lib/news";

// Three.js hex color literals (numeric) per category.
export const C3: Record<Cat, number> = {
  world: 0xff2a6d,
  investments: 0x05ffa1,
  cyber: 0x00f0ff,
  science: 0xd946ef,
};

// CSS hex color strings per category.
export const CH: Record<Cat, string> = {
  world: "#ff2a6d",
  investments: "#05ffa1",
  cyber: "#00f0ff",
  science: "#d946ef",
};

export const CAT_LABELS: Record<Cat, string> = {
  world: "WORLD NEWS",
  investments: "ECONOMICS",
  cyber: "TECHNOLOGY",
  science: "SCIENCE",
};

export const CAT_CYCLE: Cat[] = ["world", "investments", "cyber", "science"];
