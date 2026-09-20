# Flair Shop Cosmetics Not Rendering on Profiles or Player Rows

## State

Complete

## Summary

The Flair Shop is fully built — players can browse items, spend points, and equip cosmetics. But purchased flair never actually appears anywhere on the site. Three disconnected gaps block rendering: the equip route stores MongoDB item IDs in `equippedFlair` while the rendering components expect CSS class strings and emoji values directly; `PLAYER_POPULATE_FIELDS` omits `equippedFlair` so flair data is stripped from every game, member, and leaderboard response; and the profile page header renders the display name in a plain `<h3>` that bypasses `UserDisplay`, so name color, icon, and title badge never appear on the profile page itself.

## Problem Details

**Gap 1 — equippedFlair stores item IDs, not renderable values**

**File:** `server/src/routes/shop.js:104`

The equip route saves the item's `_id` into the flair slot:

```js
await User.findByIdAndUpdate(req.user._id, {
  [`equippedFlair.${slot}`]: itemId,  // stores ObjectId string
});
```

But `UserDisplay` uses this value directly as a CSS class:

**File:** `client/src/components/user/UserDisplay.tsx:50`

```ts
const nameColorClass = flair?.nameColor || '';  // expects 'text-emerald-600', gets an ObjectId
```

And `UserAvatar` applies it directly as a Tailwind ring class:

**File:** `client/src/components/user/UserAvatar.tsx:46`

```ts
const borderClass = (!isPrivate && user.equippedFlair?.profileBorder) || '';  // expects 'ring-2 ring-yellow-400'
```

An ObjectId string applied as a CSS class does nothing.

---

**Gap 2 — `PLAYER_POPULATE_FIELDS` omits equippedFlair**

**File:** `server/src/models/User.js:266`

```js
const PLAYER_POPULATE_FIELDS = 'displayName avatar privateMode isGuest';
```

This constant drives every query that populates user references:

- `server/src/routes/users.js:198` — members list
- `server/src/routes/users.js:252` — player search
- `server/src/routes/users.js:419-421` — game history player rows (submittedBy, players.player, verifiedBy)

Every `UserDisplay` call across game history, the members list, and any leaderboard receives `equippedFlair: undefined`, so no flair ever renders in those contexts regardless of what is stored.

---

**Gap 3 — Profile page header bypasses UserDisplay**

**File:** `client/src/components/profile/UserInfoSection.tsx:104`

The display name is rendered as a plain `<h3>`:

```tsx
<h3 className="text-3xl font-bold text-gray-900">{user?.displayName}</h3>
```

This skips name color and name icon. The equipped title badge is not rendered anywhere on the profile page.

## Impact

- Players can buy and equip flair but see no visual change anywhere on the site — the shop feels completely broken after purchase
- Name colors, icons, and profile border rings are silently ignored in every game row, members list, and leaderboard
- The profile page header is the most prominent place a player expects to see their cosmetics, but it shows plain unstyled text

## Suggested Fix

1. **Store item value instead of item ID in the equip route** (`server/src/routes/shop.js`). Fetch the `ShopItem` in the equip handler (it currently only fetches the user), then write `item.value` to `equippedFlair[slot]` instead of `item._id`. This aligns stored data with what the rendering components expect, avoids any client-side resolution step, and is the simpler design path called out in the original spec.

2. **Add `equippedFlair` to `PLAYER_POPULATE_FIELDS`** (`server/src/models/User.js:266`):
   ```js
   const PLAYER_POPULATE_FIELDS = 'displayName avatar privateMode isGuest equippedFlair';
   ```
   This propagates flair through every existing query that uses this constant without touching each call site.

3. **Update `UserInfoSection` to surface flair on the profile header** (`client/src/components/profile/UserInfoSection.tsx`). Replace the plain `<h3>` with `UserDisplay` (large size, link disabled on own profile), or inline the name color class and icon from `user.equippedFlair`. Show the equipped title as a small badge near the avatar when `user.equippedFlair?.title` is set — the existing `Shop.tsx:148` title badge style (`px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full`) can be reused.

4. **Verify the unequip path writes `null`** — the current equip route already handles this correctly (`shop.js:92-95`), so no change needed there.

## Related Files

- `server/src/routes/shop.js`
- `server/src/models/User.js`
- `server/src/routes/users.js`
- `client/src/components/user/UserDisplay.tsx`
- `client/src/components/user/UserAvatar.tsx`
- `client/src/components/profile/UserInfoSection.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/pages/Shop.tsx`
