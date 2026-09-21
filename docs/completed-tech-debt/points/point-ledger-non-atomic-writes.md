# Point Ledger and Balance Are Written Separately, With an Extra Query per Award

## State

Complete

## Summary

Every award or spend does two independent writes: insert a `PointTransaction`, then `$inc` the user's `pointsBalance` and `totalPointsEarned`. If the second write fails, the ledger says one thing and the balance another, and there is no reconciliation to detect it. `awardPoints` also performs a separate `isGuest` lookup for every single award, so verifying one game costs six extra queries before any write happens.

## Problem Details

**File:** `server/src/utils/pointsService.js:4-14`

```js
async function awardPoints(userId, type, amount, metadata = {}) {
  const user = await User.findById(userId).select('isGuest');
  if (user && user.isGuest) {
    return;
  }

  await PointTransaction.create({ user: userId, type, amount, metadata });
  await User.findByIdAndUpdate(userId, {
    $inc: { pointsBalance: amount, totalPointsEarned: amount },
  });
}
```

- The ledger insert and the balance update are not atomic. A crash or DB error between them leaves a transaction row with no balance change (or, if the order were reversed, the opposite).
- The guest check runs once per call. `awardGamePoints` calls `awardPoints` up to 6 times per verified game (`pointsService.js:53-59`), and `awardTournamentPoints` calls `awardPointsOnce` (which calls `awardPoints`) for every participant.

**File:** `server/src/utils/pointsService.js:17-28`

`awardPointsOnce` de-duplicates with a read (`PointTransaction.exists`) followed by a write. There is no unique index on the ledger, so two concurrent calls can both pass the check and both pay.

**File:** `server/src/models/PointTransaction.js:45`

The only index is `{ user: 1, createdAt: -1 }`; nothing enforces "once per (user, type, source)".

## Impact

- `pointsBalance` and the sum of a user's `PointTransaction` rows can silently diverge; nothing today would notice.
- Tournament completion and game verification are slower than needed (N extra guest queries).
- Concurrent tournament-completion requests can pay participation or placement points twice.

## Suggested Fix

1. Decide on the consistency model. Options: (a) Mongo multi-document transactions around the two writes (requires a replica set; check the production and local dev deployments first, since `.claude/rules/context.md` only says "start MongoDB locally"); (b) keep the ledger as the source of truth and write it first, then apply the balance `$inc`, with a reconciliation report (see `points/admin-point-adjustment-and-ledger-reconciliation.md`) that detects and repairs drift.
2. Remove the per-award guest query: resolve guest IDs once per batch (one `User.find({ _id: { $in }, isGuest: true })`) in `awardGamePoints` and `awardTournamentPoints`, or filter guests at the call site.
3. Back `awardPointsOnce` with a unique (partial) index on `(user, type, metadata.<source id>)` and treat a duplicate-key error as "already awarded", instead of the read-then-write check.
4. Extend the pointsService tests to cover a failing second write and concurrent `awardPointsOnce` calls.

Coordinate with `points/shop-purchase-non-atomic-race.md` (`spendPoints`) and `points/game-points-award-not-idempotent.md` so all three settle on one shape for the award/spend helpers.

## Related Files

- `server/src/utils/pointsService.js`
- `server/src/utils/pointsService.test.js`
- `server/src/models/PointTransaction.js`
- `server/src/models/User.js`
- `server/src/routes/tournaments.js`
- `server/src/routes/games.js`
