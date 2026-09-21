# Deleting or Editing a Verified Game Leaves Its Points and Ranked Points in Place

## State

New

## Summary

Once a game is verified it awards club points and (if ranked) ranked-league points. The delete and admin-edit routes change or remove the game without touching either. A submitter can delete their own verified game and keep every point it earned, and an admin correcting a mis-entered score leaves the original placement points and ranked deltas untouched, so the ledger stops matching the recorded results.

## Problem Details

**File:** `server/src/routes/games.js:591-633`

Any submitter (not only admins) may delete their game, including a verified one, and the route only removes tournament pairing references before `deleteOne()`:

```js
if (game.submittedBy.toString() !== req.user._id.toString() && !req.user.isAdmin) { ... 403 }
...
await game.deleteOne();
```

No `PointTransaction` reversal, no ranked-league adjustment, and no check of `game.verified`.

**File:** `server/src/routes/games.js:488-566`

`PATCH /api/games/:id` (admin only) rewrites each player's `score` and `position`. The model recomputes `rank` on save (`server/src/models/Game.js:115-122`), but points already awarded at the old ranks (`pointsService.js:46`, `GAME_PLACEMENT_AMOUNTS`) and the ranked delta applied at verification (`rankedLeagueService.js:44-48`) are not recalculated.

## Impact

- Farming path: submit a fake game, have an accomplice verify it, delete it, keep the points. This also leaves no trace on the stats pages.
- Ranked standings can include deltas from games that no longer exist or from scores that were later corrected.
- `PointTransaction.metadata.gameId` can point at a deleted game, so history rows lose their context.
- Admins have no supported way to fix a wrong score without hand-editing the database.

## Suggested Fix

1. Decide the policy for verified games: recommended is that only admins can delete a verified game (submitters may still delete unverified ones). Confirm with the club.
2. On deleting a verified game, append reversing ledger entries for every transaction with that `gameId` (preserving the audit trail rather than deleting rows), and reverse the ranked delta and `gamesPlayed` for that game's league players. Decide what happens if a reversal pushes a balance below zero (clamp at 0, allow debt, or block the delete).
3. On an admin edit of a verified game, reverse the old awards and ranked delta, then apply the new ones from the updated ranks and scores, all keyed on `gameId` so it is replay-safe (depends on `points/game-points-award-not-idempotent.md`).
4. Ranked reversal needs to find the right league: a game verified in an earlier season must adjust that season's league document, not `getCurrentLeague()`. Store the `leagueId` (or the applied delta) on the game at verification time.
5. Qualification bonuses (`ranked_league_qualified`) should probably not be reversed automatically; call out the chosen behavior in code and tests.
6. Tests: delete and edit of a verified ranked game, a verified unranked game, and an unverified game.

## Related Files

- `server/src/routes/games.js`
- `server/src/utils/pointsService.js`
- `server/src/utils/rankedLeagueService.js`
- `server/src/models/Game.js`
- `server/src/models/PointTransaction.js`
- `server/src/models/RankedLeague.js`
- `server/src/routes/games.test.js`
