# Game Deletion Leaves Pairing Reference Stale

## State

New

## Summary

When an admin deletes a tournament game via the games admin page, the `pairing.game` ObjectId reference in the tournament document is never cleared. The deleted game's ID persists in `rounds[].pairings[].game`. Because the game submission endpoint checks `if (pairing.game)` before allowing a new submission, the pairing becomes permanently locked: the old game is gone, but no new game can be submitted. The only recovery path is a full round reset by an admin. This is a silent data corruption issue that degrades a tournament mid-play.

## Problem Details

**File:** `client/src/pages/TournamentGamesAdmin.tsx:152`

The delete handler calls `gamesApi.deleteGame(gameId)` — which removes the `Game` document — but does not touch the tournament.

```ts
const handleDeleteGame = async (gameId: string) => {
  // ...
  await gamesApi.deleteGame(gameId);
  // pairing.game reference is never cleared
```

**File:** `server/src/routes/tournaments.js:2110`

The submission endpoint refuses to accept a game for any pairing where `pairing.game` is truthy:

```js
if (pairing.game) {
  return res.status(400).json({ ..., message: 'This pairing already has an associated game' });
}
```

After deletion the ObjectId is still present, so this guard trips on every future submission attempt for that pairing.

**File:** `server/src/routes/tournaments.js:1087`

The end-round check counts pairings without a game:
```js
const incompletePairings = round.pairings.filter(p => !p.game);
```
After populate, a deleted game resolves to null in the populated field, so the round appears incomplete and cannot be ended. But `p.game` before populate is still the stale ObjectId, blocking new submissions.

## Impact

- Any table whose submitted game is deleted becomes permanently unsubmittable without a full round reset.
- Admins must perform a round reset (which regenerates all pairings) to fix a single table, discarding correct pairings for other tables.
- The end-round button is blocked even though the logical intent was to allow re-submission.
- Failure mode is silent: the UI shows the delete succeeds, with no warning about the broken state left behind.

## Suggested Fix

1. Add a server-side route (or extend the existing game delete route) to also clear the pairing reference when the deleted game is a tournament game. The `Game` model should carry a `tournamentId` and `pairingId` (or the round/pairing can be located by scanning). On delete, look up the owning tournament and null out the matching `pairing.game` field.
2. Alternatively, expose a dedicated `DELETE /api/tournaments/:id/games/:gameId` endpoint that atomically deletes the game and clears the pairing reference in one request.
3. In the short term, add a confirmation warning in the UI when the to-be-deleted game is a tournament game, noting that the round reset may be required if the delete leaves the table in a broken state.

## Related Files

- `server/src/routes/tournaments.js`
- `server/src/routes/games.js` (game delete endpoint)
- `client/src/pages/TournamentGamesAdmin.tsx`
