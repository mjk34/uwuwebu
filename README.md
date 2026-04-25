# uwuwebu

Companion website for **professor-rs** — a Rust Discord bot economy + news digest. The site is a static Next.js 16 app that renders two routes:

- `/` — hero terminal with a keyboard-interactive ASCII UwU globe.
- `/world` — daily news briefing: a cluster-based news feed with per-source bias + reliability scoring, a three.js world globe with location markers and conflict arcs, and a detail modal that surfaces framing, established facts, disputed positions, and narrative perspectives per headline.

**Live:** [www.uwuversity.org](https://www.uwuversity.org) (apex redirects to www) — also mirrored at [mjk34.github.io/uwuwebu](https://mjk34.github.io/uwuwebu/).

## Stack

- **Next.js 16** (App Router, static export via `output: "export"`)
- **TypeScript** with strict mode
- **Tailwind 4** + CSS custom properties
- **three.js** for the world globe (chunk-split via `next/dynamic`)
- **next/font** for Geist / Geist Mono / JetBrains Mono — no runtime Google Fonts
- Deployed via GitHub Pages; canonical domain served from Cloudflare

## Features

### Home (`/`)
- Liquefied intro (scramble + glitch + fade) that honors `prefers-reduced-motion`.
- ASCII UwU globe on canvas — face state machine (normal / dizzy / distressed), dragging, 3D sphere-mapped repulsion, reactive parallax star field. Glyph bitmap cache for DPR-correct rendering.
- Side menu with keyboard navigation, decrypt-link effects, mock Discord auth flow.

### World (`/world`)
- News feed from a separate Python pipeline (see *Data flow* below). Two modes:
  - **LIVE** — items within the last 48h.
  - **HISTORY** — older items, capped per category and scored by recency-decayed importance.
- Vertical card carousel with wheel + touch-swipe navigation, cat-color accent borders, and a ref-driven CSS-custom-properties glass FX on the active card (no per-frame React re-renders).
- Interactive 3D globe (three.js) with clustered news markers, capital city labels (hover reveals name), and animated conflict arcs between hotspots. Screen-space proximity click picks the nearest marker.
- Detail modal with framing, established / reported / disputed claim sections, narrative perspectives per political lean, source diversity breakdown, and per-article claim-type legend (fact / analysis / opinion).
- Deep-linkable state — `?mode=history&id=<cluster>&tags=...` rehydrates the dashboard; native back-button walks state changes.
- Keyboard-accessible throughout (role=button/switch/dialog, Tab order, Enter/Space activation, focus trap in modal).

## Project layout

```
src/
├── app/                       # Next.js routes
│   ├── layout.tsx             # fonts + global chrome
│   ├── page.tsx               # /  — home (hero + globe)
│   └── world/page.tsx         # /world — news dashboard
├── components/
│   ├── chrome/                # top strip, side menu, cursor, mute toggle, sign-in pill
│   ├── home/                  # hero, parallax dots, UwU globe, bg music
│   ├── intro/                 # scramble intro gate
│   ├── modal/                 # hacker auth modal + ASCII splash
│   └── world/                 # news dashboard + globe + detail modal + atoms
├── hooks/
│   ├── useScramble.ts         # text scramble/decrypt hook
│   ├── useNewsFeed.ts         # fetch + mode-bucketed baseFeed + counts
│   ├── useTagFilter.ts        # per-cat tag filter state
│   ├── useCardCarousel.ts     # carousel state + wheel/touch nav (split)
│   └── useDashboardURLSync.ts # URL <-> dashboard state bridge
├── lib/
│   ├── news.ts                # pipeline → NewsCard adapter + R2 fetch
│   ├── news-colors.ts         # C3/CH/CAT_CYCLE/CAT_LABELS (category enums)
│   ├── topology.ts            # TopoJSON decode + land-mask rasterization
│   ├── globe-capitals.ts      # CAPITALS / WARRING / CONFLICTS data
│   ├── motion.ts              # isReducedMotion() singleton
│   ├── session.ts             # session/localStorage helpers
│   ├── sfx.ts                 # Web Audio oscillator sound effects
│   ├── decrypt.ts             # scramble glyph generator
│   ├── menu-store.ts          # side menu open/close external store
│   ├── client-values.ts       # useSyncExternalStore wrapper
│   ├── globe-data.ts          # UwU globe particle positions
│   ├── globe-face-data.ts     # dizzy / angry face particle sets
│   └── mock.ts                # mock user fixtures (Phase 2 auth)
└── types/
    └── three.d.ts             # ambient shim for three (no @types/three install)
```

## Data flow

The world dashboard reads an editorially-synthesized news feed produced by a separate pipeline:

```
uwuwebu-pipeline (Python)
  └─> Cloudflare R2 bucket (public, CORS-configured)
       └─> news.uwuversity.org/news.json
            └─> browser fetch on /world mount
```

- The pipeline groups articles into clusters, scores bias (Ad Fontes −42..+42) and reliability (0..64), and synthesizes framing / established / disputed / narrative fields per cluster.
- The frontend adapts the pipeline shape → `NewsCard[]` in `lib/news.ts`, scaling bias to −1..+1 and reliability to 0..100. Payload shape is validated before mapping.
- `public/news.json` is a bundled fallback used when the live R2 fetch fails (e.g. CORS on the `pub-*.r2.dev` preview URL). The bundle stays in sync with the custom domain whenever a pipeline run ships.
- `public/data/countries-50m.json` is a self-hosted copy of the `world-atlas@2.0.2` TopoJSON feed — removed the runtime CDN dependency the globe originally pulled from jsdelivr.

## Dev

```bash
npm ci          # reproducible install from lockfile
npm run dev     # dev server on :3000 (Turbopack)
npm run build   # production build (static export to ./out)
npm run lint    # ESLint
```

### Security posture

- All dependencies pinned exact (no `^`, no `~`).
- `.npmrc` enforces `save-exact=true` + `ignore-scripts=true`.
- New packages require a Socket score + CVE check via the bundled `dep-vet` skill before install.
- Pipeline payload shape-checked at the fetch boundary; external-link `href`s protocol-guarded against `javascript:` / `data:` schemes.
- CSP set via `public/_headers` (`default-src 'self'`, image allowlist for Discord CDN + data URIs).
- Static export means no server-side attack surface.

## Phase 2 (planned, not wired)

- Discord OAuth via Auth.js.
- Bot API at `http://127.0.0.1:4875` (local dev) / sibling host in prod — live uwu-creds, level, XP, stock portfolio, bookmarks. Mock fixtures in `lib/mock.ts` mirror the expected schema.
- Per-user news bookmarks keyed by pipeline `clusterId`, owned by professor-rs.
- Corresponding bookmark / read-state UI re-enabled in the news card and detail modal (currently commented out with `TODO(phase2-auth)` markers).

## Related

- [`../professor-rs/`](https://github.com/mjk34/professor-rs) — Rust Discord bot (sibling repo). Owner of the user schema (`src/data.rs::UserData`) + upcoming bookmark API.
- [`../uwuwebu-pipeline/`](https://github.com/mjk34/uwuwebu-pipeline) — Python news pipeline. Source of truth for category tag enums (`config/tag_enums.yaml`), bias/reliability scoring, and cluster synthesis.

## Credits

- Country polygons: [world-atlas@2.0.2](https://github.com/topojson/world-atlas) (Natural Earth, public domain).
- Fonts: Geist / Geist Mono / JetBrains Mono via `next/font/google`.
