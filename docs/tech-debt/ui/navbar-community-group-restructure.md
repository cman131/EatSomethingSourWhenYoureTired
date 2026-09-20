# Nav Bar Community Group Restructure

## State

InProgress

## Summary

The nav bar's top-level order and group membership are inconsistent. Tournaments and Ranked sit as flat top-level links alongside Events and Store, while the Community dropdown — which is auth-gated and rendered after all top-level links — contains only Games and Achievements. The desired structure moves Tournaments and Ranked into the Community group (renamed to "Play"), positions it immediately after Events, and removes Achievements from the nav (tracked separately in the achievement-removal plan). Both the desktop hover-dropdown and the mobile collapsible accordion need to reflect this change.

## Problem Details

**File:** `client/src/components/Layout.tsx:36–56`

The `navigation` array includes Tournaments and Ranked as flat links (lines 38–39), which places them before the Community dropdown in the desktop nav. The Community dropdown is defined separately and renders only when `isAuthenticated` (line 106):

```typescript
const navigation = [
  { name: 'Events', ... },
  { name: 'Tournaments', href: '/tournaments', icon: TrophyIcon },  // move to Play group
  { name: 'Ranked', href: '/ranked', icon: StarIcon },               // move to Play group
  { name: 'Store', ... },
];

const communityLinks = isAuthenticated ? [
  { name: 'Games', href: '/games', icon: ChartBarIcon },
  { name: 'Achievements', ... },  // removal tracked in remove-achievement-system.md
] : [];
```

The Community dropdown button renders at line 106, after the full `navigation` map, producing the current desktop order: Events → Tournaments → Ranked → Store → Community → Learning.

On mobile (lines 248–314), the same ordering applies: the `navigation` items render first, then the Community accordion, then the Resources accordion.

## Impact

- Tournaments and Ranked are split from Games in the nav, making competitive features appear disjointed rather than as a unified "Play" surface
- The Community group renders after Store in the desktop nav, burying the most-used authenticated features behind an external link
- Unauthenticated users see Tournaments and Ranked as top-level links but have no group context; authenticated users see a differently-shaped nav

## Suggested Fix

1. Remove `Tournaments` and `Ranked` from the `navigation` array (`Layout.tsx:38–39`). Leave only `Events` and `Store`.

2. Rename the community group variable (e.g. `playLinks`) and update its contents to `[Tournaments, Ranked, Games]` in that order. Remove the `Achievements` entry (tracked separately in `docs/tech-debt/users/remove-achievement-system.md`).

3. The group should always render — not auth-gated at the group level — since Tournaments and Ranked are public routes. Conditionally include the `Games` link only when `isAuthenticated`. If no auth-only items are present (logged-out), the dropdown still shows with Tournaments and Ranked.

4. On desktop: move the group's `<div>` (currently at line 107) to render immediately after the Events link, before the remaining `navigation` items. Update the group label to "Play" and choose an appropriate icon (e.g. `TrophyIcon` or `UserGroupIcon`).

5. On mobile: reorder the accordion sections so the Play group appears after Events and before Store. Update the label and icon to match desktop.

6. Remove the now-unused `FaMedal` import (line 20) if the Achievements entry is removed here; otherwise leave cleanup to `docs/tech-debt/users/remove-achievement-system.md`.

## Related Files

- `client/src/components/Layout.tsx`
