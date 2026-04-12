"use client";

import { useSyncExternalStore } from "react";
import { menuStore } from "@/lib/menu-store";

export default function SideMenuToggle() {
  const open = useSyncExternalStore(
    menuStore.subscribe,
    menuStore.getOpen,
    menuStore.getServerOpen,
  );

  const handleClick = () => {
    menuStore.toggle();
  };

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="uwuversity-side-menu"
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={handleClick}
      className="group fixed left-5 top-5 z-50 flex h-10 w-10 items-center justify-center rounded-md border border-fg-dim/30 bg-bg-deep/70 backdrop-blur-sm transition-colors hover:border-accent/70 hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="sr-only">{open ? "Close" : "Menu"}</span>
      <span className="relative block h-3.5 w-5">
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 block h-[2px] w-full bg-fg transition-transform duration-200 ${
            open ? "translate-y-[6px] rotate-45" : ""
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0 top-[6px] block h-[2px] w-full bg-fg transition-opacity duration-200 ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0 top-[12px] block h-[2px] w-full bg-fg transition-transform duration-200 ${
            open ? "-translate-y-[6px] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}
