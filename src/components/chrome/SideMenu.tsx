"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import DecryptLink from "./DecryptLink";
import { menuStore } from "@/lib/menu-store";
import { clearLocal, hasMockSession, LocalKeys } from "@/lib/session";
import { useSubscribedValue } from "@/lib/client-values";
import type { SfxName } from "@/lib/sfx";

type NavItem = {
  label: string;
  href: string;
  desc: string;
  sfx: SfxName;
  disabled?: boolean;
};
type SocialItem = { label: string; href: string };

const NAV: NavItem[] = [
  { label: "H.O.M.E.", href: "/", desc: "Main terminal — uplink status & demo reel", sfx: "tick" },
  { label: "W.O.R.L.D.", href: "/world", desc: "News dashboard", sfx: "tick" },
  { label: "L.E.A.R.N.", href: "/learn", desc: "Leveled Education & Achievement Ranking Network", sfx: "tick", disabled: true },
  { label: "E.V.E.N.T.S.", href: "/events", desc: "Scheduled drops, raids & community ops", sfx: "tick", disabled: true },
  { label: "C.L.I.P.S.", href: "/clip-night", desc: "Peer-reviewed highlight reels & best-of archive", sfx: "tick", disabled: true },
];

const SOCIALS: SocialItem[] = [
  { label: "DISCORD", href: "#discord" },
  { label: "GITHUB", href: "#github" },
];

export default function SideMenu() {
  const open = useSyncExternalStore(
    menuStore.subscribe,
    menuStore.getOpen,
    menuStore.getServerOpen,
  );
  const mockActive = useSubscribedValue(
    () => hasMockSession(),
    ["uwuversity:session-change"],
    false,
  );
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        menuStore.setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'a, button, [tabindex="0"]',
      );
      first?.focus();
    }, 40);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      prev?.focus?.();
    };
  }, [open]);

  const logout = () => {
    clearLocal(LocalKeys.mockSession);
    window.dispatchEvent(new CustomEvent("uwuversity:session-change"));
    menuStore.setOpen(false);
  };

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-bg-deep/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => menuStore.setOpen(false)}
      />
      <aside
        id="uwuversity-side-menu"
        ref={panelRef}
        aria-hidden={!open}
        inert={!open || undefined}
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-full max-w-md flex-col border-r border-fg-dim/30 bg-bg-deep/95 px-10 pt-24 pb-8 backdrop-blur transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-fg-dim">
          {"// UWUVERSITY / PRIMARY"}
        </div>
        <nav className="flex flex-col gap-5">
          {NAV.map((item) => (
            <div key={item.href} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-3">
                <DecryptLink
                  label={item.label}
                  href={item.disabled ? undefined : item.href}
                  as={item.disabled ? "button" : undefined}
                  onClick={item.disabled ? undefined : () => menuStore.setOpen(false)}
                  tickSfx={item.sfx}
                  aria-disabled={item.disabled || undefined}
                  className={
                    item.disabled
                      ? "inline-block cursor-not-allowed text-left text-4xl font-black uppercase tracking-tight text-fg-dim/50 transition-all hover:text-fg-dim/70 focus-visible:text-fg-dim/70 focus-visible:outline-none"
                      : "inline-block text-left text-4xl font-black uppercase tracking-tight text-fg transition-all hover:text-accent hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)] focus-visible:text-accent focus-visible:outline-none"
                  }
                />
                {item.disabled && (
                  <span className="font-mono text-[10px] tracking-[0.2em] text-fg-dim/70">
                    [SOON]
                  </span>
                )}
              </div>
              <span
                className={`pl-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${
                  item.disabled ? "text-fg-dim/60" : "text-fg-dim"
                }`}
              >
                {item.desc}
              </span>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-5 pt-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">
            {"// SOCIAL"}
          </div>
          <nav className="flex flex-col gap-2">
            {SOCIALS.map((s) => (
              <DecryptLink
                key={s.href}
                label={s.label}
                href={s.href}
                className="inline-block text-left text-sm font-semibold uppercase tracking-widest text-fg-muted transition-all hover:text-accent hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)] focus-visible:text-accent focus-visible:outline-none"
              />
            ))}
          </nav>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">
            {"// SESSION"}
          </div>
          {mockActive ? (
            <button
              type="button"
              onClick={logout}
              className="self-start font-mono text-xs uppercase tracking-widest text-danger transition-all hover:text-accent hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)] focus-visible:text-accent focus-visible:outline-none"
            >
              &gt; ./auth/discord --disconnect
            </button>
          ) : (
            <div className="font-mono text-xs uppercase tracking-widest text-fg-dim">
              &gt; not enrolled
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
