# Club Points Earn System

## State

Complete

## Summary

The site has no mechanism to reward players for participating in club activities, which means players who submit games, verify their opponents' results, sign up for tournaments, and grind the ranked ladder get no recognition beyond a placement number. A Club Points system gives every action a currency value, creating a visible incentive loop: play → earn points → spend in the shop. Two balances are maintained per user — `totalPointsEarned` (lifetime, never decreases) for bragging rights and history, and `pointsBalance` (spendable, decreases on purchases) for the shop. Every award is recorded as a `PointTransaction` document so players can see the full history of how they earned their points.

## Problem Details

There is no existing points infrastructure. The new system requires:

**New model — `server/src/models/PointTransaction.js`**

```js
{
  user: ObjectId (ref User, required),
  type: String (enum, required),
  amount: Number (required),
  metadata: {
    gameId: ObjectId (ref Game, optional),
    tournamentId: ObjectId (ref Tournament, optional),
    leagueId: ObjectId (ref RankedLeague, optional),
    placement: Number (optional)   // 1–4 for top-4 awards
  },
  createdAt: Date (auto)
}
```

Point event types and amounts (tunable — these are starting values):

| Type | Amount | Description |
|------|--------|-------------|
| `game_played` | 5 | Player in a verified game |
| `game_submitted` | 10 | Player who submitted the game |
| `game_verified` | 5 | Player who verified the game |
| `tournament_participated` | 15 | Completed a tournament (not dropped) |
| `tournament_placement_1` | 40 | Tournament 1st place |
| `tournament_placement_2` | 30 | Tournament 2nd place |
| `tournament_placement_3` | 20 | Tournament 3rd place |
| `tournament_placement_4` | 10 | Tournament 4th place |
| `ranked_league_qualified` | 10 | Successfully joined a ranked league season |
| `ranked_league_placement_1` | 50 | Ranked league season 1st place (future) |
| `ranked_league_placement_2` | 35 | Ranked league season 2nd place (future) |
| `ranked_league_placement_3` | 25 | Ranked league season 3rd place (future) |
| `ranked_league_placement_4` | 15 | Ranked league season 4th place (future) |
| `shop_purchase` | (negative) | Points spent in the shop |

**User model changes — `server/src/models/User.js`**

Add two fields:
```js
pointsBalance: { type: Number, default: 0 },
totalPointsEarned: { type: Number, default: 0 }
```

**New service — `server/src/utils/pointsService.js`**

Expose two functions:
- `awardPoints(userId, type, amount, metadata)` — creates a `PointTransaction`, increments both `pointsBalance` and `totalPointsEarned` on the User in one atomic update
- `spendPoints(userId, amount, metadata)` — creates a negative `PointTransaction`, decrements `pointsBalance` only (validates balance ≥ amount first)

**Hook 1 — game verified: `server/src/routes/games.js:294`**

After `game.verified = true` and `game.save()` (before the ranked-points update at line 300), award points to all parties:
- All players in `game.players` → `game_played` (+5 each)
- `game.submittedBy` → `game_submitted` (+10, stacks with game_played if submitter is also a player)
- `req.user._id` (the verifier) → `game_verified` (+5)

```js
// after game.save() at line 298
try {
  await awardGamePoints(game, req.user._id);
} catch (err) {
  console.error('Failed to award game points:', err);
}
```

**Hook 2 — tournament completed: `server/src/routes/tournaments.js`**

At the four locations where `tournament.status = 'Completed'` is set (lines 1199, 1212, 1266, 1269), award points after the status is saved:
- All non-dropped participants → `tournament_participated` (+15)
- `tournament.top4[0..3]` → `tournament_placement_1` through `tournament_placement_4` (stacks with participated)

**Hook 3 — ranked league join: `server/src/routes/rankedLeagues.js:38`**

After `league.players.push(...)` and `league.save()` (only for new joins, not already-joined):
- `req.user._id` → `ranked_league_qualified` (+10)

```js
if (!alreadyJoined) {
  league.players.push({ player: req.user._id, rankedPoints: 500 });
  await league.save();
  // Award qualification points
  try {
    await pointsService.awardPoints(req.user._id, 'ranked_league_qualified', 10, { leagueId: league._id });
  } catch (err) {
    console.error('Failed to award ranked league qualification points:', err);
  }
}
```

Ranked league season-end placement awards are a stub for now — the ranked league currently has no season-end event. Wire them up when season-end logic is added.

**New route — `server/src/routes/points.js`**

```
GET /api/points/me         → { balance, totalEarned, recentTransactions }
GET /api/points/me/history → paginated PointTransaction list
```

Register in `server/src/server.js` alongside other routes.

**Frontend — points display**

- Profile page: show `pointsBalance` and `totalPointsEarned` in a new "Points" section (or alongside existing stats)
- Points history page at `/points` showing transaction log with type, amount, and date
- Add "Points" link to the Community nav dropdown in `client/src/components/Layout.tsx`

## Impact

- Players have no visible reward for submitting and verifying games, which disincentivizes the manual reporting the site depends on
- No currency means the points shop (planned companion feature) has nothing to draw from
- Without `totalPointsEarned`, there is no way to give players a lifetime participation score even after they spend

## Suggested Fix

1. Create `server/src/models/PointTransaction.js` with the schema above
2. Create `server/src/utils/pointsService.js` with `awardPoints` and `spendPoints`
3. Add `pointsBalance` and `totalPointsEarned` to `server/src/models/User.js`
4. Create a helper `awardGamePoints(game, verifierId)` inside `pointsService.js` to encapsulate the multi-player game award logic
5. Insert the game-points hook in `server/src/routes/games.js` after line 298
6. Insert the tournament-points hook in `server/src/routes/tournaments.js` at all four completion sites
7. Insert the ranked-league-join hook in `server/src/routes/rankedLeagues.js` after line 39
8. Create `server/src/routes/points.js` and register it in `server/src/server.js`
9. Add points API calls to `client/src/services/api.ts`
10. Add points display to profile and a `/points` history page

All point-awarding calls should be fire-and-forget wrapped in try/catch — a failure to award points must never block the primary operation (game save, tournament save, league join).

## Related Files

- `server/src/models/User.js`
- `server/src/models/PointTransaction.js` (new)
- `server/src/utils/pointsService.js` (new)
- `server/src/routes/games.js`
- `server/src/routes/tournaments.js`
- `server/src/routes/rankedLeagues.js`
- `server/src/routes/points.js` (new)
- `server/src/server.js`
- `client/src/services/api.ts`
- `client/src/pages/Profile.tsx`
- `client/src/components/Layout.tsx`
