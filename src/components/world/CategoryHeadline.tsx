"use client";

import { useEffect, useRef, useState } from "react";
import { useScramble } from "@/hooks/useScramble";
import { CAT_LABELS, CAT_CYCLE, CH } from "@/lib/news-colors";
import type { Cat } from "@/lib/news";

type CategoryHeadlineProps = {
  cat: Cat;
  count?: number;
  onJump?: (dir: 1 | -1) => void;
  centered?: boolean;
  empty?: boolean;
};

export default function CategoryHeadline({
  cat,
  count = 0,
  onJump,
  centered = false,
  empty = false,
}: CategoryHeadlineProps) {
  const label = empty ? "EMPTY" : CAT_LABELS[cat] || "WORLD NEWS";
  const color = empty ? "#ffffff" : CH[cat] || "#00f0ff";
  const nextCat = CAT_CYCLE[(CAT_CYCLE.indexOf(cat) + 1) % CAT_CYCLE.length];
  const prevCatKey = CAT_CYCLE[(CAT_CYCLE.indexOf(cat) - 1 + CAT_CYCLE.length) % CAT_CYCLE.length];
  const nextColor = CH[nextCat] || "#00f0ff";
  const prevColor = CH[prevCatKey] || "#00f0ff";
  const { display, scrambleTo, snapTo } = useScramble(label, { duration: 260, interval: 16 });

  // Same slot cycles between the current-cat count (resting) and ">>"/"<<" (hover).
  // Short fixed-length strings, so disable length scaling.
  const padded = String(count).padStart(2, "0");
  const chev = useScramble(padded, { duration: 220, interval: 16, scaleByLength: false });
  const prevCatRef = useRef(cat);
  const prevEmpty = useRef(empty);
  const [hover, setHover] = useState(false);
  // Ctrl while hovered flips the preview: glyph "<<" + previous-cat color,
  // click routes backward through CAT_CYCLE instead of forward.
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    if (prevCatRef.current !== cat || prevEmpty.current !== empty) {
      prevCatRef.current = cat;
      prevEmpty.current = empty;
      scrambleTo(label);
    } else {
      snapTo(label);
    }
  }, [cat, label, empty, scrambleTo, snapTo]);

  useEffect(() => {
    if (!hover) {
      setCtrlHeld(false);
      return;
    }
    const onDown = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(false); };
    const onBlur = () => setCtrlHeld(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [hover]);

  useEffect(() => {
    if (empty) return;
    chev.scrambleTo(hover ? (ctrlHeld ? "<<" : ">>") : padded);
    // chev.scrambleTo identity is stable — only re-run on hover/ctrl/count flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, ctrlHeld, padded, empty]);

  // Count reads white at rest; hover cross-fades to next/prev-cat color.
  const chevColor = hover ? (ctrlHeld ? prevColor : nextColor) : "#ffffff";

  return (
    <div
      role={empty ? undefined : "button"}
      tabIndex={empty ? undefined : 0}
      aria-label={empty ? undefined : `Jump to ${nextCat} — hold Ctrl to go back to ${prevCatKey}`}
      onClick={empty ? undefined : (e) => {
        const back = e.ctrlKey;
        scrambleTo(label);
        chev.scrambleTo(back ? "<<" : ">>");
        onJump?.(back ? -1 : 1);
      }}
      onKeyDown={empty ? undefined : (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const back = e.ctrlKey;
          scrambleTo(label);
          chev.scrambleTo(back ? "<<" : ">>");
          onJump?.(back ? -1 : 1);
        }
      }}
      onMouseEnter={empty ? undefined : (e) => { setHover(true); setCtrlHeld(!!e.ctrlKey); }}
      onMouseLeave={empty ? undefined : () => setHover(false)}
      style={{
        position: "absolute",
        left: centered ? "50%" : "calc(5vw + 50px)",
        top: centered ? "14vh" : "150px",
        transform: centered ? "translateX(-50%)" : undefined,
        textAlign: centered ? "center" : undefined,
        fontFamily: "var(--font-jetbrains-mono),monospace",
        fontSize: "clamp(36px,5vw,68px)",
        fontWeight: 900,
        letterSpacing: "0.12em",
        color,
        lineHeight: 1,
        zIndex: 15,
        pointerEvents: empty ? "none" : "auto",
        userSelect: "none",
        cursor: empty ? "default" : "pointer",
        fontVariantNumeric: "tabular-nums",
        opacity: 0.92,
        textShadow: `0 0 14px ${color}55, 0 0 40px ${color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {display}
      {/* Resting: article count in current cat color. Hover: decrypts to ">>"
          in next cat's color (click target preview). Absolute so the label
          stays centered — the slot hangs off the right edge either way.
          Hidden in empty state so the EMPTY label stands alone. */}
      {!empty && (
        <span style={{
          position: "absolute",
          left: "100%",
          top: 0,
          marginLeft: "0.9em",
          color: chevColor,
          textShadow: `0 0 14px ${chevColor}55, 0 0 40px ${chevColor}33`,
          transition: "color 0.18s ease, text-shadow 0.18s ease",
          pointerEvents: "none",
        }}>{chev.display}</span>
      )}
    </div>
  );
}
