# Admin Point Adjustments and Ledger Reconciliation Tooling

## State

Complete

## Summary

There is no supported way for an admin to correct a player's points, and no way to check that a player's `pointsBalance` matches their transaction history. Every fix from the points plans (missed awards, reversals after a deleted game, a wrongly-penalized negative balance) currently means editing MongoDB by hand, which leaves no audit trail. This is a design proposal for a small admin surface: a manual adjustment with a required reason, and a reconciliation report that compares balances to the ledger.

## Problem Details

**File:** `server/src/models/PointTransaction.js:3-18`

The transaction types are all automatic (game, tournament, ranked, `shop_purchase`). There is no `admin_adjustment` type and `metadata` (`:35-40`) has no place to record who made a change or why.

**File:** `server/src/routes/points.js:10-61`

The points router only exposes the current user's summary and history. No admin routes exist for points; the only admin-only shop route is catalog seeding (`server/src/routes/shop.js:121-127`, `if (!req.user.isAdmin)`), which is the pattern to follow.

**File:** `server/src/models/User.js:152-159`

`pointsBalance` and `totalPointsEarned` are denormalized counters. Because ledger and balance are written separately (`points/point-ledger-non-atomic-writes.md`), drift is possible and undetectable today. `game_played` transactions from an earlier scheme may still exist (`PointTransaction.js:4`) and must be understood by any reconciliation.

## Impact

- Correcting a missed or wrong award requires direct database access and leaves the ledger and balance disagreeing.
- Admins cannot answer "why does this player have N points?" without querying the collection by hand.
- The reversal and replay work in `points/game-points-award-not-idempotent.md` and `points/verified-game-delete-edit-no-points-reconciliation.md` has no operator-facing way to be triggered or verified.

## Suggested Fix

1. Add an `admin_adjustment` type (and any `reversal` type the other plans settle on) to `POINT_TRANSACTION_TYPES`, and declare `adjustedBy` and `reason` in the `metadata` schema. Add labels in `client/src/pages/Points.tsx:9-24`.
2. Add admin-only `POST /api/points/admin/adjust` (`userId`, signed `amount`, required `reason`) that goes through the same atomic award/spend helper as everything else, so it obeys the same consistency model. Decide whether adjustments count toward `totalPointsEarned` (recommended: positive adjustments do not, so lifetime-earned reflects play; confirm).
3. Add an admin-only reconciliation report: for each user, sum of ledger amounts vs `pointsBalance`, and sum of positive earn amounts vs `totalPointsEarned`, listing mismatches. Start as a script in `server/scripts/`, expose as an endpoint only if wanted. An optional `--fix` should itself write adjustments rather than overwrite counters.
4. Decide the audit visibility: adjustments should be visible to the affected player in their history with the reason.
5. Tests: adjust up/down, non-admin rejected, reconciliation detects an injected mismatch.

## Related Files

- `server/src/models/PointTransaction.js`
- `server/src/routes/points.js`
- `server/src/utils/pointsService.js`
- `server/src/models/User.js`
- `server/scripts/` (new reconciliation script)
- `client/src/pages/Points.tsx`
