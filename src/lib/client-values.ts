"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function useMountedValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}

export function useSubscribedValue<T>(
  read: () => T,
  events: string[],
  serverValue: T,
): T {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      for (const e of events) window.addEventListener(e, cb);
      return () => {
        for (const e of events) window.removeEventListener(e, cb);
      };
    },
    read,
    () => serverValue,
  );
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
