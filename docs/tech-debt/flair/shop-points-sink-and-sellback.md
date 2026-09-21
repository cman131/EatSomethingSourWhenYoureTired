# Shop Points Sink and Sell-Back: What to Do With Points After the Catalog

## State

New

## Summary

Points have exactly one use: buying each catalog item once. The full catalog costs 9,375 points, which a regular player can eventually finish, after which earned points have no purpose, and until then every purchase is final even when the player regrets it. This is a design proposal for two related mechanisms: a sell-back (partial refund of an item) and points sinks beyond one-off cosmetics, so the economy stays meaningful and players can experiment without permanent cost.

## Problem Details

**File:** `server/src/data/shopCatalog.js:8-79`

63 items across four categories cost 9,375 points in total (name colors 2,300, icons 2,525, borders 2,525, titles 2,025, summed from the catalog). A single tournament win pays 200 (`server/src/utils/pointsService.js:71`), so the catalog is finite and reachable.

**File:** `server/src/routes/shop.js:60-66`

Ownership is a permanent one-time fact (`alreadyOwns` blocks repurchase), and there is no route that removes an item or refunds points. The `shop_purchase` type is the only spend type (`server/src/models/PointTransaction.js:17`), and `spendPoints` hard-codes it (`pointsService.js:35`).

**File:** `server/src/models/ShopItem.js:3-17`

Items model only one-time cosmetics; there is no notion of a repeatable or consumable purchase, so anything like "extra loadout slot" or "donate to the club prize pool" cannot be represented.

**File:** `client/src/pages/Shop.tsx:59-83`

The UI offers Buy and Equip/Unequip only; there is no way to return an item.

## Impact

- Late-game players accumulate unspendable points, weakening the earning loop for the players who are most engaged.
- A wrong purchase (misclick, changed mind, item that looks different than expected) is permanent; this makes players hesitant to spend.
- Every proposed new earning path (`points/new-earning-paths-quizzes-and-streaks.md`, `points/ranked-season-end-placement-rewards.md`) increases income without adding any spending option.

## Suggested Fix

Decisions needed first (this plan should not proceed until these are chosen):

- Sell-back rate (for example 50%) and whether it applies to all items; earned items (`flair/prestige-earn-only-shop-items.md`) and limited-time items should not be sellable.
- Which sinks the club wants: extra saved-loadout slots (`flair/profile-equip-and-saved-loadouts.md`), a real-world prize pool with admin-set goals, name-change or similar tokens, or none.
- Whether points may ever be negative or rolled back on sell (no; sell only adds points).

Then:

1. Add a `shop_refund` transaction type and a `POST /api/shop/sell` route that removes the item from `purchasedItems`, unequips any slot that holds it, and credits the refund in one atomic update, following the consistency model from `points/point-ledger-non-atomic-writes.md`. Guard against sell/buy loops that exploit price changes by refunding the price paid (record it on the `purchasedItems` entry) rather than the current catalog price.
2. Add a repeatable-purchase concept to `ShopItem` (for example a `repeatable` or `consumable` flag) so the ownership check in the purchase route allows multiple purchases for those items only.
3. Implement the chosen sinks as catalog entries with the appropriate effect, starting with the cheapest one (loadout slots).
4. Confirm-and-explain UI for selling (rate, resulting balance), reusing the confirmation component from `flair/shop-purchase-ux-error-and-confirmation.md`.
5. Tests: sell-back atomicity, sold item is unequipped, price-paid refund after a catalog price change, earned items cannot be sold.

## Related Files

- `server/src/routes/shop.js`
- `server/src/models/ShopItem.js`
- `server/src/models/User.js`
- `server/src/models/PointTransaction.js`
- `server/src/utils/pointsService.js`
- `server/src/data/shopCatalog.js`
- `client/src/pages/Shop.tsx`
- `client/src/pages/Points.tsx`
- `client/src/services/api.ts`
