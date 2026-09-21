# Retired Shop Items Cannot Be Unequipped, and Re-Adding One Does Not Reactivate It

## State

Complete

## Summary

The catalog seed deactivates any item removed from `SHOP_CATALOG`, and the shop only renders active items. A user who owns and has equipped a retired item therefore has no place in the UI to unequip it, and they also cannot see that they own it. Separately, if an item is re-added to the catalog later, the seed never sets `isActive` back to true because it only sets that field on insert, so the item stays hidden.

## Problem Details

**File:** `server/src/routes/shop.js:127-146`

```js
await ShopItem.updateMany({ name: { $nin: catalogNames } }, { $set: { isActive: false } });
...
ShopItem.findOneAndUpdate(
  { name },
  {
    $set: { cost, tier, description, value, sortOrder },
    $setOnInsert: { name, category, isActive: true },
  },
  { upsert: true, new: true }
)
```

`isActive` is in `$setOnInsert`, so an existing deactivated document is never reactivated.

**File:** `server/src/routes/shop.js:11-26`

`GET /api/shop` returns only `isActive: true` items.

**File:** `client/src/pages/Shop.tsx:103` and `:192-264`

`currentItems` comes from the catalog only, and the equipped/Equip buttons render inside that list. An owned but retired item has no card, so `handleEquip(item)` (`:71-83`) is unreachable for it. `ownedIds` (`:52-54`) is built from the inventory but is only used to decorate catalog cards.

**File:** `client/src/pages/Shop.tsx:52-54`

`(inventory?.purchasedItems ?? []).map(p => p.item._id)` assumes every populated `item` is non-null; a hard-deleted ShopItem would crash the page (nothing deletes items today, so this is hardening).

## Impact

- A user stuck with a retired title or border cannot remove it or swap it except by equipping another item of the same slot that happens to still be listed.
- Owners of a retired item cannot see it in the shop at all, so it looks like it vanished.
- Temporarily removing an item (for example to fix a style bug) permanently hides it even after it is restored in the catalog.

## Suggested Fix

1. In the seed, set `isActive: true` in `$set` for every item present in the catalog so re-adding reactivates it. Keep `category` in `$setOnInsert`.
2. Have `GET /api/shop/inventory` return owned items regardless of `isActive`, and have the Shop page render an "Owned (retired)" group (per category tab or a separate section) with equip/unequip actions but no Buy button.
3. Guard against null populated items in the client and server (filter or skip missing references).
4. Confirm the equip route accepts equipping an owned inactive item (today it does not check `isActive`, which is what we want for owners) and add a test that documents this.
5. Add seed tests for reactivation and for "retired items remain equippable by owners", next to the existing seed tests (`server/src/routes/shop.test.js:235-252`).
6. This is also the behavior that `flair/prestige-earn-only-shop-items.md` and limited-time items depend on: expired items must remain visible to the people who own them.

## Related Files

- `server/src/routes/shop.js`
- `server/src/routes/shop.test.js`
- `server/src/data/shopCatalog.js`
- `server/scripts/seedShop.js`
- `client/src/pages/Shop.tsx`
- `client/src/pages/__tests__/Shop.test.tsx`
