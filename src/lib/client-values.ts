"use client";

import { useSyncExternalStore } from "react";

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
