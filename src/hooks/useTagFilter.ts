"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsCard, Cat } from "@/lib/news";

// Source of truth: uwuwebu-pipeline/config/tag_enums.yaml. Keep in sync.
const ALL_TAGS: Record<Cat, string[]> = {
  world: ["WAR", "POLITICS", "DIPLOMACY", "CLIMATE", "DISASTER", "SOCIETY", "HEALTH", "CRIME"],
  investments: ["MACRO", "MARKETS", "CRYPTO", "CORPORATE", "BANKING", "COMMODITIES", "REALESTATE", "CURRENCY"],
  cyber: ["BREACH", "RANSOMWARE", "NATIONSTATE", "EXPLOIT", "MALWARE", "PHISHING", "AI", "PRIVACY"],
  // Science: Subject (QUANTUM/PHYSICS/SPACE/CLIMATE/BIO) + story type (DISCOVERY/RESEARCH/MISSION).
  science: ["QUANTUM", "PHYSICS", "SPACE", "CLIMATE", "BIO", "DISCOVERY", "RESEARCH", "MISSION"],
};

export type UseTagFilterReturn = {
  activeTags: string[];
  setActiveTags: React.Dispatch<React.SetStateAction<string[]>>;
  toggleTag: (t: string) => void;
  /** baseFeed filtered by active tags (only affects the active category). */
  filteredNews: NewsCard[];
  /** Tags present in the active category within the current baseFeed. */
  availableTags: string[];
};

/**
 * Tag filter applies only to the active category; cards from other cats pass
 * through unchanged. Filters reset whenever the active cat or mode changes.
 */
export function useTagFilter(
  baseFeed: NewsCard[],
  activeCat: Cat,
  mode: string,
): UseTagFilterReturn {
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Reset on category or mode change — tag context is cat-local.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveTags([]); }, [activeCat, mode]);

  const toggleTag = useCallback((t: string) => {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }, []);

  const filteredNews = useMemo(() => {
    if (activeTags.length === 0) return baseFeed;
    return baseFeed.filter((n) => {
      if (n.cat !== activeCat) return true;
      return activeTags.some((t) => n.tags.includes(t));
    });
  }, [activeTags, activeCat, baseFeed]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const n of baseFeed) if (n.cat === activeCat) for (const t of n.tags) tagSet.add(t);
    return ALL_TAGS[activeCat].filter((t) => tagSet.has(t));
  }, [activeCat, baseFeed]);

  return { activeTags, setActiveTags, toggleTag, filteredNews, availableTags };
}
