"use client";

import { useState } from "react";
import HackerModal from "@/components/modal/HackerModal";
import { hasMockSession } from "@/lib/session";
import { playSfx } from "@/lib/sfx";
import { mockCurrentUser } from "@/lib/mock";
import { useSubscribedValue } from "@/lib/client-values";
import { useScramble } from "@/hooks/useScramble";

const HOVER_TEXT = "LOCK IN";
const SCRAMBLE_DURATION = 400;
const SCRAMBLE_INTERVAL = 30;

export default function SignInPill() {
  const [modalOpen, setModalOpen] = useState(false);
  const active = useSubscribedValue(
    () => hasMockSession(),
    ["uwuversity:session-change"],
    false,
  );

  const defaultLabel = active ? mockCurrentUser.username.toUpperCase() : "SIGN IN";

  const { display, scrambleTo } = useScramble(defaultLabel, {
    duration: SCRAMBLE_DURATION,
    interval: SCRAMBLE_INTERVAL,
  });

  const [showing, setShowing] = useState(false);

  const handleEnter = () => {
    setShowing(true);
    scrambleTo(HOVER_TEXT);
  };

  const handleLeave = () => {
    scrambleTo(defaultLabel, { onDone: () => setShowing(false) });
  };

  const handleClick = () => {
    playSfx("click");
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className="flex h-[18px] items-center gap-1 rounded-full border border-fg/80 bg-fg px-2.5 text-[6px] font-bold uppercase tracking-[0.2em] text-bg-deep transition-colors hover:border-accent hover:bg-accent hover:text-bg-deep hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-9 md:gap-2 md:px-5 md:text-xs"
      >
        <span
          aria-hidden="true"
          className={`h-[3px] w-[3px] rounded-full md:h-1.5 md:w-1.5 ${
            active ? "bg-ok" : "bg-bg-deep/60"
          }`}
        />
        <span className="relative inline-grid items-center justify-items-center">
          <span className="invisible col-start-1 row-start-1">{defaultLabel}</span>
          <span className="invisible col-start-1 row-start-1">{HOVER_TEXT}</span>
          <span className="col-start-1 row-start-1">{showing ? display : defaultLabel}</span>
        </span>
      </button>
      {modalOpen && (
        <HackerModal onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
