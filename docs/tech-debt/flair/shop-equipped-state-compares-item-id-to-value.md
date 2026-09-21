# Flair Shop Never Shows Items as Equipped and Cannot Unequip Them

## State

New

## Summary

The Flair Shop page decides whether an item is "equipped" by comparing `equippedFlair[slot]` against `item._id`, but the server stores and returns the item's denormalized `value` (for example `flair-color-pink` or `🏮`) in `equippedFlair`, not its id. The comparison can never be true, so (inferred from the code, not observed in a browser) the "Equipped ✓" button state never renders, clicking an already-equipped item sends another equip request instead of the unequip request, and the toast always says "Equipped". The mismatch is a leftover from an earlier fix that changed the stored shape to values so avatars and names could render; the Shop page and its test fixtures were never updated to match.

## Problem Details

**Server stores the value, not the id.**

**File:** `server/src/routes/shop.js:109-111`

```js
await User.findByIdAndUpdate(req.user._id, {
  [`equippedFlair.${slot}`]: item.value,
});
```

**File:** `server/src/models/User.js:164-169` - every slot is a plain `String` defaulting to `null`, not an `ObjectId` reference:

```js
equippedFlair: {
  nameColor:     { type: String, default: null },
  nameIcon:      { type: String, default: null },
  profileBorder: { type: String, default: null },
  title:         { type: String, default: null },
},
```

**Server returns it unchanged.**

**File:** `server/src/routes/shop.js:33-39` - `GET /api/shop/inventory` returns `equippedFlair: user.equippedFlair` as-is, so the client receives values.

**Client compares against the id (two places).**

**File:** `client/src/pages/Shop.tsx:72-75`

```ts
const isEquipped = equippedFlair[slot] === item._id;
try {
  await shopApi.equip(isEquipped ? null : item._id, slot);
  setActionSuccess(isEquipped ? `Unequipped ${item.name}` : `Equipped ${item.name}!`);
```

**File:** `client/src/pages/Shop.tsx:191`

```ts
const equipped = equippedFlair[item.category] === item._id;
```

`equippedFlair[...]` holds a value string and `item._id` is a Mongo ObjectId string, so both expressions are always `false`. That means the `owned && equipped` branch (`Shop.tsx:243-250`, the green "Equipped ✓" button) is unreachable, and the `owned && !equipped` branch (`Shop.tsx:251-258`, "Equip") is always rendered. The unequip request (`itemId === null`, handled by `shop.js:91-96`) is therefore never sent from the UI.

Note that the same file already treats `value` as the equipped identity elsewhere: the hover preview writes `hoveredItem.value` into `equippedFlair` (`Shop.tsx:85-87`) and the preview title lookup matches `i.value === previewTitleValue` (`Shop.tsx:96-98`). Only the equipped-state checks use `_id`.

**Types do not catch it.**

**File:** `client/src/services/api.ts:766-771` - `EquippedFlair` is four `string | null` fields with no indication of whether the string is an id or a value, and `ShopInventory` (`api.ts:785-789`) reuses it. `shopApi.equip(itemId: string | null, ...)` (`api.ts:807-812`) takes an id. Both `item._id` and `item.value` are `string`, so the compiler cannot flag the wrong comparison.

**Existing tests use ids, which hides the bug.**

- `client/src/pages/__tests__/Shop.test.tsx:137` - the "shows Equipped badge for currently equipped item" test builds the inventory with `equippedFlair: { nameColor: ownedItem._id, ... }`. It passes only because the fixture uses the id shape the real server never returns. (The fixture item `_id` is `'item1'` and its `value` is `'text-emerald-600'`, so the test data itself distinguishes the two.) The same file's title test at `Shop.test.tsx:216` uses the value shape (`title: 'Chicken Farmer'`), so the file is internally inconsistent.
- `server/src/routes/shop.test.js:154` and `:196` - the unequip test and the inventory test seed `'equippedFlair.nameColor': item._id.toString()`, while the equip test at `shop.test.js:140-149` correctly asserts `equippedFlair.nameColor` equals `item.value`. The inventory test at `:203` therefore asserts an id round-trip that the equip route never produces.
- `server/src/models/User.shopFlair.test.js:85-89` - also stores `item._id.toString()` in `equippedFlair.nameColor`.
- No test covers clicking "Equipped ✓" to unequip, or the "Unequipped" toast.

**Other consumers read values directly.**

- `client/src/components/user/UserDisplay.tsx:50-53` - `nameColor` is applied as a CSS class, `nameIcon` and `title` are rendered as text.
- `client/src/components/user/UserAvatar.tsx:48` - `profileBorder` is applied as a CSS class and fed to `isPremiumBorder` / `isMidTierBorder`.
- `client/src/components/profile/UserInfoSection.tsx:105-113` - same pattern on the profile header.
- `server/src/models/User.js:266` - `PLAYER_POPULATE_FIELDS` includes `equippedFlair`, so every game row, member list and leaderboard response carries the value shape.

**History.** The completed plan `docs/completed-tech-debt/flair/flair-cosmetics-not-rendering.md` describes the earlier state where the equip route stored `itemId`; that was changed to `item.value` so cosmetics render. The Shop page comparison was not updated in that change.

