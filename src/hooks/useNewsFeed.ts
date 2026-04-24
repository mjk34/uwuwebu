"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNews, type NewsCard, type Cat } from "@/lib/news";
import { CAT_CYCLE } from "@/lib/news-colors";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LIVE_WINDOW = 2 * DAY;
// Per-category cap on displayed cards.
const PER_CAT_CAP = 20;
// Hoisted once — used inside capPerCat's sort comparator.
const CAT_RANK = Object.fromEntries(CAT_CYCLE.map((c, i) => [c, i])) as Record<Cat, number>;

export type NewsMode = "live" | "history";

export type UseNewsFeedReturn = {
  NEWS: NewsCard[];
  newsSource: "live" | "fallback";
  /** Mode-filtered + per-category capped feed, sorted by CAT_CYCLE then recency. */
  baseFeed: NewsCard[];
  liveCount: number;
  historyCount: number;
};

/**
 * One-shot fetch of the news feed + derived buckets. Re-emits `baseFeed`
 * whenever `mode` flips. Consumers downstream key off `baseFeed`.
 */
export function useNewsFeed(mode: NewsMode): UseNewsFeedReturn {
  const [NEWS, setNEWS] = useState<NewsCard[]>([]);
  const [newsSource, setNewsSource] = useState<"live" | "fallback">("live");

  useEffect(() => {
    let cancelled = false;
    fetchNews().then((feed) => {
      if (cancelled) return;
      setNEWS(feed.cards);
      setNewsSource(feed.source);
    }).catch((err) => {
      console.error("[news] fetch failed", err);
    });
    return () => { cancelled = true; };
  }, []);

  // Cap-per-cat with recency-decayed importance score. Keep the top N per
  // category; within each cat, sort by recency. Display order is CAT_CYCLE
  // then recent-first within a cat.
  const capPerCat = useCallback((items: NewsCard[]): NewsCard[] => {
    const HALF_LIFE_H = 12;
    const score = (n: NewsCard) => {
      const ageH = Math.max(0, (Date.now() - n.dateTs) / 3600000);
      const imp = (n.rel || 0) * Math.max(1, n.sourceCount || 1);
      return imp / (1 + ageH / HALF_LIFE_H);
    };
    const byScore = [...items].sort((a, b) => score(b) - score(a));
    const counts: Partial<Record<Cat, number>> = {};
    const kept = byScore.filter((n) => {
      counts[n.cat] = (counts[n.cat] || 0) + 1;
      return (counts[n.cat] || 0) <= PER_CAT_CAP;
    });
    return kept.sort(
      (a, b) => (CAT_RANK[a.cat] ?? 99) - (CAT_RANK[b.cat] ?? 99) || b.dateTs - a.dateTs,
    );
  }, []);

  // Date.now() inside useMemo is flagged as impure, but that's intentional —
  // we want elapsed-time calcs to reflect the current moment on each recompute.
  /* eslint-disable react-hooks/purity */
  const baseFeed = useMemo(() => {
    const isOld = (n: NewsCard) => (Date.now() - n.dateTs) > LIVE_WINDOW;
    const eligible = NEWS.filter((n) => (mode === "live" ? !isOld(n) : isOld(n)));
    return capPerCat(eligible);
  }, [mode, NEWS, capPerCat]);

  // Both counts — hover on the inactive side needs to show that side's total.
  const liveCount = useMemo(
    () => capPerCat(NEWS.filter((n) => (Date.now() - n.dateTs) <= LIVE_WINDOW)).length,
    [NEWS, capPerCat],
  );
  const historyCount = useMemo(
    () => capPerCat(NEWS.filter((n) => (Date.now() - n.dateTs) > LIVE_WINDOW)).length,
    [NEWS, capPerCat],
  );
  /* eslint-enable react-hooks/purity */

  return { NEWS, newsSource, baseFeed, liveCount, historyCount };
}
