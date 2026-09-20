# Points Shop & Cosmetic Flair

## State

InProgress

## Summary

Once players are earning club points, they need something to spend them on. A cosmetic flair shop lets players personalize how their name and profile appear across the site — without affecting gameplay. Items fall into four categories: name color, name icon, profile border, and title prefix. The shop model stores a catalog of items with costs; users accumulate an inventory of purchased items and equip one per slot. Flair renders through the shared `UserDisplay` component, so equipped cosmetics surface everywhere a player's name appears: game history, leaderboards, tournament brackets, and profiles. Inspired by systems in League of Legends (summoner icons/borders), Discord (profile effects), and Duolingo (streak cosmetics) — cosmetics only, no stat advantages.

## Problem Details

No shop infrastructure exists. The following needs to be built:

**New model — `server/src/models/ShopItem.js`**

```js
{
  name: String (required),
  description: String (required),
  category: String enum ['nameColor', 'nameIcon', 'profileBorder', 'title'] (required),
  cost: Number (required),
  value: String (required),  // CSS class name, hex color, emoji, or title text
  previewCss: String,        // optional inline style string for shop preview
  sortOrder: Number default 0,
  isActive: Boolean default true
}
```

Example items:

| Category | Name | Value | Cost |
|----------|------|-------|------|
| `nameColor` | Jade Green | `text-emerald-600` | 200 |
| `nameColor` | Crimson | `text-red-600` | 200 |
| `nameColor` | Royal Purple | `text-purple-600` | 200 |
| `nameColor` | Ocean Blue | `text-blue-600` | 200 |
| `nameColor` | Mahjong Gold | `text-yellow-500` | 350 |
| `nameIcon` | Dragon | 🐉 | 150 |
| `nameIcon` | Cherry Blossom | 🌸 | 150 |
| `nameIcon` | Mahjong Tile | 🀄 | 150 |
| `nameIcon` | Lucky Star | ⭐ | 150 |
| `nameIcon` | Bamboo | 🎋 | 150 |
| `nameIcon` | Flame | 🔥 | 250 |
| `profileBorder` | Gold Ring | `ring-2 ring-yellow-400` | 300 |
| `profileBorder` | Dragon Scale | `ring-2 ring-emerald-500 ring-offset-1` | 400 |
| `profileBorder` | Sakura | `ring-2 ring-pink-400` | 300 |
| `title` | Dragon | Dragon | 300 |
| `title` | Champion | Champion | 400 |
| `title` | Riichi Master | Riichi Master | 500 |
| `title` | Newcomer | Newcomer | 50 |

**User model changes — `server/src/models/User.js`**

Add inventory and equipped flair:

```js
purchasedItems: [{
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
  purchasedAt: { type: Date, default: Date.now }
}],
equippedFlair: {
  nameColor: { type: String, default: null },   // ShopItem._id or null
  nameIcon:  { type: String, default: null },
  profileBorder: { type: String, default: null },
  title:     { type: String, default: null }
}
```

`equippedFlair` stores the `ShopItem._id` so the client can resolve the `value` from its local catalog. Alternatively store the `value` directly to avoid a join — the simpler choice.

**New route — `server/src/routes/shop.js`**

```
GET  /api/shop                  → list active ShopItems grouped by category
POST /api/shop/purchase         → body: { itemId }; deducts pointsBalance, adds to purchasedItems
POST /api/shop/equip            → body: { itemId, slot }; sets equippedFlair[slot] = itemId (or null to unequip)
GET  /api/shop/inventory        → current user's purchasedItems + equippedFlair
```

Purchase validation:
- User must not already own the item
- `pointsBalance >= item.cost` (use `pointsService.spendPoints`)
- Item must be `isActive: true`

**Frontend — UserDisplay flair rendering: `client/src/components/user/UserDisplay.tsx`**

Extend the `user` prop interface to include `equippedFlair`. When `equippedFlair.nameColor` is set, apply the color class to the name span. When `nameIcon` is set, render the emoji inline before the name. The `UserDisplay` component is used on leaderboards, game history, tournament pages, and profiles, so flair will appear everywhere automatically once the prop is wired.

```tsx
// name rendering with flair
const nameStyle = equippedFlair?.nameColor || '';
const nameIcon = equippedFlair?.nameIcon || '';

<span className={`font-medium ${nameStyle} ${nameClassName}`}>
  {nameIcon && <span className="mr-1 text-sm">{nameIcon}</span>}
  {displayName}
</span>
```

Profile borders apply only on the `UserAvatar` component (`client/src/components/user/UserAvatar.tsx`) — apply a CSS ring class when `equippedFlair.profileBorder` is set.

Titles render as a small badge above or below the avatar on the full profile page (`client/src/pages/Profile.tsx`). They do not appear in the compact `UserDisplay` rows to avoid cluttering lists.

**Frontend — Shop page: `client/src/pages/Shop.tsx`**

- Route: `/shop`
- Tab bar: Name Effects | Icons | Borders | Titles
- Each item card: icon/preview, name, description, cost (with coin icon), Buy / Equip / Equipped state
- "Preview" area at top of page showing the player's own name with the currently hovered item applied — gives players a live feel before buying
- Owned items show "Equip" or "Equipped" instead of cost
- Points balance displayed prominently at top: "You have X points"

**Frontend — nav: `client/src/components/Layout.tsx`**

Add `{ name: 'Shop', href: '/shop', icon: SparklesIcon }` to `communityLinks` for authenticated users.

## Impact

- Without a shop, the points system has no spending sink and players lose motivation to earn
- Players cannot personalize their presence on the site, which reduces identity and community investment
- The `UserDisplay` component already renders names uniformly across the app — flair is a single-component change that propagates everywhere

## Suggested Fix

1. Seed `ShopItem` documents in a migration script or admin seeding endpoint — the catalog is static, managed by admins
2. Create `server/src/models/ShopItem.js`
3. Add `purchasedItems` and `equippedFlair` to `server/src/models/User.js`
4. Create `server/src/routes/shop.js` with list, purchase, equip, and inventory endpoints
5. Register the shop route in `server/src/server.js`
6. Extend `client/src/services/api.ts` with shop API calls
7. Update `client/src/components/user/UserDisplay.tsx` to accept and render `equippedFlair` (name color + icon)
8. Update `client/src/components/user/UserAvatar.tsx` to accept and render profile border flair
9. Build `client/src/pages/Shop.tsx` with category tabs, item cards, and live preview
10. Add the Shop route to `client/src/App.tsx` and a nav link in `client/src/components/Layout.tsx`
11. Add the equipped flair to all API responses that include user data so `UserDisplay` receives it where it renders

## Related Files

- `server/src/models/ShopItem.js` (new)
- `server/src/models/User.js`
- `server/src/routes/shop.js` (new)
- `server/src/server.js`
- `server/src/utils/pointsService.js`
- `client/src/components/user/UserDisplay.tsx`
- `client/src/components/user/UserAvatar.tsx`
- `client/src/pages/Shop.tsx` (new)
- `client/src/pages/Profile.tsx`
- `client/src/App.tsx`
- `client/src/components/Layout.tsx`
- `client/src/services/api.ts`
