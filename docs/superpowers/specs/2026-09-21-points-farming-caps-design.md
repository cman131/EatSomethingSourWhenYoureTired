# Points Farming Caps — Design

Source plan: `docs/tech-debt/points/points-farming-caps.md`

## Problem

One verified game pays up to 26 points across its participants, and nothing limits how often a
player or a colluding pair can earn. Two accounts can submit and verify games for each other
(filling the other two seats with guests, which `createGame` allows and which never earn points),
then delete the games while keeping the points. A premium item (300 points) costs about 15 fake games.

## Decisions

| Question | Decision |
|----------|----------|
| Cap mechanism | Points per player per day, not game counts |
| Ceiling | 60 game points per player per rolling 24 hours |
| Window | Rolling 24 hours (avoids choosing a timezone; the server runs UTC) |
| Partial headroom | Truncate: pay `min(amount, 60 - earned)`; write no row when headroom is 0 |
| Tournament awards (`tournament_*`) | Exempt; always paid |
| Games played inside a tournament round | Capped like any other game |
| Repeat group | Same set of registered players: at most 6 point-earning games per rolling 7 days, then skip |
| Layers in scope | 1 (daily cap), 2 (repeat group), 3 (capped-award logging), 5 (help modal) |
| Out of scope | Layer 4 (minimum verification age), admin tooling, atomic ledger writes (owned by `points/point-ledger-non-atomic-writes`) |

## Design

### Daily cap — `server/src/utils/pointsService.js`

- `getRecentEarnings(userId, types, since)`: sums positive `PointTransaction` amounts of the given
  types since a cutoff. Uses the existing `(user, createdAt)` index. Reusable by future earning paths.
- `awardCappedPoints(...)`: used only by `awardGamePoints`. Reads the user's game-type earnings over
  the last 24 hours, pays `min(amount, GAME_DAILY_CAP - earned)`, and logs when the amount is reduced.
- Constants: `GAME_DAILY_CAP = 60`, `GAME_DAILY_WINDOW_MS`.
- Capped types: `game_placement_1..4`, `game_submitted`, `game_verified`. The retired `game_played`
  type is not counted.
- `awardTournamentPoints`, `awardRankedQualificationPoints`, `awardPoints`, `awardPointsOnce` and
  `spendPoints` are not modified.
- `awardGamePoints` keeps its current ordering (placements in parallel across players, then submit,
  then verify), so a player who is both submitter and a placed player is processed sequentially.
- Known limitation: two simultaneous verifications for the same player can overshoot the cap slightly.
  Ledger atomicity belongs to the sibling plan.

### Repeat-group limit

- Group key: sorted IDs of the non-guest players in the game, joined into a string. Applies only when
  the game has at least 2 registered players.
- `awardGamePoints` loads guest flags once (`User.find({ _id: { $in: playerIds } }).select('isGuest')`)
  and reuses them for the group key.
- Award rows carry a new optional `metadata.groupKey` (string, default null) on `PointTransaction`.
  The key lives on the ledger because a submitter can delete a game, which would erase fake games from
  any count taken from the `Game` collection.
- Before paying, count distinct `metadata.gameId` values among game-type rows with the same `groupKey`
  created in the last 7 days. If the count is 6 or more, no game points are paid for that game.
- Skipped games write no rows, so the count stays at 6 until older games age out of the window.
- Constants: `REPEAT_GROUP_MAX_GAMES = 6`, `REPEAT_GROUP_WINDOW_MS`.
- Note: the count reads ledger rows, and a game whose every award was truncated to zero by the daily
  cap also writes no rows, so it is not counted. This under-counts slightly in favor of players.

### Logging

When an award is truncated or skipped:
`console.warn('Points award capped', { userId, gameId, type, requested, granted, reason })` with
`reason` of `daily_cap` or `repeat_group`. All values are internal IDs and constants, so no log
sanitization is required. Nothing is added to the ledger.

### Help modal — `client/src/components/PointsHelpModal.tsx`

Add a "Limits" section: game points cap at 60 per rolling 24 hours; the same group of players earns
from at most 6 games per 7 days; tournament awards are not limited. The numbers are constants in the
component. The client and server have no shared config, so the duplication is deliberate and noted in
a comment pointing at the server constants.

## Testing

TDD against real Mongo, run with a private `MONGO_URI` (`mahjong-test-points-caps`) because sibling
sessions share the default test database.

`pointsService.test.js`:
- Daily cap: below, exactly at, and above the cap; truncation of a partial award; earnings older than
  24 hours do not count; a user's earnings do not affect another user.
- Tournament awards are paid in full when the player is at the game cap.
- Repeat group: guests ignored in the key; same group hits the limit on the 7th game; a different
  group is unaffected; 6-game boundary; older-than-7-days games do not count; fewer than 2 registered
  players skips the check; a skipped game writes no rows.
- A capped award produces the `Points award capped` warning with the right reason.

Client: extend the `PointsHelpModal` test if one exists, otherwise add one asserting the Limits text.

## Files

- `server/src/utils/pointsService.js`, `server/src/utils/pointsService.test.js`
- `server/src/models/PointTransaction.js` (additive `metadata.groupKey`)
- `client/src/components/PointsHelpModal.tsx`
