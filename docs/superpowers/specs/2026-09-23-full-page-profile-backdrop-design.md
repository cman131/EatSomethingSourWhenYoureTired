# Design: Full-Page Profile Backdrop

## Problem

The `profileBackdrop` flair category renders as a small fixed-height strip (`ProfileBackdrop`,
`h-20`) wedged between the "User Information" card header and the avatar row in
`UserInfoSection.tsx`. Visually it reads as an unrelated rectangle block rather than a themed
look for the page. The desired treatment is a full-page background: the backdrop's color/gradient
should fill the entire page from directly under the navbar to directly above the footer, edge to
edge of the browser window, with every section's card floating on top of it, on the profile page
only.

This is a pure rendering change. `equippedFlair.profileBackdrop`, the shop catalog, the CSS value
registry (`flairUtils.ts`), and all backdrop CSS classes in `flair.css` are unchanged and reused
as-is — only *where and how* the value is rendered changes.

## Decisions (from brainstorming)

- **Applies to any profile you view** (yours or another member's), gated by the same
  `!user?.privateMode` check already enforced server-side in `User.toJSON()` — no change to that
  gating logic, just to where the value renders.
- **Shop.tsx and `MyFlairSection.tsx`'s live-preview swatches are unchanged.** They keep the small
  strip via the existing `ProfileBackdrop` component — useful for quickly comparing many items
  while browsing. Only the real profile page gets the full-page treatment.
- **Cards become translucent** (not opaque) while sitting on the backdrop, so the gradient/color
  reads through the page, not just in the gaps between cards.
- **Flush against the navbar and footer** — no gap of the normal page background above or below
  the backdrop. This is the one decision with real implementation weight: it requires the backdrop
  layer to fill `<main>`'s own padding, not just the natural height of the profile content, which
  in turn requires a small, opt-in change to the shared `Layout.tsx` (detail below).

## Components

### `client/src/components/user/ProfilePageBackdrop.tsx` (new)

Sibling of the existing `ProfileBackdrop`, same guard: renders nothing when `value` is
null/undefined/unknown to the registry (`getBackdropStyle(value)` returns `null`). Where
`ProfileBackdrop` renders a fixed-height strip, this renders a full-bleed layer:

```tsx
<div
  aria-hidden="true"
  data-testid="profile-page-backdrop"
  className={['profile-page-backdrop', value].join(' ')}
/>
```

```css
/* flair.css */
.profile-page-backdrop {
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  z-index: -1;
}

@media print {
  .profile-page-backdrop {
    display: none;
  }
}
```

`inset-block: 0` fills the height of its positioned ancestor (`<main>`, see below); the
`left: 50%` / `width: 100vw` / `translateX(-50%)` pair is the standard "break out of a centered,
max-width container to the full viewport width" trick — it does not depend on knowing `<main>`'s
padding or max-width values, so it stays correct if those change later. `z-index: -1` keeps it
behind normal-flow content without needing `pointer-events` handling.

The backdrop's own CSS class (e.g. `flair-backdrop-koi`) supplies the actual
color/gradient/animation — same classes `ProfileBackdrop` already uses, so premium items keep
their flow animation and every existing `prefers-reduced-motion` rule in `flair.css` applies
unchanged.

### `client/src/components/Layout.tsx` (small, opt-in change)

`<main>` is the one element whose box exactly spans navbar-bottom to footer-top, so it's the
natural place to host the flush background — reaching that region from inside `Profile.tsx` alone
(e.g. via negative margins matching `<main>`'s padding) would mean hardcoding Tailwind's `py-6`
value in a second place, fragile if `Layout.tsx`'s padding ever changes.

Add a small context so a page can register a background node with `<main>` without `Layout.tsx`
needing to know anything about backdrops:

```tsx
// client/src/contexts/PageBackdropContext.tsx (new)
const PageBackdropContext = createContext<(node: React.ReactNode) => void>(() => {});
export const usePageBackdrop = (node: React.ReactNode) => {
  const setBackdrop = useContext(PageBackdropContext);
  useEffect(() => {
    setBackdrop(node);
    return () => setBackdrop(null);
  }, [node, setBackdrop]);
};
```

`Layout.tsx`:
- Holds `pageBackdrop` state itself (`useState<React.ReactNode>(null)`) and wraps its existing
  JSX in `<PageBackdropContext.Provider value={setPageBackdrop}>`, so no other file's provider
  nesting changes.
- `<main>` gains `className="... relative"` and renders `{pageBackdrop}{children}`.

When no page calls `usePageBackdrop`, `pageBackdrop` is `null` and `<main>` renders exactly as it
does today — this is verified by a regression test (see Testing). Every other page's `.card`
usage (31 across the app) and layout are visually unaffected.

### `client/src/pages/Profile.tsx`

```ts
const hasBackdrop =
  !user?.privateMode && !!getBackdropStyle(user?.equippedFlair?.profileBackdrop ?? '');

usePageBackdrop(
  hasBackdrop ? <ProfilePageBackdrop value={user!.equippedFlair!.profileBackdrop!} /> : null
);
```

The existing root `<div className="space-y-8">` gains `data-flair-backdrop` when `hasBackdrop` is
true. No new wrapper element — this is the same div that already contains the header row,
`UserInfoSection`, `MyFlairSection`, and the conditionally-rendered stats sections, so the
attribute's scope automatically covers exactly whatever sections are actually rendered (fewer
sections when viewing a private-mode profile from another account, more when viewing your own).

### `client/src/components/profile/UserInfoSection.tsx`

Remove the existing backdrop banner entirely:

```tsx
{/* Backdrop banner: profile-only flair, hidden in private mode */}
{!user?.privateMode && (
  <ProfileBackdrop value={user?.equippedFlair?.profileBackdrop} className="h-20" />
)}
```

The `ProfileBackdrop` import becomes unused here and is removed.

### `client/src/styles/flair.css`

```css
[data-flair-backdrop] .card {
  background-color: rgb(255 255 255 / 0.85);
  backdrop-filter: blur(3px);
}

@media print {
  [data-flair-backdrop] .card {
    background-color: #fff;
    backdrop-filter: none;
  }
}
```

Scoped to the attribute so it only ever fires on the profile page, and only when a valid backdrop
is equipped — every other page's `.card` (and the profile page's own cards when no backdrop is
equipped) keep today's opaque white.

