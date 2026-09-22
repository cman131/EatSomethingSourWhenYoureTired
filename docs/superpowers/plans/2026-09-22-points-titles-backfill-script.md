# Points/Titles Backfill Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a combined npm script that backfills game points (placement/submitted/verified, reusing the existing replay path) and tournament points (participation/placement) plus the tournament champion title (both new) for events that never got them.

**Architecture:** A new `server/src/utils/tournamentPointsReplay.js` mirrors the existing `gamePointsReplay.js`: it finds `Completed` tournaments (all of them, or one by id) and replays `awardTournamentPoints` + `grantTournamentChampionTitle` for each — both already idempotent, so a full sweep is always safe. A new `server/scripts/backfillPoints.js` is the combined CLI entry point: it delegates the game half to the existing `replayGamePoints` unchanged (still gated behind `--game`/`--since`), and always runs the tournament sweep (optionally narrowed with `--tournament=<id>`). A new `backfill:points` npm script wires it up.

**Tech Stack:** Node.js/Express (CommonJS), Mongoose, Jest against a real local MongoDB.

**Spec:** `docs/superpowers/specs/2026-09-22-points-titles-backfill-script-design.md`

---

## Ground rules

- Work in the worktree `C:\Users\conor\workbench\mahjong-site\.claude\worktrees\points-titles-backfill-script` (branch `worktree-points-titles-backfill-script`). All paths below are relative to it.
- **Run server tests against a private database.** Sibling sessions share `mahjong-test` and cause flaky `E11000` failures. Every server test command below sets `MONGO_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill`.
- **Never push.** Commit locally only.
- Do not modify `awardTournamentPoints` (`server/src/utils/pointsService.js`), `grantTournamentChampionTitle` (`server/src/utils/flairGrantService.js`), `replayGamePoints`/`gamePointsReplay.js`, or the "end round" route handler (`server/src/routes/tournaments.js`). This plan only adds new call sites for the first two and reuses the third unchanged.
- Code style: 2-space indent, K&R braces, braces on every `if`, `async`/`await` only, final newline, no trailing whitespace.
- Known baseline failure, unrelated: `server/src/models/DecisionQuiz.test.js` ("should create a valid DecisionQuiz").
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## File structure

| File | Change |
|------|--------|
| `server/src/utils/tournamentPointsReplay.js` | New: `replayTournamentPoints({ tournamentId, dryRun })` |
| `server/src/utils/tournamentPointsReplay.test.js` | New: tests for the above |
| `server/scripts/backfillPoints.js` | New: combined CLI wrapping `replayGamePoints` and `replayTournamentPoints` |
| `server/package.json` | New `backfill:points` script |

---

### Task 1: `tournamentPointsReplay.js`

**Files:**
- Create: `server/src/utils/tournamentPointsReplay.js`
- Test: `server/src/utils/tournamentPointsReplay.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/tournamentPointsReplay.test.js`:

```js
const mongoose = require('mongoose');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const PointTransaction = require('../models/PointTransaction');
const ShopItem = require('../models/ShopItem');
const { replayTournamentPoints } = require('./tournamentPointsReplay');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  const staleUsers = await User.find({ displayName: /^test-treplay/ }).select('_id');
  const staleIds = staleUsers.map(u => u._id);
  await PointTransaction.deleteMany({ user: { $in: staleIds } });
  await ShopItem.deleteMany({ name: /^🏆 test-treplay/ });
  await Tournament.deleteMany({ name: /^test-treplay/ });
  await User.deleteMany({ displayName: /^test-treplay/ });
  await mongoose.connection.close();
});

let players;

beforeEach(async () => {
  // Scoped to this suite's users: Jest runs suites in parallel against the same database
  const staleUsers = await User.find({ displayName: /^test-treplay/ }).select('_id');
  const staleIds = staleUsers.map(u => u._id);
  await PointTransaction.deleteMany({ user: { $in: staleIds } });
  await ShopItem.deleteMany({ name: /^🏆 test-treplay/ });
  await Tournament.deleteMany({ name: /^test-treplay/ });
  await User.deleteMany({ displayName: /^test-treplay/ });

  players = await User.create([1, 2, 3, 4].map(n => ({
    displayName: `test-treplay-p${n}`,
    email: `treplay-p${n}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
  })));
});

