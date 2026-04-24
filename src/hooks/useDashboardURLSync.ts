"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Args = {
  mode: "live" | "history";
  setMode: React.Dispatch<React.SetStateAction<"live" | "history">>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  activeTags: string[];
  setActiveTags: React.Dispatch<React.SetStateAction<string[]>>;
};

/**
 * Bidirectional bridge between dashboard state and the URL query string.
 * - On mount: hydrates state from `?mode=`, `?id=`, `?tags=` once.
 * - On state change: rewrites the URL via `router.replace` (no history spam).
 *
 * The `hydrated` gate prevents the sync-out effect from firing with stale
 * initial state before hydration reads the URL, which would otherwise wipe
 * the incoming params.
 */
export function useDashboardURLSync({
  mode,
  setMode,
  activeId,
  setActiveId,
  activeTags,
  setActiveTags,
}: Args): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydratedRef = useRef(false);

  // Hydrate once. Do NOT put searchParams in deps — re-hydrating on URL
  // change would fight the sync-out effect below.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const m = searchParams.get("mode");
    if (m === "history" || m === "live") setMode(m);
    const id = searchParams.get("id");
    if (id) setActiveId(id);
    const tags = searchParams.get("tags");
    if (tags) {
      const parsed = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (parsed.length > 0) setActiveTags(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state → URL. Skip until we've hydrated, so the first render doesn't
  // clobber incoming params with default state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const params = new URLSearchParams();
    if (mode === "history") params.set("mode", "history");
    if (activeId) params.set("id", activeId);
    if (activeTags.length > 0) params.set("tags", activeTags.join(","));
    const query = params.toString();
    const target = `${pathname}${query ? `?${query}` : ""}`;
    // Only replace if the URL would actually change — avoids needless
    // router churn when activeId is auto-selected to match URL on first tick.
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (target !== current) {
      router.replace(target, { scroll: false });
    }
  }, [mode, activeId, activeTags, pathname, router, searchParams]);
}
