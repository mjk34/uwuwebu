---
name: figma-to-jsx
description: Convert a Figma frame or node URL into a Next.js React component with Tailwind classes, following uwuwebu conventions. Requires figma-developer-mcp connected. Use when the user provides a Figma URL, node ID, or asks to turn a design into code.
---

# figma-to-jsx

Translates a Figma node into a uwuwebu-compliant React component via the Figma MCP.

## Prerequisites

The `figma-developer-mcp` server must be connected. Check with `claude mcp list`.

If it's not connected, stop and tell the user:

> Figma MCP isn't connected. Setup instructions: `.claude/skills/figma-to-jsx/references/setup.md`

Do not try to guess at Figma tool names or fabricate node data.

## Workflow

1. **Confirm the target.** Get the Figma file URL + node ID (or full node URL) from the user if not provided.
2. **Fetch the node** using the Figma MCP tools. See `references/figma-mcp-tools.md` for the available tool names and parameter shapes.
3. **Map properties to Tailwind:**
   - Fills → `bg-*`
   - Corner radius → `rounded-*`
   - Typography → `text-*`, `font-*`, `leading-*`, `tracking-*`
   - Auto-layout (vertical) → `flex flex-col gap-*`
   - Auto-layout (horizontal) → `flex gap-*`
   - Padding → `p-*` / `px-*` / `py-*`
   - Prefer Tailwind scale tokens (`p-4`, `gap-2`) over arbitrary values (`p-[17px]`) unless the design explicitly depends on the exact pixel
4. **Produce one React component** following `CLAUDE.md` + `../component/SKILL.md` conventions:
   - TypeScript, Tailwind classes only, default export
   - `type <Name>Props = { ... }` inline
   - Server component unless the design requires interactivity
   - Mock data from `@/lib/mock` for any placeholder content (avatar URLs, usernames, numeric stats)
5. **Save** to the path the user specifies, or propose `src/components/<NodeName>.tsx`
6. **Report** the file path, one sentence of what it does, and any classes or values the user should visually verify against Figma (e.g. "approximated `#1a1b23` as `bg-neutral-900`, confirm if that's close enough").

## Gotchas

- **Figma → Tailwind is lossy.** Exact pixel values rarely map to scale tokens cleanly. Prefer the nearest token unless the design explicitly demands the exact number. Flag any approximations in your report.
- **Don't invent design tokens.** Use values directly from the node. If a color or spacing will clearly become a shared token later, note it in the report — don't edit `tailwind.config.*` as part of this skill.
- **Don't install new dependencies** (animation libs, icon packages, CSS-in-JS) to match a Figma effect. Ask first.
- **Don't wire real data.** This is design-first prototyping. Mock data only — never fetch from the bot API.
- **Collapse wrapper hell.** Figma auto-layout produces deeply nested frames. Flatten nested single-child flex containers into one element with combined classes.
- **Rate limits.** The Figma API is rate-limited. Don't re-fetch the same node within a session unless the user says the design changed. Cache mentally.
- **Text nodes inherit fonts.** If the Figma frame uses a custom font, don't assume it's available — fall back to Tailwind's default and leave a note for the user to wire up the font later if needed.
- **Component variants:** Figma variants ≠ React prop variants. Ask the user whether to generate one component with a variant prop or separate components per variant.
- **Don't commit Figma node IDs in code comments.** They're not stable across file revisions.
