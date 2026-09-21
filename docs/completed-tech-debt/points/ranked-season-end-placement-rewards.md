# Ranked Season-End Placement Rewards

## State

Complete

## Summary

Ranked league seasons roll over every 90 days but nothing happens for the players who finished at the top: the only ranked earning is a one-time +10 for reaching three games. Season-end placement rewards were once planned (the help modal used to say "Coming soon") and then dropped, leaving no long-term incentive to keep climbing the ladder. This is a design proposal for placement rewards paid once when a season ends, and it must handle the fact that the app has no scheduler and season rollover happens lazily inside a read path.

## Problem Details

**File:** `server/src/utils/rankedLeagueService.js:9-23`

```js
async function getCurrentLeague() {
  const latestLeague = await RankedLeague.findOne().sort({ startDate: -1 });
  ...
  if (daysSinceStart >= SEASON_DURATION_DAYS) {
    return await RankedLeague.create({ startDate: new Date(), players: [] });
  }
  return latestLeague;
}
```

A new season is created on the first request after 90 days, by whichever request gets there first. There is no "season ended" event, and the old league's final standings are just the last document. Concurrent first requests can also create two leagues (already a known issue tracked separately); any reward logic hung on this function must be safe under that race.

**File:** `server/src/utils/rankedLeagueService.js:35-59` and `server/src/models/RankedLeague.js:8-14`

Standings are `players[].rankedPoints` and `gamesPlayed`; players below `RANKED_GAMES_THRESHOLD` (3, line 5) are not qualified and must not receive placement rewards.

**File:** `server/src/utils/pointsService.js:104-114` and `server/src/models/PointTransaction.js:36-38`

`awardRankedQualificationPoints` shows the idempotent pattern to reuse (`awardPointsOnce` keyed by `leagueId`, and `metadata.leagueId` already exists in the schema). Placement transaction types do not exist in the enum.

## Impact

- Top ranked players get no recognition or points for a full 90-day season.
- The ladder has no payoff beyond bragging rights, weakening the reason to join it.
- Tournament winners earn 200 points while an entire ranked season champion earns nothing.

## Suggested Fix

Decisions needed first: reward amounts for top 1/2/3/(4?) (compare with `TOURNAMENT_PLACEMENT_AMOUNTS` = 200/100/70/50 at `pointsService.js:71`), whether ties matter, and whether champions also receive an earn-only cosmetic (`flair/prestige-earn-only-shop-items.md`).

1. Add `ranked_league_placement_1..N` types to the transaction enum and labels to `Points.tsx`; document them in the help modal.
2. Add `awardRankedSeasonPlacementPoints(league)` in `pointsService`, paying only qualified players ordered by `rankedPoints`, keyed by `(user, type, leagueId)` via `awardPointsOnce`.
3. Trigger it when `getCurrentLeague` detects expiry, for the league being closed. To survive a crash between creating the new league and paying, add a `rewardsAwardedAt` marker on `RankedLeague` and have `getCurrentLeague` (or a small helper it calls) also pay any earlier league whose marker is unset. Idempotent awards make repeated attempts harmless.
4. Fix or account for the duplicate-league race when choosing which league counts as "the one that ended".
5. Tests: a season with qualified and unqualified players, rollover paid exactly once, retry after simulated crash, tie handling.

## Related Files

- `server/src/utils/rankedLeagueService.js`
- `server/src/utils/rankedLeagueService.test.js`
- `server/src/models/RankedLeague.js`
- `server/src/utils/pointsService.js`
- `server/src/models/PointTransaction.js`
- `client/src/pages/Points.tsx`
- `client/src/components/PointsHelpModal.tsx`
