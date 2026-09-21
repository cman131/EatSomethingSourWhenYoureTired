# Game Points Awards Are Not Idempotent and Failures Are Swallowed

## State

New

## Summary

Verifying a game flips `verified` atomically, then awards points in a separate step whose errors are only logged. Because the game is already marked verified, a failed or partial award can never be retried through the normal flow, and the award helpers are not idempotent, so any manual retry would double-pay the players that had already been paid. Tournament and ranked-qualification awards were made idempotent with `awardPointsOnce`; game awards were not.

## Problem Details

**File:** `server/src/routes/games.js:295-313`

```js
const verifiedGame = await Game.findOneAndUpdate(
  { _id: game._id, verified: false },
  { $set: { verified: true, ... } },
  { new: true }
);
...
try {
  await awardGamePoints(verifiedGame, req.user._id);
} catch (err) {
  console.error('Failed to award game points:', err);
}
```

**File:** `server/src/utils/pointsService.js:50-60`

`awardGamePoints` calls plain `awardPoints` (no de-duplication) for the four placements, the submitter and the verifier. `Promise.all` over the four placements means one rejection can abort the function after some players are already paid. The submitter and verifier awards then never run.

The same fire-and-forget pattern applies to ranked points at `games.js:315-321` (`updateRankedPoints` is also not idempotent and its failure is only logged).

## Impact

- A transient DB error mid-award leaves some players paid and others not, with the game permanently `verified` and no in-app way to fix it.
- Admins cannot safely "re-run" awards for a game because that would double-pay the players that succeeded.
- The players have no visibility into missing points (the history has no per-game context; see `points/points-history-missing-context-and-paging.md`).

## Suggested Fix

1. Make each game award idempotent, keyed on `(user, type, gameId)`, using the same mechanism as `awardPointsOnce` (and the unique index proposed in `points/point-ledger-non-atomic-writes.md`).
2. Replace `Promise.all` with per-award error isolation so one failure does not stop the rest, and collect failures.
3. Add a way to re-run awards for a verified game: a script or admin-only endpoint that finds verified games missing expected transactions and replays `awardGamePoints` (safe once step 1 lands). Consider a `pointsAwardedAt` marker on `Game` to make "missing awards" cheap to query.
4. Decide whether the ranked-points update needs the same treatment; its per-game delta is not de-duplicated either. Note the known season-rollover race in `getCurrentLeague` is a separate issue.
5. Tests: replay `awardGamePoints` twice for the same game and assert balances change once; simulate a failing award and assert the retry completes the rest.

## Related Files

- `server/src/routes/games.js`
- `server/src/utils/pointsService.js`
- `server/src/utils/pointsService.test.js`
- `server/src/utils/rankedLeagueService.js`
- `server/src/models/Game.js`
- `server/src/models/PointTransaction.js`
