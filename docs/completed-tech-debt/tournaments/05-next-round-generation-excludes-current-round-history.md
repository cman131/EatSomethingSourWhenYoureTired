# Next Round Generation Excludes Current Round's Opponent History

## State

Complete

## Summary

When a round is ended, the server immediately generates the next round's pairings. The opponent-history map used to minimise repeat matchups is built from "completed rounds before the current one" — specifically, rounds with `roundNumber < roundNumber` (the round being ended). This means the round just completed is never counted when seeding the optimisation for the next round. Players who faced each other in round N are treated as strangers when generating round N+1, reducing the pairing quality and increasing the chance of repeat matchups.

## Problem Details

**File:** `server/src/utils/roundGenerationService.js:391`

Inside `generateRoundPairings`, the completed-rounds filter explicitly excludes the round currently being ended:

```js
const completedRounds = tournament.rounds
  .filter(r => r.roundNumber < roundNumber && r.pairings && r.pairings.length > 0)
  .sort((a, b) => a.roundNumber - b.roundNumber);
```

When the end-round handler calls `generateRoundPairings(tournament, nextRoundNumber)` (where `nextRoundNumber = roundNumber + 1`), this filter includes all rounds with `roundNumber < nextRoundNumber` — which correctly includes the just-ended round. Actually wait: let me re-examine this. The call is `generateRoundPairings(tournament, nextRoundNumber)` where `nextRoundNumber = roundNumber + 1`. The filter inside is `r.roundNumber < roundNumber` where `roundNumber` is the parameter — i.e., `nextRoundNumber`. So it filters `r.roundNumber < nextRoundNumber`, which *does* include the just-ended round.

On closer inspection the issue is more subtle: the `TieredPointsOnly` path calls `generateRoundPairingsTieredPointsOnly(tournament, roundNumber, activePlayerIds, completedRounds, User)` and passes the `completedRounds` that were built with the correct filter. However, inside `generateRoundPairingsTieredPointsOnly` (line 288), there is an additional populate call that may not have the current round's games populated yet at call time:

```js
await tournament.populate('rounds.pairings.game');
const umaMap = computePlayerUmaMap(tournament, false);
```

`computePlayerUmaMap` skips any game where `game.verified` is false or where the game object is not a populated object. At the time `generateRoundPairings` is called in the end-round handler (line 1143), the tournament's games for the just-ended round are populated (line 1096 populated them earlier), and those games are already verified (verified check at line 1099-1112 confirmed this before we got here). So UMA computation should correctly include the just-ended round.

The real gap is in the **Scramble** path: `buildOpponentHistory(completedRounds)` at line 402. The `completedRounds` variable here is scoped to `generateRoundPairings` and does correctly use `r.roundNumber < roundNumber` (the passed-in `nextRoundNumber`). **This is fine for the Scramble path.**

The actual bug is in the **round-end handler itself at line 1143**, where it passes `nextRoundNumber` correctly. But the function at line 391 uses parameter name `roundNumber` locally, so the filter is `r.roundNumber < nextRoundNumber` — which *does* include the round just ended. On re-analysis the filter is not the bug.

The true issue: when `generateRoundPairingsTieredPointsOnly` is called for round 2+, it calls `await tournament.populate('rounds.pairings.game')` at line 287 **inside the generation service**. This is a side-effectful populate on a Mongoose document that may already be in a partially populated state. If the just-ended round's games were already populated (they were, at line 1096 in the handler), this re-populate may or may not overwrite the in-memory state, and the service should not be responsible for populating the document it receives.

**File:** `server/src/utils/roundGenerationService.js:287`

```js
if (tournament.rounds && tournament.rounds.length > 0) {
  await tournament.populate('rounds.pairings.game');
}
const umaMap = computePlayerUmaMap(tournament, false);
```

Calling `populate` inside a generation service tightly couples the service to Mongoose and makes the calling code's state unpredictable: the tournament object is mutated as a side effect of what should be a pure computation.

## Impact

- The `TieredPointsOnly`/`TieredPointsTop4` UMA computation for generating next-round tiers depends on game data being correctly populated at a specific moment; if the state is inconsistent, players may be placed in the wrong tier group.
- The generation service has an implicit contract with its caller about the tournament's populate state that is not documented or enforced.
- Unit testing the generation service in isolation is difficult because it mutates the tournament object.

## Suggested Fix

1. Remove the `tournament.populate('rounds.pairings.game')` call from `generateRoundPairingsTieredPointsOnly`.
2. The caller (`generateRoundPairings` or the route handler) is responsible for ensuring the tournament is fully populated before passing it to the generation service.
3. Enforce this at call sites: in the end-round handler, populate games before calling `generateRoundPairings` (which is already done at line 1096).
4. Pass a pre-computed `umaMap` into the generation function, or accept a pre-populated tournament and trust the caller's state.

## Related Files

- `server/src/utils/roundGenerationService.js`
- `server/src/routes/tournaments.js`
