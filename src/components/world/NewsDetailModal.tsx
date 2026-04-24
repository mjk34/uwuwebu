"use client";

import { useEffect, useRef, useState } from "react";
import type { NewsCard, Narrative, CoverageBreakdown } from "@/lib/news";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const HTTP_URL_RE = /^https?:\/\//i;

/* In-theme detail modal for a single headline cluster. Surfaces the rich
   pipeline fields the card layout doesn't have room for: framing, established
   facts, reported claims, disputed positions, narrative perspectives,
   blindspot note, divergence, and the per-source article list with their own
   bullets/summary/bias.

   Glassmorphic backdrop + cat-color accent border, echoing the active card. */

const CYAN = "#00f0ff";
const PINK = "#ff2a6d";
const GREEN = "#05ffa1";
const AMBER = "#f5c518";
const MUTED = "#858eaa";
const TEXT = "#d4d7e0";
const TITLE = "#f0f1f5";

function timeStr(ts: number): string {
  const d = Date.now() - ts;
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;
  if (d < HOUR) return Math.max(1, Math.round(d / 60000)) + "m";
  if (d < DAY) return Math.round(d / HOUR) + "h";
  return Math.round(d / DAY) + "d";
}

function tierLabel(tier: string | undefined): string {
  if (tier === "wire") return "WIRE";
  if (tier === "specialty") return "SPEC";
  return "MAIN";
}

function biasColor(b: number): string {
  if (b < -0.15) return CYAN;
  if (b > 0.15) return PINK;
  return "#ffffff";
}

function relColor(r: number): string {
  // Ad Fontes-aligned buckets (UI %): >70 ≈ raw >45 (solid reporting),
  // >59 ≈ raw >38 (reliable threshold), else problematic.
  if (r > 70) return GREEN;
  if (r > 59) return AMBER;
  return PINK;
}

function biasFromRaw(raw: number | undefined | null): number {
  // pipeline -42..+42 → UI -1..+1
  if (typeof raw !== "number") return 0;
  return Math.max(-1, Math.min(1, raw / 42));
}

function relFromRaw(raw: number | undefined | null): number {
  // pipeline 0..64 → UI 0..100
  if (typeof raw !== "number") return 0;
  return Math.round(Math.max(0, Math.min(100, (raw / 64) * 100)));
}

type SectionProps = {
  title: string;
  accent: string;
  children: React.ReactNode;
  count?: number;
};

function Section({ title, accent, children, count }: SectionProps) {
  return (
    <section style={{ marginTop: 22 }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
        paddingBottom: 6, borderBottom: `1px solid ${accent}33`,
      }}>
        <span style={{
          width: 6, height: 6, background: accent, borderRadius: 1,
          boxShadow: `0 0 8px ${accent}`,
        }} />
        <h3 style={{
          margin: 0, fontSize: 11, letterSpacing: 2.4, fontWeight: 700,
          color: accent, fontFamily: "var(--font-jetbrains-mono),monospace",
          textTransform: "uppercase",
        }}>{title}</h3>
        {typeof count === "number" && (
          <span style={{
            fontSize: 10, color: MUTED, fontFamily: "var(--font-jetbrains-mono),monospace",
            letterSpacing: 1,
          }}>{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function CoverageBar({ coverage }: { coverage?: CoverageBreakdown }) {
  if (!coverage) return null;
  const total = (coverage.left || 0) + (coverage.center || 0) + (coverage.right || 0);
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{
        display: "flex", height: 4, borderRadius: 2, overflow: "hidden",
        background: "rgba(133,142,170,0.12)",
      }}>
        <div style={{ width: pct(coverage.left), background: CYAN }} />
        <div style={{ width: pct(coverage.center), background: "#ffffff" }} />
        <div style={{ width: pct(coverage.right), background: PINK }} />
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 6,
        fontSize: 11, fontFamily: "var(--font-jetbrains-mono),monospace",
        color: MUTED, letterSpacing: 1,
      }}>
        <span style={{ textAlign: "left" }}><span style={{ color: CYAN }}>L</span> {coverage.left || 0}</span>
        <span style={{ textAlign: "center" }}><span style={{ color: "#fff" }}>C</span> {coverage.center || 0}</span>
        <span style={{ textAlign: "right" }}><span style={{ color: PINK }}>R</span> {coverage.right || 0}</span>
      </div>
    </div>
  );
}