function makeTournamentDoc(overrides = {}) {
  return Tournament.create({
    name: 'test-treplay Spring Open',
    date: new Date(),
    isOnline: true,
    onlineLocation: 'https://example.com/table',
    createdBy: players[0]._id,
    status: 'Completed',
    players: players.map(p => ({ player: p._id, dropped: false })),
    top4: players.map(p => p._id),
    ...overrides,
  });
}

const balanceOf = async user => (await User.findById(user._id)).pointsBalance;
const itemsFor = tournamentId => ShopItem.find({ sourceKey: `tournament:${tournamentId}` });

describe('replayTournamentPoints', () => {
  test('awards tournament points and grants the champion title for a completed tournament missing both', async () => {
    const tournament = await makeTournamentDoc();

    const summary = await replayTournamentPoints({ tournamentId: tournament._id });

    expect(summary).toEqual({ examined: 1, replayed: [tournament._id.toString()], failed: [] });
    expect(await balanceOf(players[0])).toBe(215); // 200 placement_1 + 15 participation
    expect(await balanceOf(players[3])).toBe(65); // 50 placement_4 + 15 participation
    const updatedWinner = await User.findById(players[0]._id).populate('purchasedItems.item');
    expect(updatedWinner.purchasedItems[0].item.value).toBe('🏆 test-treplay Spring Open');
  });

  test('replaying an already-awarded tournament is a no-op', async () => {
    const tournament = await makeTournamentDoc();
    await replayTournamentPoints({ tournamentId: tournament._id });

    await replayTournamentPoints({ tournamentId: tournament._id });

    expect(await balanceOf(players[0])).toBe(215);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(2); // placement_1 + participation
    expect(await itemsFor(tournament._id)).toHaveLength(1);
  });

  test('excludes a dropped top-4 player from placement points and the title', async () => {
    const tournament = await makeTournamentDoc({
      players: [
        { player: players[0]._id, dropped: true },
        ...players.slice(1).map(p => ({ player: p._id, dropped: false })),
      ],
    });

    await replayTournamentPoints({ tournamentId: tournament._id });

    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(0);
    expect((await User.findById(players[0]._id)).purchasedItems).toHaveLength(0);
  });

  test('tournamentId targets exactly one tournament regardless of other Completed tournaments', async () => {
    const target = await makeTournamentDoc();
    const other = await makeTournamentDoc({ name: 'test-treplay Other Open' });

    const summary = await replayTournamentPoints({ tournamentId: target._id });

    expect(summary.examined).toBe(1);
    expect(summary.replayed).toEqual([target._id.toString()]);
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': other._id })).toBe(0);
  });

  test('sweeps every Completed tournament when no tournamentId is given', async () => {
    const first = await makeTournamentDoc();
    const second = await makeTournamentDoc({ name: 'test-treplay Second Open' });

    const summary = await replayTournamentPoints({});

    // Asserts on this suite's own ids rather than the exact total, since the sweep queries every
    // Completed tournament in the shared test database, not just this suite's fixtures.
    expect(summary.replayed).toEqual(
      expect.arrayContaining([first._id.toString(), second._id.toString()])
    );
  });

  test('does not sweep a tournament that is not Completed', async () => {
    const inProgress = await makeTournamentDoc({ status: 'InProgress' });

    const summary = await replayTournamentPoints({});

    expect(summary.replayed).not.toContain(inProgress._id.toString());
  });

  test('dry run makes no writes but reports the tournament as examined', async () => {
    const tournament = await makeTournamentDoc();

    const summary = await replayTournamentPoints({ tournamentId: tournament._id, dryRun: true });

    expect(summary).toEqual({ examined: 1, replayed: [tournament._id.toString()], failed: [] });
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(0);
    expect(await itemsFor(tournament._id)).toHaveLength(0);
  });

  test('a failing tournament is reported and does not stop the others', async () => {
    const failing = await makeTournamentDoc();
    const passing = await makeTournamentDoc({ name: 'test-treplay Passing Open' });
    const realCreate = PointTransaction.create.bind(PointTransaction);
    const createSpy = jest.spyOn(PointTransaction, 'create').mockImplementation(async doc => {
      if (doc.metadata.tournamentId && doc.metadata.tournamentId.toString() === failing._id.toString()) {
        throw new Error('db down');
      }
      return realCreate(doc);
    });

    const summary = await replayTournamentPoints({});
    createSpy.mockRestore();

    expect(summary.replayed).toContain(passing._id.toString());
    expect(summary.replayed).not.toContain(failing._id.toString());
    expect(summary.failed).toEqual(
      expect.arrayContaining([expect.objectContaining({ tournamentId: failing._id.toString() })])
    );
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': failing._id })).toBe(0);
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': passing._id })).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill npx jest src/utils/tournamentPointsReplay.test.js
```
Expected: FAIL — `Cannot find module './tournamentPointsReplay'`.

- [ ] **Step 3: Implement**

Create `server/src/utils/tournamentPointsReplay.js`:

```js
// Re-runs tournament point awards and the champion title grant for completed tournaments whose
// awards may be incomplete (see scripts/backfillPoints.js). Replaying is safe: awardTournamentPoints
// and grantTournamentChampionTitle both skip anything already applied.

const Tournament = require('../models/Tournament');
const { awardTournamentPoints } = require('./pointsService');
const { grantTournamentChampionTitle } = require('./flairGrantService');

async function findTournamentsToReplay(tournamentId) {
  if (tournamentId) {
    return Tournament.find({ _id: tournamentId, status: 'Completed' });
  }

  return Tournament.find({ status: 'Completed' });
}

// Both halves are attempted even if the first fails, so one bad half never blocks the other.
async function replayTournament(tournament) {
  const results = await Promise.allSettled([
    awardTournamentPoints(tournament),
    grantTournamentChampionTitle(tournament),
  ]);

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, `Replay of tournament ${tournament._id} failed`);
  }
}

// Pass `tournamentId` to replay one tournament, or omit it to sweep every Completed tournament.
// Unlike gamePointsReplay.js there is no marker to filter on and no since cutoff: both award
// functions are idempotent, so a full sweep is always safe to re-run.
async function replayTournamentPoints({ tournamentId, dryRun = false } = {}) {
  const tournaments = await findTournamentsToReplay(tournamentId);
  const summary = { examined: tournaments.length, replayed: [], failed: [] };

  for (const tournament of tournaments) {
    const id = tournament._id.toString();
    if (dryRun) {
      summary.replayed.push(id);
      continue;
    }

    try {
      await replayTournament(tournament);
      summary.replayed.push(id);
    } catch (err) {
      summary.failed.push({ tournamentId: id, error: err });
    }
  }

  return summary;
}

module.exports = { replayTournamentPoints };
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill npx jest src/utils/tournamentPointsReplay.test.js
```
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/tournamentPointsReplay.js server/src/utils/tournamentPointsReplay.test.js
git commit -m "$(cat <<'EOF'
feat: add tournament points/title replay util

Mirrors gamePointsReplay.js. Sweeps every Completed tournament
unconditionally since awardTournamentPoints and
grantTournamentChampionTitle are both idempotent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `scripts/backfillPoints.js`

**Files:**
- Create: `server/scripts/backfillPoints.js`

- [ ] **Step 1: Write the script**

Create `server/scripts/backfillPoints.js`:

```js
// Replays point awards for verified games and completed tournaments whose awards may be incomplete
// (e.g. after a database error, or for events that predate this points feature), plus the tournament
// champion title. Safe to run repeatedly: anything already paid, granted, or applied is skipped.
//
//   node scripts/backfillPoints.js --game=<gameId>           replay one verified game
//   node scripts/backfillPoints.js --since=2026-09-01        replay every verified game since that
//                                                             date that has no pointsAwardedAt marker
//   node scripts/backfillPoints.js --tournament=<id>         replay one completed tournament
//   node scripts/backfillPoints.js                           replay every Completed tournament
//                                                             (games are skipped unless --game or
//                                                             --since is also passed)
//
//   add --dry-run to list what would be replayed without awarding anything
//
// --game or --since is required to replay games at all: games verified under an older points scheme
// should never be swept up by accident. Tournaments have no such requirement — awardTournamentPoints
// and grantTournamentChampionTitle are idempotent, so sweeping every Completed tournament on every
// run is always safe.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { replayGamePoints } = require('../src/utils/gamePointsReplay');
const { replayTournamentPoints } = require('../src/utils/tournamentPointsReplay');

function readOption(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function parseOptions() {
  const gameId = readOption('game');
  const sinceText = readOption('since');
  const since = sinceText ? new Date(sinceText) : undefined;
  const tournamentId = readOption('tournament');
  const dryRun = process.argv.includes('--dry-run');

  if (since && Number.isNaN(since.getTime())) {
    throw new Error(`--since is not a valid date: ${sinceText}`);
  }
  if (gameId && !mongoose.isValidObjectId(gameId)) {
    throw new Error(`--game is not a valid game id: ${gameId}`);
  }
  if (tournamentId && !mongoose.isValidObjectId(tournamentId)) {
    throw new Error(`--tournament is not a valid tournament id: ${tournamentId}`);
  }

  return { gameId, since, tournamentId, dryRun };
}

async function runGames({ gameId, since, dryRun }) {
  if (!gameId && !since) {
    console.log('Games: skipped (pass --game=<gameId> or --since=<date> to replay them)');
    return { examined: 0, replayed: [], failed: [] };
  }

  const summary = await replayGamePoints({ gameId, since, dryRun });
  for (const id of summary.replayed) {
    console.log(`Game: ${dryRun ? 'would replay' : 'replayed'} ${id}`);
  }
  for (const { gameId: failedId, error } of summary.failed) {
    console.error(`Game: FAILED ${failedId}:`, error);
  }
  console.log(
    `Games: examined ${summary.examined}, ${summary.replayed.length} ${dryRun ? 'to replay' : 'replayed'}, ${summary.failed.length} failed`
  );
  return summary;
}

async function runTournaments({ tournamentId, dryRun }) {
  const summary = await replayTournamentPoints({ tournamentId, dryRun });
  for (const id of summary.replayed) {
    console.log(`Tournament: ${dryRun ? 'would replay' : 'replayed'} ${id}`);
  }
  for (const { tournamentId: failedId, error } of summary.failed) {
    console.error(`Tournament: FAILED ${failedId}:`, error);
  }
  console.log(
    `Tournaments: examined ${summary.examined}, ${summary.replayed.length} ${dryRun ? 'to replay' : 'replayed'}, ${summary.failed.length} failed`
  );
  return summary;
}

async function run() {
  const options = parseOptions();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${options.dryRun ? 'dry run' : 'APPLY'})`);

  const gameSummary = await runGames(options);
  const tournamentSummary = await runTournaments(options);

  await mongoose.disconnect();

  if (gameSummary.failed.length > 0 || tournamentSummary.failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Manually verify against the private test database**

```bash
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node -e "
const mongoose = require('mongoose');
const Tournament = require('./src/models/Tournament');
const User = require('./src/models/User');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const [p1] = await User.create([{ displayName: 'manual-check-p1', email: 'manual-check-p1@example.com', password: 'password123', clubAffiliation: 'Charleston' }]);
  await Tournament.create({
    name: 'manual-check Open', date: new Date(), isOnline: true, onlineLocation: 'https://example.com',
    createdBy: p1._id, status: 'Completed', players: [{ player: p1._id, dropped: false }], top4: [p1._id],
  });
  await mongoose.disconnect();
})();
"
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node scripts/backfillPoints.js --dry-run
```
Expected: prints `Games: skipped (...)`, then `Tournament: would replay <id>` for the `manual-check Open` tournament, then `Tournaments: examined 1, 1 to replay, 0 failed`, then exits 0.

```bash
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node scripts/backfillPoints.js
```
Expected: `Tournament: replayed <id>`, `Tournaments: examined 1, 1 replayed, 0 failed`, exits 0.

```bash
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node -e "
const mongoose = require('mongoose');
const User = require('./src/models/User');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const u = await User.findOne({ displayName: 'manual-check-p1' });
  console.log('pointsBalance:', u.pointsBalance);
  await mongoose.disconnect();
})();
"
```
Expected: `pointsBalance: 215` (200 placement_1 + 15 participation — confirms the live write actually landed, not just the dry run).

Clean up the manual-check fixtures:
```bash
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node -e "
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Tournament = require('./src/models/Tournament');
const PointTransaction = require('./src/models/PointTransaction');
const ShopItem = require('./src/models/ShopItem');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ displayName: /^manual-check/ }).select('_id');
  const ids = users.map(u => u._id);
  await PointTransaction.deleteMany({ user: { \$in: ids } });
  await ShopItem.deleteMany({ name: /^🏆 manual-check/ });
  await Tournament.deleteMany({ name: /^manual-check/ });
  await User.deleteMany({ displayName: /^manual-check/ });
  await mongoose.disconnect();
})();
"
```
Expected: exits with no output.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/backfillPoints.js
git commit -m "$(cat <<'EOF'
feat: add combined game+tournament points/title backfill script

Reuses the existing game replay path unchanged and adds the new
tournament points/title sweep. No dedicated test file, matching the
existing replayGamePoints.js CLI wrapper convention; behavior is
covered by gamePointsReplay.test.js and tournamentPointsReplay.test.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire up the npm script

**Files:**
- Modify: `server/package.json:6-13`

- [ ] **Step 1: Add the script entry**

In `server/package.json`, in the `"scripts"` object, add a line after `"seed:guest-users": "node scripts/seedGuestPlayers.js"`:

```json
    "seed:guest-users": "node scripts/seedGuestPlayers.js",
    "backfill:points": "node scripts/backfillPoints.js"
