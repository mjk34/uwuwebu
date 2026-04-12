# uwuwebu component conventions — deep reference

Load this only if SKILL.md's core rules aren't enough to answer a specific question about how a component should be structured.

## Prop patterns

- **Always use `type`** (not `interface`) for prop shapes, unless the prop contract is genuinely meant to be extended by a consumer (rare in this project).
- **Name props `<ComponentName>Props`** and declare them directly above the component — don't split into a separate `types.ts` file for a single component.
- **Required props first, optional props last** in the type declaration. Default values go in the destructure, not in the type.
- **Children:** type as `React.ReactNode`. Don't use `FC<>` / `FunctionComponent<>` wrappers — they add nothing and hide the return type.

```tsx
type ProfileCardProps = {
  username: string;
  creds: number;
  avatarUrl?: string;
};

export default function ProfileCard({ username, creds, avatarUrl }: ProfileCardProps) {
  // ...
}
```

## When to split a file

Split a component out of a page when **any** of the following are true:

- It's reused across more than one page
- It exceeds ~80 lines and has a clearly independent responsibility
- It needs `"use client"` but the page itself doesn't — isolate the client island so the page can stay server

Otherwise, keep it inline. A 40-line subcomponent living in the same `page.tsx` is fine.

## Server vs client

**Default: server component.** Only add `"use client"` when the component:

- Uses `useState`, `useEffect`, `useRef`, or any other React hook
- Attaches event handlers (`onClick`, `onChange`, etc.)
- Uses browser APIs (`window`, `document`, `localStorage`)
- Uses a library that itself requires client rendering

**Don't** mark a component `"use client"` just because it imports one. Server components can render client components freely; the boundary is transitive only downward, not upward.

## Data access during prototyping

All user data comes from `src/lib/mock.ts`:

- `mockCurrentUser` — the "logged-in" user for profile pages
- `mockUsers` — array of fake users for lists/leaderboards
- `getMockUser(discordId)` — lookup by ID, returns `undefined` if not found

Never import `fetch`/axios/SWR in this phase. When the bot API lands, `mockCurrentUser` gets swapped for a real fetch in `src/lib/user.ts` — components themselves won't need to change.

## Styling

- Tailwind classes in `className` only
- Use design tokens Tailwind already ships (`bg-neutral-800`, `text-indigo-500`, `rounded-lg`) before reaching for arbitrary values (`bg-[#1a1a1a]`)
- Arbitrary values are fine when a Figma design specifies an exact pixel value that doesn't fit the scale — but prefer the nearest scale token when visual difference is negligible
- Class order: layout → spacing → sizing → typography → color → effects. `prettier-plugin-tailwindcss` will enforce this automatically once installed.

## What NOT to add

- `forwardRef` unless the user explicitly needs a ref (rare)
- `memo` / `useMemo` / `useCallback` without a measured performance reason
- Custom hooks for one-off logic — inline it
- Barrel `index.ts` files exporting from `src/components/` — import directly from the component file
