# Points/Titles Backfill Script — Design

## Problem

`awardGamePoints` (game placement/submitted/verified) already has a retroactive backfill path:
`server/src/utils/gamePointsReplay.js` + `server/scripts/replayGamePoints.js`. Both are idempotent —
`Game.pointsAwardedAt` marks completion and `recordAwardOnce` dedupes on unique `PointTransaction`
indexes — but the script isn't wired into `package.json`.

`awardTournamentPoints` (participation/placement) and `grantTournamentChampionTitle` (prestige title
for the winner), in `server/src/utils/pointsService.js` and `server/src/utils/flairGrantService.js`,
have no backfill path at all. Both are called exactly once, live, inside the "end round" route handler
(`server/src/routes/tournaments.js`) when a tournament's status flips to `Completed`. A tournament that
completed before this feature shipped, or where that handler's try/catch swallowed an error, never got
its points or title, and there's currently no way to fix that short of re-running the route handler by
hand. Both functions are already idempotent (`recordAwardOnce`'s unique `(user, type, tournamentId)`
index; `upsertEarnedTitleItem`'s unique `sourceKey`), so replaying them is always safe.

## Decisions

| Question | Decision |
|----------|----------|
| One script or two | One combined script/npm command covers games and tournaments |
| Tournament `since` cutoff | None — sweep every `status: 'Completed'` tournament unconditionally; idempotency makes repeat runs a no-op |
| Game `since`/`--game` requirement | Unchanged — still required, reusing the existing `gamePointsReplay.js` contract as-is |
| Existing game/tournament award logic | Not modified |
| New Tournament schema field (e.g. `pointsAwardedAt`) | Not added — out of scope, avoids touching the live award path |

## Design

### `server/src/utils/tournamentPointsReplay.js` (new)

Mirrors the shape of `gamePointsReplay.js`:

```js
async function replayTournamentPoints({ tournamentId, dryRun = false }) { ... }
```

- Finds tournaments: `Tournament.findById(tournamentId)` (wrapped in an array) if `tournamentId` is
  passed, else `Tournament.find({ status: 'Completed' })`.
- For each tournament, runs both halves independently via `Promise.allSettled` so one failing half
  never blocks the other — same pattern as `gamePointsReplay.js`'s `replayGame`:
  - `awardTournamentPoints(tournament)` (from `pointsService.js`, unchanged)
  - `grantTournamentChampionTitle(tournament)` (from `flairGrantService.js`, unchanged)
- `dryRun: true` lists the tournaments that would be processed without calling either function.
- Returns `{ examined, replayed: [tournamentId...], failed: [{ tournamentId, error }] }`, same shape
  as `replayGamePoints`.
- No `since` filtering, no grace period: unlike games (which use `pointsAwardedAt` as a "needs replay"
  marker requiring a grace window to avoid racing an in-flight live award), tournament awards are swept
  unconditionally and rely entirely on idempotency for safety.

### `server/scripts/backfillPoints.js` (new)

CLI entry point combining both halves:

```
node scripts/backfillPoints.js --game=<gameId>          replay one game (as today)
node scripts/backfillPoints.js --since=2026-09-01        replay verified games since that date
node scripts/backfillPoints.js --tournament=<id>         replay one tournament
                                                          (omit to sweep every Completed tournament)
add --dry-run to preview without writing anything
```

- Games: `--game`/`--since` stay required together as today (at least one must be passed) — reuses
  `replayGamePoints` from the existing `gamePointsReplay.js` unchanged.
- Tournaments: `--tournament=<id>` is optional; when omitted, every `Completed` tournament is swept.
  This half runs unconditionally (no flag required to trigger it) since there's no equivalent "must
  opt in" concern.
- `--dry-run` applies to both halves.
- Connects to Mongo once, runs both replays, prints a summary per halve (reusing the existing script's
  log format: `Replayed <id>` / `Would replay <id>` / `FAILED <id>: <error>` / totals line), exits 1 if
  either half has failures.

### `server/package.json`

Add: `"backfill:points": "node scripts/backfillPoints.js"`.

## Testing

TDD against real Mongo (private `MONGO_URI` per the project's parallel-session convention).

`tournamentPointsReplay.test.js` (mirrors `gamePointsReplay.test.js`):
- A `Completed` tournament with no existing points/title gets both `awardTournamentPoints` and
  `grantTournamentChampionTitle` called.
- Replaying an already-awarded tournament is a no-op (no duplicate `PointTransaction` rows, no
  duplicate `ShopItem`/ownership row) — exercises the existing idempotency, not reimplemented here.
- A dropped top-4 player is excluded from title/placement (existing behavior in the functions being
  replayed; test confirms the replay path doesn't bypass it).
- `tournamentId` targets exactly one tournament regardless of status filtering.
- `dryRun: true` makes no writes and still reports the tournament as examined.
- A tournament that isn't `Completed` is not swept.
- One tournament's failure doesn't stop others in the batch from being attempted.

`server/scripts/backfillPoints.js` is a thin CLI wrapper (argument parsing + console output) — no new
unit tests beyond what `gamePointsReplay.test.js` and `tournamentPointsReplay.test.js` already cover;
consistent with `replayGamePoints.js` having no dedicated test file today.

## Files

- `server/src/utils/tournamentPointsReplay.js` (new)
- `server/src/utils/tournamentPointsReplay.test.js` (new)
- `server/scripts/backfillPoints.js` (new)
- `server/package.json` (new `backfill:points` script)