```

(Keep the trailing comma correct — `"backfill:points"` becomes the new last entry, so it takes the line with no trailing comma.)

- [ ] **Step 2: Verify it runs via npm**

```bash
cd server && MONGODB_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill npm run backfill:points -- --dry-run
```
Expected: same output shape as running the script directly in Task 2 (`Games: skipped ...`, `Tournaments: examined 0, 0 to replay, 0 failed` — the manual-check fixture was cleaned up in Task 2, so 0 is correct here), exits 0.

- [ ] **Step 3: Commit**

```bash
git add server/package.json
git commit -m "$(cat <<'EOF'
feat: expose backfillPoints.js as npm run backfill:points

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full verification and cleanup

- [ ] **Step 1: Run the full server suite on the private database**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill npx jest 2>&1 | tail -15
```
Expected: exactly one failing suite, `src/models/DecisionQuiz.test.js` (pre-existing, unrelated). Everything else passes, including the new `tournamentPointsReplay.test.js`. If anything else fails, investigate before continuing.

- [ ] **Step 2: Check formatting of the changed files**

```bash
cd server && npx prettier --check src/utils/tournamentPointsReplay.js src/utils/tournamentPointsReplay.test.js scripts/backfillPoints.js 2>&1 || true
```
This repo has no server-side Prettier config wired into `package.json`; if the command errors with "No parser could be inferred" or similar rather than reporting style diffs, skip this step — there's nothing to reconcile against. If it does run and reports differences, run the same command with `--write`, re-run Step 1, and amend into a new commit `style: format tournament points backfill files`.

- [ ] **Step 3: Drop the private test database**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-titles-backfill node -e "const m=require('mongoose');m.connect(process.env.MONGO_URI).then(()=>m.connection.dropDatabase()).then(()=>m.disconnect())"
```
Expected: exits with no output.

- [ ] **Step 4: Confirm the branch state**

```bash
git status --short && git log --oneline main..HEAD
```
Expected: clean working tree, and commits for the spec, plan, Tasks 1–3.
