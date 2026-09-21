# Points Economy Amounts and Award Triggers

## State

Complete

## Summary

Point awards in `server/src/utils/pointsService.js` use amounts that are too low relative to the shop (a 1st-place tournament finish pays 40 pts against mid-tier flair at 200–350), and some awards fire at the wrong moment or more than once. Ranked-league qualification is paid on *joining* the league rather than on reaching the 3-game threshold, tournament placement points are paid to players who dropped, and a tournament's points can be awarded twice. Amounts and triggers need to be corrected so the economy matches the intended design: game placement, submit and verify points all pay out when a game is verified; tournament points pay out once, when the tournament ends, to non-dropped players; and ranked qualification pays out once, when a player reaches the games threshold.

## Problem Details

**Amounts** — `server/src/utils/pointsService.js:27` and `:59`

```js
const GAME_PLACEMENT_AMOUNTS = { 1: 8, 2: 5, 3: 3, 4: 1 };
...
const amounts = [40, 30, 20, 10];   // tournament placement
```

Target: game placement 10/7/4/2; tournament placement 200/100/70/50. Participation (15, line 53), game submitted (2, line 37), game verified (1, line 38) and ranked qualified (10) are not being changed. The mid flair tier costs 200–350 (`server/scripts/seedShop.js:11-13, 21-23, 30-32, 39-41`), so 200 for 1st place buys the cheapest mid item. (Superseded 2026-09-21: the flair catalog expansion halved every shop price; mid items now cost 100–175, so a 200-point first place buys any mid item.)

**Ranked qualification paid on join, not on qualifying** — `server/src/routes/rankedLeagues.js:38-46`

```js
if (!alreadyJoined) {
  league.players.push({ player: req.user._id, rankedPoints: 500 });
  await league.save();
  await awardPoints(req.user._id, 'ranked_league_qualified', 10, { leagueId: league._id });
```

A player is only on the leaderboard once `gamesPlayed >= RANKED_GAMES_THRESHOLD` (3). That constant exists only on the client, duplicated in `client/src/pages/Home.tsx:11` and `client/src/pages/RankedLeague.tsx:11`. `gamesPlayed` is incremented server-side in `server/src/utils/rankedLeagueService.js:34`, so that is where the crossing happens. Joining should award nothing.

**Tournament placement ignores `dropped`** — `server/src/utils/pointsService.js:56-63`

Participation filters `!p.dropped` (line 52), but placement awards go to every id in `tournament.top4` with no dropped check. `top4` is built from the finals game's players (`server/src/routes/tournaments.js:1130-1144`), and players can drop while the tournament is `InProgress` (`tournaments.js:1784`, `:1924`), so a finalist who drops before the finals game is verified still gets paid.

**Tournament points can be awarded twice** — `server/src/routes/tournaments.js:1063-1082, 1277-1283`

The end-round route has no guard on `tournament.status === 'Completed'` or on the round already having been ended. Calling it again on the final round re-sets `Completed` and re-runs `awardTournamentPoints`, duplicating every participation and placement award. `awardPoints` (`pointsService.js:4-9`) has no dedupe. Game verification has the same non-atomic shape: `games.js:256` checks `game.verified` and `:295-299` sets it, so two concurrent verify requests can both pass and double-award all game points.

**Guests receive points** — `server/src/utils/pointsService.js:32-33`

`awardGamePoints` pays every entry in `game.players`, including guest users (`isGuest`, `server/src/models/User.js:86`). Guests are not real accounts and can't spend the balance.

**Duplicated amounts in the UI** — `client/src/components/PointsHelpModal.tsx:7-22, 73`

The help modal hard-codes every amount and labels ranked qualification "Qualify (join league)". These must change with the server values, and are a second copy of the same numbers.

**Already correct (no change needed):** game placement, `game_submitted` and `game_verified` are all awarded from `PUT /api/games/:id/verify` (`games.js:301-305`), and tournament awards run only when the end-round route sets status `Completed` (`tournaments.js:1277-1283`; every `Completed` assignment at `:1200, :1213, :1267, :1270` falls through to that block).

## Impact

- Points earned are too small relative to shop prices, so flair is out of reach in practice.
- Players are paid "ranked league qualified" without playing any ranked games, and the points-history label misleads.
- Dropped players collect tournament placement points, and re-ending a finished tournament inflates balances with no way to detect it.
- A concurrent double-verify can double-pay a game's points.
- Guest accounts accumulate balances that can never be spent.

## Suggested Fix

1. **Amounts.** Change `GAME_PLACEMENT_AMOUNTS` to `{1: 10, 2: 7, 3: 4, 4: 2}` and the tournament placement amounts to `[200, 100, 70, 50]`. Hoist the tournament amounts into a named constant next to the game ones. Leave the other amounts as-is.
2. **Ranked qualification.** Remove the `awardPoints` call from the join route in `rankedLeagues.js`. Export `RANKED_GAMES_THRESHOLD = 3` from `rankedLeagueService.js`. In `updateRankedPoints`, when a player's `gamesPlayed` crosses from below the threshold to at or above it, award `ranked_league_qualified` once. Dedupe on `(user, type, metadata.leagueId)` so a player is never paid twice for the same league. Expose the threshold to the client (or share the constant) and delete the two duplicates in `Home.tsx` and `RankedLeague.tsx`.
3. **Tournament dropped filter.** In `awardTournamentPoints`, resolve `dropped` for each `top4` id against `tournament.players` and skip dropped players for placement as well as participation.
4. **Idempotency.** Reject end-round on an already-`Completed` tournament and/or skip awarding when `tournament_*` transactions already exist for the tournament. Make the verify transition atomic (`findOneAndUpdate({ _id, verified: false }, ...)`) and award only if the update matched.
5. **Guests.** Skip `isGuest` users when awarding, either at the call sites or inside `awardPoints`.
6. **UI.** Update `PointsHelpModal.tsx` amounts and change the ranked label (for example, "Qualify (play 3 ranked games)").
7. **Tests.** Update `pointsService.test.js` (lines 125-128 and 191 encode the old amounts). Add cases for dropped-placement skip, double end-round idempotency, double verify, guest skip, and the ranked threshold crossing in `rankedLeagueService.test.js` (including that joining awards nothing and a 4th game does not re-award). Update `PointsHelpModal.test.tsx`.

## Related Files

- `server/src/utils/pointsService.js`
- `server/src/utils/pointsService.test.js`
- `server/src/utils/rankedLeagueService.js`
- `server/src/utils/rankedLeagueService.test.js`
- `server/src/routes/games.js`
- `server/src/routes/tournaments.js`
- `server/src/routes/rankedLeagues.js`
- `server/src/models/PointTransaction.js`
- `client/src/components/PointsHelpModal.tsx`
- `client/src/components/__tests__/PointsHelpModal.test.tsx`
- `client/src/pages/Home.tsx`
- `client/src/pages/RankedLeague.tsx`
- `client/src/pages/Points.tsx`
