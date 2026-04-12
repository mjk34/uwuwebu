---
name: component
description: Scaffold a new Next.js App Router page, layout, or reusable React component for uwuwebu (TypeScript + Tailwind, server-first, mock-data-aware). Use when the user asks to create a new page, layout, or component file under src/app or src/components.
---

# component

Scaffolds a new file in `src/app/` or `src/components/` matching uwuwebu conventions.

## When to use

User says things like: "create a page for /profile", "new Counter component", "scaffold a layout", "make a client component for X".

## Parse the request

- `page <route>` → `src/app/<route>/page.tsx` as a server component
- `layout <route>` → `src/app/<route>/layout.tsx`
- `client <Name>` → `src/components/<Name>.tsx` with `"use client"` at top
- bare `<Name>` → `src/components/<Name>.tsx` as a server component

If the route or name is ambiguous, ask once before writing.

## Core rules

- TypeScript only, Tailwind classes only, default export
- `type <ComponentName>Props = { ... }` declared inline directly above the component
- Semantic HTML first (`main`, `section`, `nav`, `header`, `footer`) before `div`
- Data from `@/lib/mock` (never from `http://127.0.0.1:4875` — that's deferred)
- Server component by default; `"use client"` only for state/effects/event handlers

## Templates

Full working examples live in `examples/` — read the one matching the request shape:

- `examples/page.tsx` — server page reading mock data
- `examples/client.tsx` — client component with state
- `examples/layout.tsx` — route layout with nested children

For deeper convention detail (prop patterns, when to split a file, etc.) see `references/conventions.md` — only load it if the core rules above aren't enough for the specific request.

## After writing

Report:
1. The file path created
2. One sentence on what it does

Do **not** run `npm run dev` unless the user asked.

## Gotchas

- **Don't modify config files.** No edits to `tailwind.config.*`, `next.config.*`, `tsconfig.json`, or `package.json` as part of this skill. If the request implies a config or dep change, stop and ask.
- **Don't mark a parent `"use client"`** just because it imports a client component. Only the leaf component that actually uses hooks/events needs the directive — server components can import client components freely.
- **Don't leave `TODO` comments.** If data is missing, leave a typed prop hole rather than a TODO.
- **Don't fetch from the bot.** `http://127.0.0.1:4875` is deferred to Phase 2. Always mock.
- **Don't install packages** to make a component work. Tailwind + React + `@/lib/mock` is the full allowed surface.
- **Async server components** can `await` — but only when actually needed. Don't mark a sync component `async` for no reason.
- **File extensions:** always `.tsx` for components (even if there's no JSX, Next.js expects it).
