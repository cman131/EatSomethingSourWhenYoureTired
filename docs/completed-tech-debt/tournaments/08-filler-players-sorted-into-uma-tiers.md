# Filler Players Pollute UMA-Sorted Tiers in TieredPoints Strategies

## State

Complete

## Summary

When a tournament's active player count is not divisible by 4, the `generateRoundPairings` function adds guest "filler" users to pad the count before passing the list to the strategy-specific generator. For `TieredPointsOnly` and `TieredPointsTop4`, those fillers are included in the UMA-sorted list used to assign players to competitive tier groups. Fillers have no game history and therefore a UMA of 0, which places them in the middle of the sorted order rather than at the bottom. This displaces real players from their correct tier, potentially seeding a strong player into a lower group or a weak player into a higher group.

## Problem Details

**File:** `server/src/utils/roundGenerationService.js:366`

Fillers are added to `activePlayerIds` in the global padding block, which runs before the strategy check:

```js
const incompletePairing = 4 - (activePlayerIds.length % 4);
if (incompletePairing !== 4) {
  for (let i = 0; i < incompletePairing; i++) {
    const fillerName = `Filler ${i + 1}`;
    // ... find or create filler user
    activePlayerIds.push(fillerUser._id.toString());
  }
}
```

**File:** `server/src/utils/roundGenerationService.js:291`

In `generateRoundPairingsTieredPointsOnly`, the full `activePlayerIds` (including fillers) is sorted by UMA:

```js
const sortedByUma = [...activePlayerIds].sort((a, b) => (umaMap.get(b) ?? 0) - (umaMap.get(a) ?? 0));
```

Fillers have no entries in `umaMap`, so they resolve to 0. In a field where scores spread from positive to negative, a 0-UMA filler is placed roughly in the middle, bumping real players up or down.

The `addFillersToPlayerList` helper used inside the tiered strategy uses offset names ("Filler 101", etc.) to avoid name collisions, but this does not address the ordering problem — it just adds more fillers with the same 0-UMA placement problem.

## Impact

- Real players in a competitive UMA tier group receive a filler opponent instead of the opponent they should face based on standing.
- The filler's score in any resulting game inflates or deflates the table's point distribution (a filler finishing last with a negative score skews the table's UMA outcomes for the other three players).
- Tier-based seeding becomes meaningless for tables that include fillers, undermining the purpose of the TieredPoints strategy.

## Suggested Fix

1. Move the filler-padding step to after the sorted grouping in `generateRoundPairingsTieredPointsOnly`: sort real players first, assign them to tiers, then pad the last (lowest) tier with fillers to reach a table-size multiple of 4.
2. In the global `generateRoundPairings`, skip the filler-padding block entirely for TieredPoints strategies — let the strategy handler own all filler logic:
   ```js
   if (strategy === 'TieredPointsOnly' || strategy === 'TieredPointsTop4') {
     // Pass only real active player IDs; strategy handles its own filler padding
     return generateRoundPairingsTieredPointsOnly(tournament, roundNumber, realActivePlayerIds, completedRounds, User);
   }
   ```
3. The strategy's `addFillersToPlayerList` should always append fillers to the last (bottom) group after sorting, never to sorted intermediate positions.

## Related Files

- `server/src/utils/roundGenerationService.js`