function BiasMini({ bias }: { bias: number }) {
  const pct = Math.round(((bias + 1) / 2) * 100);
  const c = biasColor(bias);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-jetbrains-mono),monospace" }}>
      <div style={{ position: "relative", width: 50, height: 3, background: "rgba(133,142,170,0.15)", borderRadius: 2 }}>
        <div style={{
          position: "absolute", top: -2, width: 6, height: 7,
          left: `calc(${pct}% - 3px)`, background: c,
          boxShadow: `0 0 6px ${c}aa`, borderRadius: 1,
        }} />
      </div>
      <span style={{ fontSize: 10, color: c, fontWeight: 700 }}>{bias > 0 ? "+" : ""}{bias.toFixed(2)}</span>
    </div>
  );
}

type NewsDetailModalProps = {
  item: NewsCard | null;
  onClose: () => void;
  accent?: string;
};

export default function NewsDetailModal({ item, onClose, accent: accentProp }: NewsDetailModalProps) {
  // Accent is interpolated into inline <style> and dozens of template strings.
  // Validate as 6-digit hex so a malformed/user-sourced prop can't break out of
  // CSS context (the `${accent}55` 8-digit-hex alpha pattern also requires it).
  const accent: string = accentProp && HEX_COLOR_RE.test(accentProp) ? accentProp : "#00f0ff";
  const [show, setShow] = useState(false);
  const [expandedSrc, setExpandedSrc] = useState<number | null>(null);

  // Glass FX: pointer position drives gradients/shadows via CSS custom
  // properties written to the card element directly — avoids a React
  // re-render every rAF tick. Lerp matches the active card so the two
  // surfaces feel linked.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardRectRef = useRef<DOMRect | null>(null);
  const cardMouseTargetRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const cardMouseCurrentRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const lerpRafRef = useRef<number | null>(null);

  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const writeFxVars = (x: number, y: number) => {
    const el = cardRef.current;
    if (!el) return;
    const nearRightEdge = Math.max(0, (x - 0.5) * 2.4);
    const nearLeftEdge = Math.max(0, (0.5 - x) * 2.4) * 0.25;
    const nearEdge = nearRightEdge + nearLeftEdge;
    el.style.setProperty("--mx", String(x));
    el.style.setProperty("--my", String(y));
    el.style.setProperty("--near-right-edge", String(nearRightEdge));
    el.style.setProperty("--near-edge", String(nearEdge));
  };

  const startLerp = (speed = 0.09) => {
    if (reducedMotionRef.current) {
      const { x, y } = cardMouseTargetRef.current;
      cardMouseCurrentRef.current = { x, y };
      writeFxVars(x, y);
      return;
    }
    if (lerpRafRef.current) cancelAnimationFrame(lerpRafRef.current);
    const tick = () => {
      const { x: tx, y: ty } = cardMouseTargetRef.current;
      const cur = cardMouseCurrentRef.current;
      const dx = tx - cur.x, dy = ty - cur.y;
      if (Math.abs(dx) < 0.003 && Math.abs(dy) < 0.003) {
        cardMouseCurrentRef.current = { x: tx, y: ty };
        writeFxVars(tx, ty);
        lerpRafRef.current = null;
        return;
      }
      const nx = cur.x + dx * speed;
      const ny = cur.y + dy * speed;
      cardMouseCurrentRef.current = { x: nx, y: ny };
      writeFxVars(nx, ny);
      lerpRafRef.current = requestAnimationFrame(tick);
    };
    lerpRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => {
    if (lerpRafRef.current) cancelAnimationFrame(lerpRafRef.current);
  }, []);

  // Slide/fade in on mount, re-trigger when switching to a new item without
  // unmounting. Double-rAF ensures the `show=false` paint commits before we
  // flip to true, so the CSS transition re-plays for the new cluster.
  // Synchronous setState here is intentional — reset local state when the
  // parent clears/switches the item.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!item) { setShow(false); setExpandedSrc(null); return; }
    if (reducedMotionRef.current) { setShow(true); return; }
    setShow(false);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShow(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, [item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ESC to close
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [item]);

  // Cache card bounding rect — pointer handlers fire every move, so reading
  // getBoundingClientRect inline forced a synchronous layout per event.
  useEffect(() => {
    if (!item) return;
    const updateRect = () => {
      if (cardRef.current) {
        cardRectRef.current = cardRef.current.getBoundingClientRect();
      }
    };
    updateRect();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateRect) : null;
    if (ro && cardRef.current) ro.observe(cardRef.current);
    window.addEventListener("resize", updateRect);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateRect);
    };
  }, [item]);

  // Focus trap: move focus into the dialog on open, restore on close, wrap
  // Tab at boundaries. Keeps keyboard users inside the modal.
  useEffect(() => {
    if (!item) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const trap = cardRef.current;
    if (!trap) return;
    const getFocusables = () => Array.from(
      trap.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
    const initial = getFocusables();
    (initial[0] || trap).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = getFocusables();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    trap.addEventListener("keydown", onKey);
    return () => {
      trap.removeEventListener("keydown", onKey);
      if (prevFocus && typeof prevFocus.focus === "function") {
        prevFocus.focus({ preventScroll: true });
      }
    };
  }, [item]);

  if (!item) return null;

  const articles = item.articles || [];
  const coverage = item.coverage;
  const sd = item.sourceDiversity;
  const narratives = item.narratives || {};
  const established = item.established || [];
  const reported = item.reported || [];
  const disputed = item.disputed || [];
  const divergence = item.divergence || [];
  const biasMedNorm = biasFromRaw(item.biasMedian);
  // Accent → rgb tuple for layered glass effects (mirrors the active card).
  const accRgb = item.cat === "world" ? "255,42,109"
    : item.cat === "investments" ? "5,255,161"
    : item.cat === "science" ? "217,70,239"
    : item.cat === "cyber" ? "0,240,255"
    : "0,240,255";
  const fxId = `nm-${item.id}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "5vh 4vw",
        background: show ? "rgba(8,10,18,0.72)" : "rgba(8,10,18,0)",
        backdropFilter: show ? "blur(14px) saturate(1.4)" : "blur(0px)",
        WebkitBackdropFilter: show ? "blur(14px) saturate(1.4)" : "blur(0px)",
        transition: "background 0.28s ease, backdrop-filter 0.28s ease",
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fxId}-title`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={(e) => {
          const rect = cardRectRef.current || e.currentTarget.getBoundingClientRect();
          cardMouseTargetRef.current = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
          };
          startLerp(0.09);
        }}
        onPointerMove={(e) => {
          const rect = cardRectRef.current;
          if (!rect) return;
          cardMouseTargetRef.current = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
          };
          if (!lerpRafRef.current) startLerp(0.18);
        }}
        onPointerLeave={() => {
          cardMouseTargetRef.current = { x: 0.5, y: 0.5 };
          startLerp(0.05);
        }}
        style={{
          position: "relative",
          width: "min(820px, 100%)",
          maxHeight: "90vh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: "rgba(13,14,20,0.94)",
          border: `1px solid ${accent}55`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: "0 10px 10px 0",
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${accent}22, inset 0 0 0 0.5px ${accent}22`,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
          transition: reducedMotion ? "none" : "opacity 0.28s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1)",
          fontFamily: "var(--font-jetbrains-mono),monospace",
          outline: "none",
        }}
      >
        {/* ── Card-style glass FX layers ─────────────────────────────────
           Mirrors the active card 1:1 — asymmetric blur, flowing color
           refraction driven by cursor, mouse-following specular + accent
           halo, and a tapered bracket whose glow swells when the cursor
           approaches the right edge. */}
        <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
          <defs>
            <filter id={`liq-${fxId}`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="3" seed="11" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        {/* Layer 1: asymmetric backdrop blur — heavy left, dissolves right */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          borderRadius: "0 10px 10px 0",
          backdropFilter: "blur(18px) saturate(1.9) brightness(0.92)",
          WebkitBackdropFilter: "blur(18px) saturate(1.9) brightness(0.92)",
          WebkitMaskImage: "linear-gradient(to right,black 0%,black 50%,rgba(0,0,0,0.35) 80%,rgba(0,0,0,0.08) 100%), linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",
          maskImage: "linear-gradient(to right,black 0%,black 50%,rgba(0,0,0,0.35) 80%,rgba(0,0,0,0.08) 100%), linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "destination-in",
          background: "rgba(8,10,20,0.38)",
        }} />

        {/* Layer 2: flowing color refraction — gradient anchors track pointer
            through turbulence so the dot palette swims as the user moves.
            Positions are driven by --mx/--my custom properties written via
            ref in writeFxVars; no React re-render per frame. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
          borderRadius: "0 10px 10px 0",
          background: "radial-gradient(ellipse 130% 70% at calc(-10% + var(--mx, 0.5) * 55%) calc(15% + var(--my, 0.5) * 55%), rgba(255,42,109,0.18) 0%, transparent 55%), radial-gradient(ellipse 110% 80% at calc(55% + var(--mx, 0.5) * 50%) calc(var(--my, 0.5) * 75%), rgba(0,240,255,0.15) 0%, transparent 50%), radial-gradient(ellipse 90% 100% at calc(30% + var(--mx, 0.5) * 35%) calc(85% - var(--my, 0.5) * 45%), rgba(5,255,161,0.10) 0%, transparent 45%)",
          filter: reducedMotion ? "none" : `url(#liq-${fxId})`,
          WebkitMaskImage: "linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
          maskImage: "linear-gradient(to bottom,transparent 0%,black 10%,black 90%,transparent 100%)",
          mixBlendMode: "screen",
        }} />

        {/* Layer 3: pointer-following specular — white at center, hue shifts
            to accent near edges; right-edge halo bleeds toward the scrollbar.
            Driven by --mx/--my/--near-edge/--near-right-edge custom props. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
          borderRadius: "0 10px 10px 0",
          background: `radial-gradient(ellipse 50% 42% at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%), rgba(255,255,255, calc(0.11 * (1 - var(--near-edge, 0)))) 0%, rgba(255,255,255, calc(0.025 * (1 - var(--near-edge, 0)))) 50%, transparent 72%), radial-gradient(ellipse 55% 48% at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%), rgba(${accRgb}, calc(var(--near-edge, 0) * 0.5)) 0%, rgba(${accRgb}, calc(var(--near-edge, 0) * 0.14)) 38%, transparent 65%)`,
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
          borderRadius: "0 10px 10px 0",
          boxShadow: `inset calc((var(--mx, 0.5) - 0.5) * 14px) calc((var(--my, 0.5) - 0.5) * 14px) 40px rgba(${accRgb}, calc(0.03 + var(--near-edge, 0) * 0.09)), inset 0 0 0 0.5px rgba(${accRgb}, calc(0.03 + var(--mx, 0.5) * 0.1 + var(--near-edge, 0) * 0.12))`,
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
          borderRadius: "0 10px 10px 0",
          background: `radial-gradient(ellipse 35% 85% at 100% 50%, rgba(${accRgb}, calc(var(--near-right-edge, 0) * 0.28)) 0%, rgba(${accRgb}, calc(var(--near-right-edge, 0) * 0.08)) 45%, transparent 70%)`,
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          mixBlendMode: "screen",
        }} />

        {/* Header */}
        <header style={{
          position: "relative", zIndex: 4,
          flex: "none", padding: "20px 26px 16px",
          borderBottom: `1px solid ${accent}22`,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 2.5,
                color: "#0a0b12", background: accent, padding: "3px 8px", borderRadius: 3,
              }}>{(item.cat || "").toUpperCase()}</span>
              <span style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>{timeStr(item.dateTs)}</span>
              {item.coverageMode && (
                <span style={{
                  fontSize: 10, color: AMBER, border: `1px solid ${AMBER}55`,
                  borderRadius: 3, padding: "2px 6px", letterSpacing: 1.4, fontWeight: 700,
                }}>{item.coverageMode.toUpperCase()}</span>
              )}
              {item.newDevelopment && (
                <span style={{
                  fontSize: 10, color: GREEN, border: `1px solid ${GREEN}55`,
                  borderRadius: 3, padding: "2px 6px", letterSpacing: 1.4, fontWeight: 700,
                }}>NEW</span>
              )}
              {item.place && (
                <span style={{ fontSize: 11, color: MUTED }}>📍 {item.place}</span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, padding: 0, flex: "none",
                background: "transparent", border: `1px solid ${accent}55`,
                borderRadius: 4, color: accent, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = accent; e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = "#0a0b12"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.color = accent; }}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <h2 id={`${fxId}-title`} style={{
            margin: 0, fontSize: 22, lineHeight: 1.32, color: TITLE,
            fontWeight: 700, letterSpacing: 0.3,
          }}>{item.title}</h2>
          {item.tags && item.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {item.tags.map(t => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  color: accent, background: `${accent}14`,
                  border: `1px solid ${accent}55`, padding: "2px 8px", borderRadius: 3,
                }}>#{t}</span>
              ))}
            </div>
          )}
        </header>

        {/* Body — custom scrollbar styled in accent color via injected CSS
            (pseudo-elements can't live in inline styles). Class is scoped to
            the modal instance so simultaneously-mounted modals with different
            accents don't stomp each other's scrollbar color. */}
        <style>{`
          .news-modal-scroll-${fxId}{scrollbar-width:thin;scrollbar-color:${accent} transparent;overscroll-behavior:contain;}
          .news-modal-scroll-${fxId}::-webkit-scrollbar{width:9px;}
          .news-modal-scroll-${fxId}::-webkit-scrollbar-track{background:transparent;margin:4px 0;}
          .news-modal-scroll-${fxId}::-webkit-scrollbar-thumb{background:${accent};border-radius:5px;}
          .news-modal-scroll-${fxId}::-webkit-scrollbar-thumb:hover{background:${accent};}
          .news-modal-scroll-${fxId}::-webkit-scrollbar-corner{background:transparent;}
        `}</style>
        <div className={`news-modal-scroll-${fxId}`} style={{ position: "relative", zIndex: 4, flex: 1, overflow: "auto", padding: "8px 26px 26px" }}>
          {/* Framing */}
          <Section title="Framing" accent={accent}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: TEXT }}>{item.summary}</p>
          </Section>

          {/* Coverage — hidden for apolitical cats (cyber, science) */}
          {item.cat !== "cyber" && item.cat !== "science" && (
            <Section title="Coverage" accent={accent}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>BIAS DISTRIBUTION</div>
                  <BiasMini bias={biasMedNorm} />
                  {typeof item.biasSpread === "number" && (
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>spread: {item.biasSpread.toFixed(1)}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>RELIABILITY · {item.sourceCount} src</div>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: relColor(item.rel),
                  }}>{item.rel}%</span>
                  {sd && (
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                      wire {sd.wire || 0} · main {sd.mainstream || 0} · spec {sd.specialty || 0}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>LEFT / CENTER / RIGHT</div>
                <CoverageBar coverage={coverage} />
              </div>
            </Section>
          )}

          {established.length > 0 && (
            <Section title="Established" accent={accent} count={established.length}>
              <ul style={listStyle}>
                {established.map((s, i) => (
                  <li key={i} style={liStyle}><Marker color={GREEN} />{s}</li>
                ))}
              </ul>
            </Section>
          )}

          {reported.length > 0 && (
            <Section title="Reported" accent={accent} count={reported.length}>
              <ul style={listStyle}>
                {reported.map((s, i) => (
                  <li key={i} style={liStyle}><Marker color={accent} />{s}</li>
                ))}
              </ul>
            </Section>
          )}

          {disputed.length > 0 && (
            <Section title="Disputed" accent={accent} count={disputed.length}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {disputed.map((d, i) => (
                  <div key={i} style={{
                    padding: 12, border: `1px solid ${AMBER}33`, borderRadius: 4,
                    background: `${AMBER}06`,
                  }}>
                    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.55 }}>{d.claim}</div>
                    {d.positions && d.positions.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {d.positions.map((p, j) => (
                          <div key={j} style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
                            <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1, marginRight: 6 }}>{p.who}</span>
                            {p.claim}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(narratives.left || narratives.center || narratives.right) && (
            <Section title="Narrative perspectives" accent={accent}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {([
                  ["LEFT", narratives.left, CYAN],
                  ["CENTER", narratives.center, "#ffffff"],
                  ["RIGHT", narratives.right, PINK],
                ] as Array<[string, Narrative | undefined, string]>)
                  .filter((e): e is [string, { framing: string }, string] => !!(e[1] && e[1].framing))
                  .map(([label, n, c]) => (
                  <div key={label} style={{
                    padding: 10, border: `1px solid ${c}33`, borderRadius: 4, borderLeft: `2px solid ${c}`,
                    background: `${c}06`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: c, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.55 }}>{n.framing}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {divergence.length > 0 && (
            <Section title="Divergence" accent={accent} count={divergence.length}>
              <ul style={listStyle}>
                {divergence.map((d, i) => (
                  <li key={i} style={liStyle}><Marker color={PINK} />{d.topic}</li>
                ))}
              </ul>
            </Section>
          )}

          {item.blindspotNote && (
            <Section title="Blindspot" accent={accent}>
              <div style={{
                padding: 12, border: `1px solid ${PINK}33`, borderRadius: 4,
                background: `${PINK}06`,
                fontSize: 13, color: TEXT, lineHeight: 1.6, fontStyle: "italic",
              }}>{item.blindspotNote}</div>
            </Section>
          )}

          {/* Sources / per-article details */}
          {articles.length > 0 && (
            <Section title="Sources" accent={accent} count={articles.length}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {articles.map((a, i) => {
                  const expanded = expandedSrc === i;
                  const aBias = biasFromRaw(a.bias);
                  const aRel = relFromRaw(a.rel);
                  return (
                    <div key={a.id || i} style={{
                      border: `1px solid ${accent}22`,
                      borderLeft: `2px solid ${accent}`,
                      borderRadius: 3, background: "rgba(255,255,255,0.015)",
                    }}>
                      <button
                        onClick={() => setExpandedSrc(expanded ? null : i)}
                        style={{
                          width: "100%", textAlign: "left", padding: "10px 12px",
                          background: "transparent", border: 0, color: TEXT, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 10,
                          fontFamily: "var(--font-jetbrains-mono),monospace",
                        }}
                      >
                        <span style={{
                          fontSize: 10, color: accent, fontWeight: 700, letterSpacing: 1.5,
                          padding: "1px 6px", border: `1px solid ${accent}55`, borderRadius: 2,
                        }}>{tierLabel(a.srcTier)}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
                          color: accent, textTransform: "uppercase",
                          maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{a.src}</span>
                        <span style={{
                          flex: 1, fontSize: 12, color: TITLE, lineHeight: 1.4,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{a.title}</span>
                        <BiasMini bias={aBias} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: relColor(aRel) }}>{aRel}%</span>
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {expanded && (
                        <div style={{ padding: "0 14px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                          {a.summary && (
                            <p style={{ margin: 0, fontSize: 13, color: TEXT, lineHeight: 1.65 }}>{a.summary}</p>
                          )}
                          {a.bullets && a.bullets.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>KEY POINTS</div>
                              <ul style={listStyle}>
                                {a.bullets.map((b, j) => <li key={j} style={liStyle}><Marker color={accent} />{b}</li>)}
                              </ul>
                            </div>
                          )}
                          {a.claims && a.claims.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>
                                CLAIMS (
                                <span style={{ color: GREEN, fontWeight: 700 }}>F</span>=FACT{" "}
                                <span style={{ color: AMBER, fontWeight: 700 }}>A</span>=ANALYSIS{" "}
                                <span style={{ color: PINK, fontWeight: 700 }}>O</span>=OPINION)
                              </div>
                              <ul style={{ ...listStyle, gap: 4 }}>
                                {a.claims.map((c, j) => (
                                  <li key={j} style={{
                                    listStyle: "none", paddingLeft: 16, position: "relative",
                                    fontSize: 12, color: TEXT, lineHeight: 1.55,
                                  }}>
                                    <span style={{
                                      position: "absolute", left: 0, top: 4,
                                      fontSize: 9, fontWeight: 700, letterSpacing: 1,
                                      color: c.type === "fact" ? GREEN : c.type === "analysis" ? AMBER : c.type === "opinion" ? PINK : MUTED,
                                    }}>{(c.type || "?").charAt(0).toUpperCase()}</span>
                                    {c.claim}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {a.srcUrl && HTTP_URL_RE.test(a.srcUrl) && (
                            <a href={a.srcUrl} target="_blank" rel="noopener noreferrer" style={{
                              fontSize: 11, color: accent, letterSpacing: 1.2,
                              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 10px", border: `1px solid ${accent}55`, borderRadius: 3,
                              alignSelf: "flex-start",
                            }}>
                              READ ORIGINAL
                              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 17L17 7" /><polyline points="7 7 17 7 17 17" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6,
};

const liStyle: React.CSSProperties = {
  listStyle: "none", position: "relative",
  paddingLeft: 16,
  fontSize: 13, color: TEXT, lineHeight: 1.6,
};

function Marker({ color }: { color: string }) {
  return (
    <span style={{
      position: "absolute", left: 2, top: 8,
      width: 5, height: 5, background: color,
      boxShadow: `0 0 6px ${color}aa`, borderRadius: 1,
    }} />
  );
}
