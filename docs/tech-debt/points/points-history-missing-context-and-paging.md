# Points History Drops Purchase Details, Has Unbounded Paging, and Shows No Context

## State

InProgress

## Summary

The transaction history is the only place a player can audit their points, but it is thin in three ways. Shop purchases never record which item was bought because `itemId` is silently discarded by the schema. The API accepts an unbounded `limit` and a negative `page`. The UI fetches only the first 20 rows and offers no way to see the rest, and every row shows just a type label and date with no link to the game, tournament or item behind it.

## Problem Details

**File:** `server/src/models/PointTransaction.js:35-40` and `server/src/routes/shop.js:72`

`spendPoints(user._id, item.cost, { itemId: item._id })` passes `itemId`, but `metadata` only declares `gameId`, `tournamentId`, `leagueId` and `placement`. With Mongoose strict mode the extra key is dropped, so purchase rows are stored with all-null metadata. New earning paths (`points/new-earning-paths-quizzes-and-streaks.md`) would hit the same problem for any new metadata key.

**File:** `server/src/routes/points.js:36-38`

```js
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;
```

`limit=1000000` is accepted, and `page=-5` yields a negative `skip` that Mongo rejects, surfacing as a 500.

**File:** `client/src/pages/Points.tsx:35-38` and `:101-113`

`pointsApi.getHistory` is called with no arguments (page 1, limit 20) and there is no pager, so older transactions are unreachable. Rows render only `POINT_TYPE_LABELS[tx.type]`, the amount and the date.

## Impact

- A player who buys several items cannot tell from history which purchase each row was.
- Anyone can request the entire ledger in one response; a bad `page` value returns a 500.
- Long-time players cannot see anything older than their latest 20 transactions.
- Players who suspect a missing award have no way to match a row to a game or tournament (relevant to `points/game-points-award-not-idempotent.md`).

## Suggested Fix

1. Add `itemId` (ref `ShopItem`) to the `PointTransaction.metadata` schema, and treat "new metadata keys must be declared in the schema" as a rule for the other plans that add keys (`quizId`, `reason`, etc.). Existing purchase rows cannot be recovered; consider inferring from `purchasedItems.purchasedAt` timestamps only if that is worth a one-off script.
2. Clamp `page >= 1` and `1 <= limit <= 100` in `points.js`; add tests for out-of-range values.
3. Add paging controls to `Points.tsx` (the API already returns `page` and `totalPages`).
4. Populate context in the history response (game, tournament name, ranked season, item name) and render it as a link or sub-label; show a neutral label when the referenced document was deleted.
5. Give the loading/error states of the page explicit handling (`useApi` errors are currently ignored, contrary to `.claude/rules/rules.md` "handle loading and error states").

## Related Files

- `server/src/models/PointTransaction.js`
- `server/src/routes/points.js`
- `server/src/routes/shop.js`
- `server/src/utils/pointsService.js`
- `client/src/pages/Points.tsx`
- `client/src/services/api.ts`
- `client/src/pages/__tests__/Points.test.tsx`
