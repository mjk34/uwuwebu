"use client";

import { useSyncExternalStore } from "react";
import { menuStore } from "@/lib/menu-store";
import { playSfx } from "@/lib/sfx";

export default function SideMenuToggle() {
  const open = useSyncExternalStore(
    menuStore.subscribe,
    menuStore.getOpen,
    menuStore.getServerOpen,
  );

  const handleClick = () => {
    if (!open) playSfx("menu-open");
    menuStore.toggle();
  };

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="uwuversity-side-menu"
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={handleClick}
      className="group fixed left-5 top-5 z-50 flex h-5 w-5 items-center justify-center rounded-md border border-fg-dim/30 bg-bg-deep/70 backdrop-blur-sm transition-all hover:border-accent/70 hover:bg-bg-raised hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-10 md:w-10"
    >
      <span className="sr-only">{open ? "Close" : "Menu"}</span>
      <span className="relative block h-[7px] w-2.5 md:h-3.5 md:w-5">
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 block h-px w-full bg-fg transition-transform duration-200 md:h-[2px] ${
            open ? "translate-y-[3px] rotate-45 md:translate-y-[6px]" : ""
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0 top-[3px] block h-px w-full bg-fg transition-opacity duration-200 md:top-[6px] md:h-[2px] ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0 top-[6px] block h-px w-full bg-fg transition-transform duration-200 md:top-[12px] md:h-[2px] ${
            open ? "-translate-y-[3px] -rotate-45 md:-translate-y-[6px]" : ""
          }`}
        />
      </span>
    </button>
  );
}
