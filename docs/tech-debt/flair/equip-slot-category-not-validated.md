# Equip Route Does Not Check That the Item Belongs to the Requested Slot

## State

New

## Summary

`POST /api/shop/equip` takes an `itemId` and a `slot` from the request body and validates them independently: the slot must be one of the four known names, and the user must own the item. It never checks that the item's `category` matches the `slot`, so an owned name color can be written into the `title` slot (or an icon into `profileBorder`, and so on). The stored value is then handed to renderers that expect a different kind of value. The UI never sends a mismatched pair, so this only happens through a hand-crafted request, but it puts unrenderable data on the user's profile that shows up everywhere their name does.

## Problem Details

**File:** `server/src/routes/shop.js:84-112`

```js
const { itemId, slot } = req.body;
if (!VALID_SLOTS.includes(slot)) { ... 400 }
...
const owns = user.purchasedItems.some(p => p.item.toString() === itemId);
...
const item = await ShopItem.findById(itemId);
...
await User.findByIdAndUpdate(req.user._id, {
  [`equippedFlair.${slot}`]: item.value,
});
```

`item.category` is never compared with `slot`.

**File:** `server/src/routes/shop.js:55` and `:105`

`itemId` is passed to `findById` unvalidated, so a malformed id throws a cast error and the route returns 500 instead of 400. The purchase route has the same input handling at line 55.

**File:** `server/src/routes/shop.test.js:141-190`

The equip tests cover a valid equip, unequip, a non-owned item and an invalid slot name, but no category/slot mismatch case.

## Impact

- A crafted request can put, for example, `flair-color-pink` into `equippedFlair.title`; `TitleBadge` and other components then receive a value outside their registry (`client/src/utils/flairUtils.ts`), which may render as a blank or malformed badge in every list that shows the user.
- Any such bad value persists until the user re-equips, and there is no cleanup path.
- Malformed ids return 500 rather than a client error, polluting error monitoring.

## Suggested Fix

1. After loading the item, reject with 400 when `item.category !== slot`.
2. Validate `itemId` as an ObjectId in both `equip` and `purchase` (`validateMongoId(paramName)` in `server/src/middleware/validation.js:158` validates route params and is used by the games routes; the equip and purchase ids come from the request body, so add a body-field equivalent) and return 400.
3. Add tests: mismatched slot/category is rejected and leaves `equippedFlair` unchanged; malformed id returns 400.
4. Check existing data with a one-off query for `equippedFlair.<slot>` values that do not match any catalog item of that slot's category; clear or repair any found (script under `server/scripts/`, dry-run by default).
5. If saved loadouts are added (`flair/profile-equip-and-saved-loadouts.md`), route them through the same validation so the check lives in one place.

## Related Files

- `server/src/routes/shop.js`
- `server/src/routes/shop.test.js`
- `server/src/models/User.js`
- `server/src/middleware/validation.js`
- `server/scripts/` (data-check script)
