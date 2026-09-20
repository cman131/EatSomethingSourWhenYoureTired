# Wheel Strategy Generates Pairings With Dropped Players

## State

Complete

## Summary

The Scramble (wheel) round generation strategy reconstructs its four rotation lists directly from the round-1 pairings stored in the database. When a player drops mid-tournament, they are marked `dropped: true` in `tournament.players` and replaced by a filler in existing open pairings. However, the `generateRoundPairings` function derives `activePlayerIds` by filtering `tournament.players` for non-dropped entries — fillers are never added to `tournament.players`. As a result, when the wheel is used to generate round 3 or later, the reconstructed lists still contain the original dropped player's ID from round 1, but that ID is absent from `activePlayerIds`. The pairing is generated from the stale list without filtering out the dropped player, meaning a dropped (or removed) player appears in a subsequent round's pairing.

## Problem Details

**File:** `server/src/utils/roundGenerationService.js:354`

Active players are derived from the tournament document:
```js
const activePlayers = tournament.players.filter(p => !p.dropped);
let activePlayerIds = activePlayers.map(p => { ... });
```

Fillers added to pad to a multiple of 4 are pushed into `activePlayerIds` but not into `tournament.players`. They will be re-derived fresh on every call.

**File:** `server/src/utils/roundGenerationService.js:408`

The wheel path:
```js
if (numActivePlayers > threshold && roundNumber > 1) {
  const firstRound = tournament.rounds.find(r => r.roundNumber === 1);
  const firstRoundPairings = firstRound ? firstRound.pairings : null;
  pairings = await generatePairingsWheel(activePlayerIds, roundNumber, firstRoundPairings);
}
```

**File:** `server/src/utils/roundGenerationService.js:136`

`reconstructWheelLists` builds the four rotation lists directly from `firstRoundPairings`:
```js
function reconstructWheelLists(firstRoundPairings) {
  const lists = [[], [], [], []];
  for (const pairing of sortedPairings) {
    for (let i = 0; i < 4; i++) {
      lists[i].push(pairing.players[i].player.toString());
    }
  }
  return lists;
}
```

There is no intersection with `activePlayerIds`. If a player from round 1 has since dropped, their ID is still placed in a list. `generatePairingsWheel` then creates pairings directly from those lists (line 204-211) without checking whether each ID is still active.

## Impact

- Dropped players can appear in generated pairings for rounds 3+ when the wheel strategy is active.
- The pre-save validator will accept these pairings (it only checks uniqueness, not active status), so invalid pairings reach the DB.
- Admin must reconcile or reset the affected round manually.
- Filler substitution via `replacePlayerInPairingsWithFiller` is intended as a post-generation fix, but it runs only on existing pairings when a player explicitly drops — it is not called when pairings are first generated.

## Suggested Fix

1. After `reconstructWheelLists` returns the four lists, filter each list to remove any ID not present in `activePlayerIds`. 
2. Handle the resulting uneven list sizes (after removals, lists may have different lengths) by padding short lists with available fillers or falling back to the optimized randomised strategy when the player count changes significantly from round 1.
3. As a simpler short-term fix, skip the wheel strategy entirely when the active player count no longer matches the original round-1 player count, and fall back to the optimized pairings generator.

## Related Files

- `server/src/utils/roundGenerationService.js`
- `server/src/routes/tournaments.js` (reconcile-active-round endpoint)
