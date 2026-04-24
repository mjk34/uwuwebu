"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { CAT_CYCLE } from "@/lib/news-colors";
import type { NewsCard, Cat } from "@/lib/news";

export type UseCardCarouselStateReturn = {
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredId: string | null;
  setHoveredId: React.Dispatch<React.SetStateAction<string | null>>;
  activeItem: NewsCard | undefined;
  activeCat: Cat;
  expandedId: string | null;
};

/**
 * Carousel state — active/hovered item tracking + auto-select when the
 * active item falls out of the feed. Kept separate from navigation
 * wiring so the tag-filter hook can run downstream without a dep cycle.
 */
export function useCardCarouselState(baseFeed: NewsCard[]): UseCardCarouselStateReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Synchronous setState on feed change is intentional — we want to select
  // the first item immediately rather than render a no-active-card frame.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (baseFeed.length === 0) return;
    if (!baseFeed.find((n) => n.id === activeId)) {
      setActiveId(baseFeed[0].id);
    }
  }, [baseFeed, activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeItem = baseFeed.find((n) => n.id === activeId) || baseFeed[0];
  const expandedId = activeItem?.id ?? null;
  const activeCat: Cat = activeItem?.cat || "world";

  return { activeId, setActiveId, hoveredId, setHoveredId, activeItem, activeCat, expandedId };
}

type UseCarouselNavArgs = {
  baseFeed: NewsCard[];
  filteredNews: NewsCard[];
  activeCat: Cat;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredId: React.Dispatch<React.SetStateAction<string | null>>;
  /** DOM id of the scrolling container for wheel/touch binding. */
  carouselId: string;
  /** Called when wheel/touch cycles into a different category. */
  resetTags: () => void;
};

export type UseCarouselNavReturn = {
  jumpToFirst: (dir?: 1 | -1) => void;
};

/**
 * Wheel/touch navigation + cross-category jump. Separated from state so it
 * can take the downstream `filteredNews` from `useTagFilter`.
 */
export function useCarouselNav({
  baseFeed,
  filteredNews,
  activeCat,
  setActiveId,
  setHoveredId,
  carouselId,
  resetTags,
}: UseCarouselNavArgs): UseCarouselNavReturn {
  // Ref mirror so the stable wheel handler always sees the latest filter.
  const filteredNewsRef = useRef(filteredNews);
  useEffect(() => { filteredNewsRef.current = filteredNews; }, [filteredNews]);

  const jumpToFirst = useCallback((dir: 1 | -1 = 1) => {
    const currentCatIdx = CAT_CYCLE.indexOf(activeCat);
    const step = dir < 0 ? -1 : 1;
    for (let i = 1; i <= CAT_CYCLE.length; i++) {
      const offset = step * i;
      const nextCat = CAT_CYCLE[((currentCatIdx + offset) % CAT_CYCLE.length + CAT_CYCLE.length) % CAT_CYCLE.length];
      const target = baseFeed.find((n) => n.cat === nextCat);
      if (target) {
        playSfx("tick");
        setActiveId(target.id);
        return;
      }
    }
  }, [activeCat, baseFeed, setActiveId]);

  useEffect(() => {
    const el = document.getElementById(carouselId);
    if (!el) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`useCarouselNav: no element with id="${carouselId}" found at mount; wheel/touch unbound`);
      }
      return;
    }
    let lock = false;
    let lockTimer: number | null = null;
    const advance = (dir: 1 | -1) => {
      if (lock) return;
      lock = true;
      if (lockTimer !== null) window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => { lock = false; lockTimer = null; }, 250);
      setHoveredId(null);
      playSfx("tick");
      setActiveId((curId) => {
        const fn = filteredNewsRef.current;
        if (fn.length === 0) return curId;
        const fIdx = fn.findIndex((n) => n.id === curId);
        const safeIdx = fIdx < 0 ? 0 : fIdx;
        const nextF = (safeIdx + dir + fn.length) % fn.length;
        const nextItem = fn[nextF];
        const cur = fn[safeIdx];
        if (cur && nextItem.cat !== cur.cat) resetTags();
        return nextItem.id;
      });
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); advance(e.deltaY > 0 ? 1 : -1); };

    // Touch swipe — 40px vertical threshold; below 8px we let the event pass.
    const SWIPE_THRESHOLD = 40;
    const LOCK_MOVE = 8;
    let touchStartY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { touchStartY = null; return; }
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > LOCK_MOVE) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const t = e.changedTouches && e.changedTouches[0];
      const endY = t ? t.clientY : null;
      const startY = touchStartY;
      touchStartY = null;
      if (endY == null) return;
      const dy = endY - startY;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      advance(dy < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      if (lockTimer !== null) window.clearTimeout(lockTimer);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [carouselId, resetTags, setActiveId, setHoveredId]);

  return { jumpToFirst };
}