## Impact

- The "Equipped ✓" state never appears, so players cannot tell from the Shop which cosmetic is active.
- A player cannot unequip a cosmetic through the Shop UI: clicking the item re-sends an equip request for the same item, which is a no-op. (Unequip works at the API level only.)
- The success toast always reads "Equipped <name>!", never "Unequipped".
- Existing tests pass while the real behavior is broken, so this class of regression is not caught.
- Anyone who equipped an item before the stored shape changed may still hold an ObjectId string in a slot, which would render as a meaningless CSS class or literal text on avatars and names. This is a hypothesis from the git history and needs a database check before deciding whether cleanup is required.

## Suggested Fix

Options considered:

1. **Compare on `item.value` on the client (recommended).** Change `Shop.tsx:72` and `Shop.tsx:191` to compare `equippedFlair[slot] === item.value`. Keep `shopApi.equip(item._id, slot)` unchanged, since the server needs the id for the ownership check.
   - Pros: two-line change in one file; no server, schema or data-migration change; consistent with the preview logic that already uses `value`; leaves every avatar/name render path untouched.
   - Cons: relies on `value` being unique within a category. `ShopItem` (`server/src/models/ShopItem.js`) has no uniqueness constraint, so two items sharing a `value` in the same category would both show as equipped. Mitigate by adding a compound unique index on `{ category, value }` (check existing seed data for collisions first) or at minimum by noting the invariant next to the catalog seed.
2. **Store item ids in `equippedFlair` and resolve to values on read.** Change the slots to ids and have every consumer resolve them (populate in `PLAYER_POPULATE_FIELDS`, or a client lookup).
   - Pros: single source of truth, robust to value renames.
   - Cons: large ripple. `UserDisplay.tsx`, `UserAvatar.tsx`, `UserInfoSection.tsx`, every response that populates players (games, members, leaderboards) and their tests all read values directly today. It needs a data migration for all existing users, a populate step on many endpoints, and reverses the earlier rendering fix. Not justified for a comparison bug.
3. **Return both from the server.** Keep storing values, but have `GET /api/shop/inventory` also return `equippedItemIds` (slot to id) by looking items up by `{ category, value }`, and have the client compare ids.
   - Pros: the client keeps comparing ids, and it is robust to duplicate values.
   - Cons: an extra query and an API shape change for what option 1 achieves client-side; still needs the `{ category, value }` lookup to be unambiguous, so it inherits the same uniqueness concern.

Recommendation: option 1, plus the uniqueness safeguard, and do not change the stored shape.

Steps:

1. In `Shop.tsx`, extract a small helper (for example `isItemEquipped(equippedFlair, item)`) that returns `equippedFlair[item.category] === item.value`, and use it in both `handleEquip` (`:72`) and the grid (`:191`), so the two sites cannot drift again.
2. Fix the test fixtures so they reflect what the server returns: `Shop.test.tsx:137` should use `ownedItem.value`. Add tests that clicking "Equipped ✓" calls `shopApi.equip(null, slot)` and shows "Unequipped <name>", and that clicking "Equip" calls `shopApi.equip(item._id, slot)` and shows "Equipped <name>!".
3. Fix the server-side fixtures that seed ids into `equippedFlair` (`shop.test.js:154`, `:196`, `User.shopFlair.test.js:85-89`) to seed `item.value`, and update the inventory assertion at `shop.test.js:203` accordingly.
4. Add a short comment or type alias in `api.ts` (`EquippedFlair`, `:766`) stating that the fields hold the item's `value`, not its `_id`, so the next reader does not repeat the mistake.
5. Check the database for users whose `equippedFlair` slots hold 24-hex ObjectId strings (leftovers from the earlier shape) and, if any exist, null them out with a one-off script. Skip if none are found.
6. Optionally add a `{ category, value }` unique index on `ShopItem` after verifying the seed data has no duplicates.

Sequencing: a separate flair-catalog expansion is being designed and will edit `Shop.tsx` and `client/src/utils/flairUtils.ts`. Land this fix first, since the Shop.tsx change is two small lines plus a helper and is needed for the expansion's new items to behave correctly. If the expansion starts before this merges, fold step 1 into the same Shop.tsx changes rather than running two branches over the same file. Either way, the uniqueness check in step 6 is most useful to run against the expanded catalog, so it should be revisited once the new items exist.

## Related Files

- `client/src/pages/Shop.tsx`
- `client/src/pages/__tests__/Shop.test.tsx`
- `client/src/services/api.ts`
- `client/src/utils/flairUtils.ts` (no change expected; touched by the concurrent catalog expansion)
- `client/src/components/user/UserDisplay.tsx` (read-only consumer; must keep receiving values)
- `client/src/components/user/UserAvatar.tsx` (read-only consumer; must keep receiving values)
- `client/src/components/profile/UserInfoSection.tsx` (read-only consumer)
- `server/src/routes/shop.js`
- `server/src/routes/shop.test.js`
- `server/src/models/User.js`
- `server/src/models/User.shopFlair.test.js`
- `server/src/models/ShopItem.js` (only if adding the uniqueness index)
- `docs/completed-tech-debt/flair/flair-cosmetics-not-rendering.md` (background)