## Data Flow

No server or schema changes. `equippedFlair.profileBackdrop` is already returned by
`GET /api/users/profile` and `GET /api/users/:id`, and already nulled out by `User.toJSON()` when
`privateMode` is true — this design only changes which client component consumes that value and
how it's positioned.

## Edge Cases

- **No backdrop equipped:** `getBackdropStyle('')` (or of `null`) returns `null` →
  `hasBackdrop` is `false` → nothing registered with `Layout`, no `data-flair-backdrop` attribute,
  page renders exactly as it does today.
- **Unknown/legacy value:** same as above — `ProfilePageBackdrop` mirrors `ProfileBackdrop`'s
  existing "unknown value renders nothing" guard.
- **Private-mode profile, viewed by someone else:** `Profile.tsx` already returns the 404-style
  "User Not Found" card before reaching the section stack, so `hasBackdrop` is never evaluated for
  that case (unchanged from today).
- **Own profile with private mode on:** `hasBackdrop` is `false` (same `!user?.privateMode` gate
  used elsewhere on this page for the other sections) — consistent with "profile-only flair,
  hidden in private mode" already documented on the removed banner.
- **Navigating away from Profile:** `usePageBackdrop`'s cleanup (`return () => setBackdrop(null)`)
  clears the registered node, so another page never inherits a stale backdrop.

## Testing

**Client**
- `ProfilePageBackdrop.test.tsx` (new, mirrors `ProfileBackdrop.test.tsx`): renders the backdrop
  class for a known value; renders nothing for null/undefined/empty/unknown values.
- `Layout.test.tsx`: with no page backdrop registered, `<main>` renders unchanged (regression
  guard given `.card` is used in 31 files); with a backdrop registered via
  `usePageBackdrop`/a test consumer, `<main>` renders it before `children`.
- `Profile.test.tsx`: `data-flair-backdrop` present when the viewed user has a valid backdrop
  equipped and is not private; absent when no backdrop, an unknown value, or `privateMode` is
  true.
- `UserInfoSection.test.tsx`: remove the now-obsolete banner assertion; confirm `ProfileBackdrop`
  is no longer imported/rendered there.

## Non-Goals

- Changing the small preview swatches in `Shop.tsx` / `MyFlairSection.tsx`.
- Any change to backdrop catalog items, values, or CSS animation timing (noted as a possible
  future tuning item: the flow-animation durations for `flair-backdrop-tanabata` /
  `flair-backdrop-koi` were tuned for a small strip and may read differently stretched across the
  full page width — not addressed here).
- Any change to `equippedFlair` gating/privacy rules.
