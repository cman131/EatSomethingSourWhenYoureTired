# Round Reset Has No Guard Against Rounds Already In Progress

## State

New

## Summary

The `PUT /api/tournaments/:id/rounds/:roundNumber/reset` endpoint clears all pairings for the specified round without checking whether the round has already been started (`startDate` is set) or whether any pairings already have associated games. An admin can accidentally wipe the pairings of a round that is actively being played, deleting player seat assignments and game links for tables that haven't submitted yet. Games already associated with pairings become orphaned (the pairing reference is gone, but the Game document remains).

## Problem Details

**File:** `server/src/routes/tournaments.js:1362`

```js
// Reset pairings - clear all pairings for this round
round.pairings = [];

await tournament.save();
```

There is no check on `round.startDate` before clearing. There is also no check for `round.pairings.some(p => p.game)` to detect in-progress games.

The round-start endpoint at line 1308 does guard against re-starting:
```js
if (round.startDate) {
  return res.status(400).json({ ..., message: 'Round has already been started' });
}
```

But no equivalent guard exists on reset.

## Impact

- Admins can accidentally clear pairings for an actively running round, disrupting players mid-game.
- Game documents linked to the cleared pairings become orphaned — no pairing points to them, and they are excluded from UMA calculations.
- Seat assignments are lost for players who have not yet submitted, and the round must be fully regenerated with a new `end-round` trigger.

## Suggested Fix

1. Before clearing pairings, check if the round has a `startDate` and return a 400 if it does (matching the guard on the start endpoint):
   ```js
   if (round.startDate) {
     return res.status(400).json({ success: false, message: 'Cannot reset a round that has already been started' });
   }
   ```
2. Optionally add a separate `force` query param or body flag that admins can pass to override this guard when they explicitly need to reset an in-progress round, logging a warning when used.
3. If the round has any pairings with associated games (`round.pairings.some(p => p.game)`), require the same override flag and warn that linked games will be orphaned.

## Related Files

- `server/src/routes/tournaments.js`
