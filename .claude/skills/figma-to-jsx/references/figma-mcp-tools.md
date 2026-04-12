# Figma MCP tool reference

This doc lists the tools the `figma-developer-mcp` server exposes once connected, and how the `figma-to-jsx` skill should use them.

## Discovering tools at runtime

The exact tool names depend on which version of `figma-developer-mcp` is installed. Before assuming names, run `claude mcp list` and inspect the Figma entry, or ask Claude to call the MCP's schema introspection. Common tool names include (subject to package version):

- `mcp__figma__get_file` — fetch full file metadata
- `mcp__figma__get_node` — fetch a specific node by file key + node ID
- `mcp__figma__get_image` — render a node as PNG/SVG
- `mcp__figma__get_code_connect` — fetch code-connect mappings if the design system has them

Do **not** hardcode these names in generated code. Use them only at the point of fetching data from the skill.

## Parsing a Figma URL

A Figma node URL looks like:

```
https://www.figma.com/file/<FILE_KEY>/<Project-Name>?node-id=<NODE_ID>
```

or for newer designs:

```
https://www.figma.com/design/<FILE_KEY>/<Project-Name>?node-id=<NODE_ID>
```

- `FILE_KEY` is the string after `/file/` or `/design/`
- `NODE_ID` is URL-encoded; `42-0` in the URL corresponds to `42:0` in the API

## What to extract from a node

For a single frame/component, pull:

| Figma property                 | Use for                  | Tailwind mapping example        |
|-------------------------------|--------------------------|---------------------------------|
| `absoluteBoundingBox.width/h` | sizing (when fixed)      | `w-[240px] h-[120px]`           |
| `fills[0].color`              | background color         | `bg-neutral-900` / `bg-[#...]`  |
| `strokes[0].color`            | border color             | `border border-neutral-200`    |
| `cornerRadius`                | border radius            | `rounded-lg` / `rounded-[12px]` |
| `effects[type=DROP_SHADOW]`   | shadow                   | `shadow-md` / `shadow-[...]`    |
| `layoutMode` (VERTICAL/HORIZONTAL) | auto-layout direction | `flex flex-col` / `flex`     |
| `itemSpacing`                 | gap                      | `gap-2` / `gap-[10px]`          |
| `paddingLeft/Right/Top/Bottom`| padding                  | `p-4` / `px-4 py-2`             |
| `style.fontFamily`            | font family              | `font-sans` (or leave default)  |
| `style.fontSize`              | font size                | `text-sm` / `text-[15px]`       |
| `style.fontWeight`            | font weight              | `font-medium` / `font-semibold` |
| `style.letterSpacing`         | tracking                 | `tracking-wide`                 |
| `style.lineHeightPx`          | line height              | `leading-6`                     |

## Mapping strategy

1. **Try the Tailwind token first.** `16px` → `p-4`, `#171717` → `bg-neutral-900`, `12px` → `gap-3`.
2. **Use arbitrary values** (`p-[17px]`, `bg-[#1a1b23]`) only when the visual difference from the nearest token would be noticeable and the design clearly depends on the exact value.
3. **Report approximations** at the end — "approximated `#1a1b23` as `bg-neutral-900`; if that's not close enough, swap to `bg-[#1a1b23]`".

## What NOT to extract

- Named styles that reference a design system — we don't have one yet, so resolve to the concrete value
- Component instance overrides from a library the user hasn't built — resolve to the base value
- Interaction prototypes (on-click transitions, etc.) — we're doing static conversion only
