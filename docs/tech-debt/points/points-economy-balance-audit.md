# Points Economy Balance Audit

## State

InProgress

## Summary

The club-points economy has three structural imbalances that create unfair progression and confusing history records. First, the game-submission bonus (+5) is as valuable as a 2nd-place finish and six times more valuable than a last-place finish, so the fastest path to flair is arbitrary (whoever taps "submit" first) rather than skill-based. Second, four `ranked_league_placement` transaction types are defined in the model and labelled in the frontend but are never awarded by any backend code — the modal shows them as "Coming soon", leaving a permanent gap between the stated economy and the real one. Third, the legacy `game_played` type sits dead in the schema and the frontend labels map, kept only to avoid breaking existing DB records but never explained or cleaned up.

## Problem Details

**File:** `server/src/utils/pointsService.js:27-38`

Game award amounts, with the submit bonus highlighted:

```js
const GAME_PLACEMENT_AMOUNTS = { 1: 8, 2: 5, 3: 3, 4: 1 };

async function awardGamePoints(game, verifierId) {
  // placement points: 8 / 5 / 3 / 1
  const playerAwards = game.players.map(({ player, rank }) =>
    awardPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardPoints(game.submittedBy, 'game_submitted', 5, { gameId });  // same as 2nd place
  await awardPoints(verifierId,       'game_verified',   2, { gameId });  // more than 4th place
}
```

A 4th-place player who submitted the game earns 1 + 5 = **6 pts**. A 4th-place player who didn't submit earns **1 pt** — a 6× gap for identical gameplay.

---

**File:** `server/src/models/PointTransaction.js:4` and `:17-20`

```js
'game_played',       // legacy — kept for existing DB records
// ...
'ranked_league_placement_1',
'ranked_league_placement_2',
'ranked_league_placement_3',
'ranked_league_placement_4',
```

`game_played` is never emitted by any current code. The four `ranked_league_placement` types are also never emitted — no function in `pointsService.js` awards them, and no route calls them.

---

**File:** `server/src/routes/rankedLeagues.js:42`

```js
await awardPoints(req.user._id, 'ranked_league_qualified', 10, { leagueId: league._id });
```

This is the only ranked-league earn trigger. Season-end placement rewards are undefined in code; the help modal at `client/src/components/PointsHelpModal.tsx:77` shows "Coming soon" with no target.

---

**Entry-flair pace variance** (cheapest item = 100 pts, `server/scripts/seedShop.js:8`):

| Player type | Pts per game | Games to 100 pts |
|---|---|---|
| Submits own games, average placement | ~9 | ~11 games (1–2 sessions) |
| Never submits, finishes 4th every game | 1 | 100 games (~10–20 sessions) |

The speed at which a player reaches their first cosmetic item is largely determined by a non-gameplay action (submitting), not skill or participation frequency.

## Impact

- Players who always submit games reach entry flair 6–10× faster than equally active players who don't — creating a perceived pay-to-win feel tied to admin behaviour.
- Four `ranked_league_placement` types in the model and `Points.tsx:21-24` labels map create a discoverability gap: if old records ever appear, the page renders them with labels that have no current earning path.
- The legacy `game_played` type adds noise to the schema enum and the frontend label map (`Points.tsx:8`) with no documentation of when/whether it will be retired.
- "Coming soon" season placements in the help modal erode trust: players who see the modal have no indication of when or how much those rewards will be, and may make spending decisions based on income they will never receive.

## Suggested Fix

1. **Rebalance submit/verify bonuses.** Reduce `game_submitted` from +5 to +2 and `game_verified` from +2 to +1. These are administrative actions and should not rival placement rewards. Alternatively, replace them with a flat "game participated" bonus (+2 to all four players, replacing placement-independent income) so progression is tied to showing up rather than who hits submit.

2. **Define or remove ranked league placement awards.** Either implement `awardRankedLeaguePoints(league)` in `pointsService.js` (called at season end) with concrete amounts, or remove the four dead types from `PointTransaction.js` and the label map in `Points.tsx`. The "Coming soon" string in `PointsHelpModal.tsx:77` should reference a concrete amount or be removed entirely.

3. **Retire the `game_played` legacy type.** Add a migration comment or a one-time script that confirms no active users have `game_played` transactions, then remove the enum value from `PointTransaction.js` and the label from `Points.tsx:8`. Until then, add a code comment at the enum entry explaining the retirement plan.

4. **Re-evaluate entry flair price** once bonus rebalancing is done. At ~5–7 pts/game post-rebalance, 100 pts ≈ 14–20 games, which is reasonable for a 2–4 session journey to first flair. If that feels too slow, lower the price rather than inflating admin bonuses.

## Related Files

- `server/src/utils/pointsService.js`
- `server/src/models/PointTransaction.js`
- `server/src/routes/games.js`
- `server/src/routes/rankedLeagues.js`
- `server/src/routes/tournaments.js`
- `server/scripts/seedShop.js`
- `client/src/pages/Points.tsx`
- `client/src/components/PointsHelpModal.tsx`
