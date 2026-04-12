"use client";

import { useState } from "react";
import HackerModal from "@/components/modal/HackerModal";
import { hasMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";
import { mockCurrentUser } from "@/lib/mock";
import { useSubscribedValue } from "@/lib/client-values";

export default function SignInPill() {
  const [modalOpen, setModalOpen] = useState(false);
  const active = useSubscribedValue(
    () => hasMockSession(),
    ["uwuversity:session-change"],
    false,
  );

  const handleClick = () => {
    playSfx("click");
    setModalOpen(true);
  };

  const label = active ? mockCurrentUser.username.toUpperCase() : "SIGN IN";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-9 items-center gap-2 rounded-full border border-fg/80 bg-fg px-5 text-xs font-bold uppercase tracking-[0.2em] text-bg-deep transition-colors hover:border-accent hover:bg-accent hover:text-bg-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            active ? "bg-ok" : "bg-bg-deep/60"
          }`}
        />
        {label}
      </button>
      {modalOpen && (
        <HackerModal onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
