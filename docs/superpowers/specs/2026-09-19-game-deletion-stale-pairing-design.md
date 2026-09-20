# Game Deletion Stale Pairing Reference — Fix Design

## Status

The server-side fix already exists. This spec describes the remaining UI correction and regression test.

## Discovery

The tech-debt plan (`docs/tech-debt/tournaments/01-game-deletion-stale-pairing-reference.md`) describes a bug where deleting a tournament game leaves `pairing.game` set to the deleted ObjectId, permanently locking the pairing. Investigation revealed this is already resolved: `DELETE /api/games/:id` (`server/src/routes/games.js:597-616`) already finds all tournaments containing that game and sets `pairing.game = null` before deleting.

## Remaining Work

### 1. Fix misleading UI confirmation message

**File:** `client/src/pages/TournamentGamesAdmin.tsx:153`

**Current:**
```ts
window.confirm('Are you sure you want to delete this game? This action cannot be undone.')
```

**Problem:** "Cannot be undone" is technically accurate for the game record, but it implies the pairing is also permanently broken — which is false. Admins may be hesitant to delete a bad game submission thinking the table will be stuck.

**Fix:**
```ts
window.confirm('Delete this game? The pairing will be reset and players can resubmit a new game for this table.')
```

### 2. Regression test for pairing-clear behavior

**File:** `server/src/routes/games.test.js` (new)

The delete handler's pairing cleanup is a non-obvious invariant — a future refactor could strip it without realizing the consequence. A focused integration test pins the behavior.

**Test scenario:**
1. Create a tournament with one round, one pairing, one game linked to that pairing
2. Call `DELETE /api/games/:gameId`
3. Reload the tournament from the database
4. Assert `rounds[0].pairings[0].game === null`
5. Assert the game document no longer exists

## Architecture

No architectural changes. Both changes are isolated: one is a string replacement in the frontend, one is a new test file on the backend. The server route, Tournament model, and Game model are unchanged.

## Error Handling

No new error paths. The server route already handles the case where the game is not found in any tournament (no-op iteration).

## Testing

- Server integration test confirms the atomic delete + pairing clear
- No frontend test needed for the confirmation message change (it's a string in a native browser dialog)
