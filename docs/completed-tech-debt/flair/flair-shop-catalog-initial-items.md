# Flair Shop Initial Catalog — 30 Items, Tier Field, Premium Rendering

## State

Complete

## Summary

The Flair Shop launched with 18 placeholder seed items at flat prices (50–500 pts) with no visual distinction between tiers. The approved catalog design (`docs/superpowers/specs/2026-09-20-flair-catalog-design.md`) defines 30 items across 4 categories (nameColor, nameIcon, profileBorder, title) with a three-tier pricing model — entry (100–150 pts), mid (200–350 pts), premium (500–700 pts). Implementing this catalog requires replacing the seed data, adding a `tier` field to `ShopItem`, creating a flair CSS stylesheet for animated premium borders, and updating `UserAvatar` and the title badge renderer to handle premium-tier visual treatment. All 30 items are purchasable with points by any player — no achievement gates in this pass.

## Problem Details

**Gap 1 — SEED_ITEMS is stale and incomplete**

**File:** `server/src/routes/shop.js:114`

The hardcoded `SEED_ITEMS` array has 18 items using flat pricing and includes items the catalog drops (Newcomer title, Dragon title, Champion, Riichi Master). The new catalog defines 30 items with tiered costs; prices on retained items change significantly (e.g., Gold Ring: 300 → 600 pts, Dragon icon: 150 → 300 pts).

```js
const SEED_ITEMS = [
  { name: 'Jade Green', ..., cost: 200, ... },  // new cost: 250
  { name: 'Newcomer', ..., cost: 50, ... },      // dropped from catalog
  // 16 more items...
];
```

---

**Gap 2 — ShopItem model has no `tier` field**

**File:** `server/src/models/ShopItem.js:3`

```js
const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['nameColor', 'nameIcon', 'profileBorder', 'title'], required: true },
  cost: { type: Number, required: true },
  value: { type: String, required: true },
  previewCss: { type: String, default: null },  // exists but unused
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});
```

No `tier` field exists. Premium border and title rendering must branch on tier, and the API response needs to carry it. The existing `previewCss` field is unused — it will hold inline style strings for premium item shop card previews.

---

**Gap 3 — UserAvatar applies border value as a ring class; no premium wrapper path**

**File:** `client/src/components/user/UserAvatar.tsx:46`

```tsx
const borderClass = (!isPrivate && user.equippedFlair?.profileBorder) || '';
// applied directly:
<div className={`${sizeClass} rounded-full ... ${borderClass} ${className}`}>
```

Premium borders (`flair-border-rainbow`, `flair-border-dragon`) use a spinning conic-gradient `div` that wraps the avatar element — they cannot be applied as a class on the avatar itself. When a premium border class is applied this way, it has no visible effect.

---

**Gap 4 — Shop.tsx border preview card can't render premium borders**

**File:** `client/src/pages/Shop.tsx:195`

```tsx
{item.category === 'profileBorder' && (
  <div className={`w-8 h-8 rounded-full bg-gray-300 ${item.value}`} />
)}
```

Same problem as Gap 3 in miniature — `flair-border-rainbow` applied as a class on a plain div does nothing. Premium border cards will show a featureless grey circle.

---

**Gap 5 — Title badges use a fixed style for all tiers**

**File:** `client/src/pages/Shop.tsx:198`

```tsx
{item.category === 'title' && (
  <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
    {item.value}
  </span>
)}
```

Premium titles (Chicken Farmer, Chombo Chaser) need distinct gradient badge styles — gold gradient with brown text for Chicken Farmer; red→purple gradient with white text for Chombo Chaser. The same flat `bg-primary-100` style is also applied in `UserDisplay` wherever the equipped title renders.

---

**Gap 6 — No flair CSS stylesheet exists**

**File:** `client/src/index.css` (no `flair-border-*` classes defined anywhere)

The `flair-border-rainbow` and `flair-border-dragon` CSS classes and their `@keyframes` animations don't exist in any stylesheet. Until they do, premium border items are invisible.

## Impact

- The store launches with 18 stale placeholder items instead of the 30-item catalog players expect — first impressions matter
- Premium border items display as plain grey circles in shop cards and have no visual effect when equipped
- Premium titles (Chicken Farmer, Chombo Chaser) render with the same plain blue-tinted badge as entry-tier items
- `previewCss` is wired up on the model but never populated or consumed, making it dead weight
- Players spending 600–700 pts on premium items see no difference from mid-tier items

## Suggested Fix

1. **Add `tier` field to `ShopItem` and update `SEED_ITEMS`** (`server/src/models/ShopItem.js`, `server/src/routes/shop.js`). Add `tier: { type: String, enum: ['entry', 'mid', 'premium'], default: 'entry' }` to the schema. Replace `SEED_ITEMS` wholesale with the 30 items from the spec — each item includes `tier`, updated `cost`, and `previewCss` for premium items. The seed route is already idempotent (`$setOnInsert`) so re-seeding is safe; add `$set` for fields that should update on existing items (cost, tier, previewCss).

2. **Create `client/src/styles/flair.css`** with `@keyframes` for the spinning gradient and `.flair-border-*` wrapper classes:
   - `.flair-border-rainbow`: 40px wrapper with `conic-gradient(#facc15, #fb923c, #f87171, #e879f9, #818cf8, #34d399, #facc15)` spinning at 3s linear infinite; 3px inset white gap; inner content circle
   - `.flair-border-dragon`: same wrapper with `conic-gradient(#34d399, #059669, #065f46, #059669, #34d399, #6ee7b7, #34d399)` at 4s reverse
   - `.flair-border-inner`: positioned inner div that clips the avatar back to a circle
   Import `flair.css` from `client/src/index.css`.

3. **Update `UserAvatar` to wrap premium borders** (`client/src/components/user/UserAvatar.tsx`). `UserAvatar` currently receives only `equippedFlair` values (strings), not the full `ShopItem`. Pass `tier` through `equippedFlair` or check whether `profileBorder` starts with `flair-border-`. When premium, render:
   ```tsx
   <div className={`flair-border-wrapper ${borderClass}`}>
     <div className="flair-border-inner">{/* avatar content */}</div>
   </div>
   ```
   The cleanest approach: add `profileBorderTier?: string` to `EquippedFlair` in the API types and populate it from the API response.

4. **Update title badge rendering for premium tiers** (`client/src/pages/Shop.tsx`, `client/src/components/user/UserDisplay.tsx`). When `item.tier === 'premium'` (shop preview) or `equippedFlair.titleTier === 'premium'` (display), apply the gradient CSS class instead of the flat primary pill. Define `.flair-title-chicken` and `.flair-title-chombo` in `flair.css`, or use `previewCss` inline styles for the shop card swatch and a data-driven class mapping for `UserDisplay`.

5. **Use `previewCss` in Shop.tsx card previews for premium items** (`client/src/pages/Shop.tsx`). When `item.previewCss` is set, use it as an inline `style` prop on the swatch element in the card. This lets the shop card show a gradient swatch or glowing ring preview without needing to import animations.

## Related Files

- `server/src/models/ShopItem.js`
- `server/src/routes/shop.js`
- `client/src/components/user/UserAvatar.tsx`
- `client/src/components/user/UserDisplay.tsx`
- `client/src/pages/Shop.tsx`
- `client/src/index.css`
- `client/src/styles/flair.css` *(new file)*
- `client/src/services/api.ts` *(EquippedFlair type)*
- `docs/superpowers/specs/2026-09-20-flair-catalog-design.md`
