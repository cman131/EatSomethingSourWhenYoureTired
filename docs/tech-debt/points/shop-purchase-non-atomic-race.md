# Shop Purchase Is Not Atomic (Overspend, Double-Buy, Pay-Without-Item)

## State

InProgress

## Summary

`POST /api/shop/purchase` checks ownership and balance with plain reads, then spends points and grants the item in three separate writes. Two concurrent requests (a double-click, two tabs, a retry) can both pass the checks, so a user can overspend into a negative balance or be charged twice for the same item. Because the spend and the item grant are separate writes, a failure between them also leaves the user charged with nothing to show for it. Purchases are irreversible, so every one of these outcomes is permanent player-facing damage.

## Problem Details

**File:** `server/src/routes/shop.js:60-75`

Ownership and balance are checked against a stale `user` document, then two independent writes follow:

```js
const user = await User.findById(req.user._id);
const alreadyOwns = user.purchasedItems.some(p => p.item.toString() === itemId);
...
if (user.pointsBalance < item.cost) { ... }

await spendPoints(user._id, item.cost, { itemId: item._id });
await User.findByIdAndUpdate(user._id, {
  $push: { purchasedItems: { item: item._id } },
});
```

**File:** `server/src/utils/pointsService.js:30-37`

`spendPoints` repeats the balance check as a read, then decrements unconditionally, so the check does not protect the write:

```js
const user = await User.findById(userId).select('pointsBalance');
if (!user || user.pointsBalance < amount) {
  throw new Error('Insufficient points balance');
}
await PointTransaction.create({ user: userId, type: 'shop_purchase', amount: -amount, metadata });
await User.findByIdAndUpdate(userId, { $inc: { pointsBalance: -amount } });
```

**File:** `server/src/models/User.js:152-155`

`pointsBalance` has no `min: 0`, so nothing at the schema level stops a negative balance.

**File:** `client/src/pages/Shop.tsx:239-245`

The Buy button is not disabled while a request is in flight, which makes the double-submit easy to trigger (see `flair/shop-purchase-ux-error-and-confirmation.md`).

## Impact

- Two parallel purchases of the same item charge the user twice and store a duplicate `purchasedItems` entry.
- Two parallel purchases of different items can spend more than the balance, leaving `pointsBalance < 0`.
- If the `$push` fails after `spendPoints` succeeds (or the process dies between them), points are lost with no item and no automatic recovery.
- The catch block returns a generic 500, so the user has no signal that they were charged.

## Suggested Fix

1. Do the ownership check, the balance check, the debit and the grant in a single conditional update on the `User` document, for example `findOneAndUpdate` with a filter of `{ _id, pointsBalance: { $gte: cost }, 'purchasedItems.item': { $ne: item._id } }` and an update that `$inc`s the balance and `$push`es the item. A `null` result means one of the guards failed; re-read to decide which error to return (`Insufficient points balance` vs `You already own this item`).
2. Write the `shop_purchase` ledger row after the atomic update succeeds. How to keep the ledger and balance consistent if that insert fails is handled in `points/point-ledger-non-atomic-writes.md`; coordinate the two so `spendPoints` has one final shape.
3. Add `min: 0` to `pointsBalance` as a backstop, after confirming no existing user is already negative (query first; fix data before adding the validator).
4. Return 400 for an invalid `itemId` instead of a cast-error 500 (see `flair/equip-slot-category-not-validated.md`, which covers the same input handling on the equip route).
5. Add tests that fire two purchases concurrently (same item, and two different items against an insufficient balance) and assert exactly one succeeds and the balance never goes negative.

## Related Files

- `server/src/routes/shop.js`
- `server/src/utils/pointsService.js`
- `server/src/models/User.js`
- `server/src/routes/shop.test.js`
- `server/src/utils/pointsService.test.js`
- `client/src/pages/Shop.tsx`
