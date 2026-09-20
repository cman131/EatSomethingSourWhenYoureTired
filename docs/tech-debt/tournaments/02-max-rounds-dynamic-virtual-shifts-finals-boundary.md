# maxRounds Virtual Shifts Finals Boundary When Players Drop

## State

New

## Summary

The `maxRounds` virtual on the Tournament schema recomputes from the current active player count every time it is accessed. If players drop during a tournament, `maxRounds` decreases, which changes when the end-round handler decides to create a finals round. A tournament that correctly played three preliminary rounds can suddenly have its boundary shift to two rounds if enough players drop, causing the system to interpret a completed preliminary round as the last round and immediately create the finals, skipping rounds the organizer intended to run. Conversely, rounds already played beyond the new boundary are silently misclassified.

## Problem Details

**File:** `server/src/models/Tournament.js:229`

```js
tournamentSchema.virtual('maxRounds').get(function() {
  return Math.ceil(((this.players.filter(p => !p.dropped).length - 4) / 12 ) + 1);
});
```

This value is recalculated on every access using the current active player count. It is used as the boundary between preliminary rounds and finals in the end-round handler.

**File:** `server/src/routes/tournaments.js:1115`

```js
const isFinalsRound = roundNumber > tournament.maxRounds;
```

And at line 1140:
```js
if (roundNumber < tournament.maxRounds) {
  // generate next round
} else if (roundNumber === tournament.maxRounds) {
  // create finals / complete tournament
} else if (roundNumber > tournament.maxRounds) {
  // a finals round just ended
}
```

If `maxRounds` was 3 when the tournament started but drops to 2 because players left, ending round 2 now takes the `=== maxRounds` branch and immediately creates finals — even if the organizer intended a third preliminary round.

## Impact

- Player drops can silently change how many preliminary rounds the tournament runs.
- Finals can be created prematurely or at the wrong round boundary.
- The rounds already played may be misclassified as finals rounds, corrupting `finalsUma` calculations that depend on `roundNumber > maxRounds`.
- Admin has no explicit control over the preliminary round count — it is implicitly tied to player count.

## Suggested Fix

1. Add a stored `preliminaryRoundCount` (or `maxPreliminaryRounds`) field to the tournament schema, set at tournament start time based on initial active player count using the same formula.
2. Replace all runtime uses of the `tournament.maxRounds` virtual in the end-round handler with this stored value.
3. Keep the virtual for display purposes (or remove it), but never use it for flow control after the tournament starts.
4. Migration: for existing in-progress tournaments, compute and store the value when the tournament is first accessed after the fix.

## Related Files

- `server/src/models/Tournament.js`
- `server/src/routes/tournaments.js`
- `server/src/utils/tournamentUma.js` (uses `tournament.maxRounds` to separate regular vs. finals UMA)
