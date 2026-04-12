# uwuwebu

Companion website for **professor-rs** (Rust Discord bot, sibling dir). Shows user profile data (uwu creds, level, xp, stock portfolio) pulled from a localhost HTTP API the bot will expose. Users log in with Discord OAuth.

## Stack (locked)

- **Next.js 16** App Router, TypeScript, `src/` layout, Tailwind 4
- Package manager: **npm**
- Auth.js (Discord provider) — deferred to Phase 2, not installed yet

> Next.js 16 has breaking API changes from earlier versions. Before writing non-trivial Next.js code, read `AGENTS.md` and consult `node_modules/next/dist/docs/01-app/` (bundled docs) for the current API. Don't rely on older patterns.

**Do not add unprompted:** component libs (shadcn/MUI/Radix), state managers, data-fetch libs (SWR/TanStack Query), ORMs, animation libs, testing frameworks. Ask first.

## Current phase: design-first prototyping

Not wiring real data yet. Pages read from `src/lib/mock.ts`. When the bot API lands, swap should be one line per page.

Do **not** yet:
- Fetch from `http://127.0.0.1:4875` (planned bot URL)
- Install `next-auth`, build session/login logic

## Conventions Claude might overlook

- Server components by default; `"use client"` only for state/effects/event handlers
- Import user data from `@/lib/mock` (`mockCurrentUser`, `mockUsers`)
- Tailwind classes only — no CSS modules, no `style={}` unless value comes from data
- Default export for components, inline `type <Name>Props`
- `@/` alias for everything under `src/`
- Semantic HTML (`main`, `section`, `nav`, `header`, `footer`) before `div`

## Dev commands

- `npm run dev` — dev server on :3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

## Security (High tier)

- **Never run `npm install <pkg>`** without running the `dep-vet` skill first and getting explicit user approval. This applies to `-D`, `-g`, everything.
- All versions in `package.json` are **pinned exact** (no `^`, no `~`). `.npmrc` enforces `save-exact=true` and `ignore-scripts=true` on new installs.
- Use `npm ci` (not `npm install`) for reproducible installs from the lockfile.
- Run `npm audit --omit=dev` after any install; surface findings.
- Before committing, verify `.env` stays out of git (`git check-ignore -v .env`).
- Global installs (`-g`) bypass project `.npmrc` — always vet with Socket explicitly.

## Skills

- **component** — scaffold a page/layout/component (`.claude/skills/component/`)
- **figma-to-jsx** — Figma node → React component, needs Figma MCP (`.claude/skills/figma-to-jsx/`)
- **dep-vet** — vet any npm package before install; required by the Security policy above (`.claude/skills/dep-vet/`)

## Related

- `../professor-rs/` — Rust bot. `src/data.rs` has `UserData`, the schema our mock mirrors.
- `professor.plan` — bot-side HTTP API plan, handled by the Rust dev.
