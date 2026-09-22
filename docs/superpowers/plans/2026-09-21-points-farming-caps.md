# Points Farming Caps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap game-earned points at 60 per player per rolling 24 hours, and stop the same group of registered players earning from more than 6 games per rolling 7 days.

**Architecture:** `awardGamePoints` in `server/src/utils/pointsService.js` gains two guards: a per-award daily cap (`awardCappedPoints`, built on a reusable `getRecentEarnings`) and a per-game repeat-group check (group key stored on ledger rows as `metadata.groupKey`). Tournament awards keep using `awardPoints`/`awardPointsOnce` and are untouched. The help modal lists the limits.

**Tech Stack:** Node.js/Express (CommonJS), Mongoose, Jest against a real local MongoDB; React 18 + TypeScript + React Testing Library on the client.

**Spec:** `docs/superpowers/specs/2026-09-21-points-farming-caps-design.md`

---

## Ground rules

- Work in the worktree `C:\Users\conor\workbench\mahjong-site\.claude\worktrees\points-farming-caps` (branch `worktree-points-farming-caps`). All paths below are relative to it.
- **Run server tests against a private database.** Sibling sessions share `mahjong-test` and cause flaky `E11000` failures. Every server test command below sets `MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps`.
- **Never push.** Commit locally only. Only the initial `InProgress` commit was pushed.
- Do not modify `awardPoints`, `awardPointsOnce`, `spendPoints`, `awardTournamentPoints` or `awardRankedQualificationPoints`. A sibling plan (`point-ledger-non-atomic-writes`) is editing this file, so keep changes additive.
- Code style: 2-space indent, K&R braces, braces on every `if`, `async`/`await` only, final newline.
- Known baseline failure, unrelated: `src/models/DecisionQuiz.test.js` ("should create a valid DecisionQuiz").
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## File structure

| File | Change |
|------|--------|
| `server/src/utils/pointsService.js` | Add constants, `getRecentEarnings`, `awardCappedPoints`, `findGameGroupKey`, `hasReachedRepeatGroupLimit`, `logCappedAward`; rewire `awardGamePoints`; export `getRecentEarnings` |
| `server/src/models/PointTransaction.js` | Add optional `metadata.groupKey` and an index on it |
| `server/src/utils/pointsService.test.js` | New tests for all of the above |
| `client/src/components/PointsHelpModal.tsx` | Add "Limits" section |
| `client/src/components/__tests__/PointsHelpModal.test.tsx` | Test for the Limits section |

---

### Task 1: `getRecentEarnings` helper

**Files:**
- Modify: `server/src/utils/pointsService.js` (add function after `awardPointsOnce`, add to exports)
- Test: `server/src/utils/pointsService.test.js` (new `describe` after `describe('spendPoints', …)`)

- [ ] **Step 1: Write the failing tests**

In `server/src/utils/pointsService.test.js`, add `getRecentEarnings` to the destructured `require('./pointsService')` list, then add this block immediately before `describe('awardGamePoints', …)`:

```js
describe('getRecentEarnings', () => {
  const HOUR = 60 * 60 * 1000;
  const seed = (type, amount, ageMs) =>
    PointTransaction.create({ user: user._id, type, amount, createdAt: new Date(Date.now() - ageMs) });
  const cutoff24h = () => new Date(Date.now() - 24 * HOUR);

  test('sums the given types since the cutoff', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('game_submitted', 2, 2 * HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1', 'game_submitted'], cutoff24h());

    expect(total).toBe(12);
  });

  test('ignores types that were not asked for', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('tournament_participated', 15, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h());

    expect(total).toBe(10);
  });

  test('ignores rows older than the cutoff', async () => {
    await seed('game_placement_1', 10, 25 * HOUR);
    await seed('game_placement_1', 4, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h());

    expect(total).toBe(4);
  });

  test('ignores negative (spend) rows', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('shop_purchase', -20, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1', 'shop_purchase'], cutoff24h());

    expect(total).toBe(10);
  });

  test('returns 0 when the user has no matching rows', async () => {
    expect(await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h())).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo worktree root):
```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest src/utils/pointsService.test.js -t "getRecentEarnings"
```
Expected: FAIL with `getRecentEarnings is not a function` (or `TypeError`).

- [ ] **Step 3: Implement**

In `server/src/utils/pointsService.js`, add immediately after `awardPointsOnce` (before `spendPoints`):

```js
// Sums a user's positive earn transactions of the given types created at or after `since`.
async function getRecentEarnings(userId, types, since) {
  const rows = await PointTransaction.find({
    user: userId,
    type: { $in: types },
    amount: { $gt: 0 },
    createdAt: { $gte: since },
  })
    .select('amount')
    .lean();

  return rows.reduce((sum, row) => sum + row.amount, 0);
}
```

Add `getRecentEarnings,` to `module.exports` (after `awardPoints,`).

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command as Step 2.
Expected: PASS, 5 tests. If the "older than the cutoff" test fails because `createdAt` was overwritten on create, stop and report it: it means Mongoose ignores a supplied `createdAt` and the seeding helper must use `PointTransaction.collection.insertOne` instead.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsService.js server/src/utils/pointsService.test.js
git commit -m "$(cat <<'EOF'
feat: add getRecentEarnings ledger helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Daily cap on game awards (with logging)

**Files:**
- Modify: `server/src/utils/pointsService.js` (constants, `logCappedAward`, `awardCappedPoints`, `awardGamePoints`)
- Test: `server/src/utils/pointsService.test.js` (new nested `describe('caps')` at the end of `describe('awardGamePoints')`)

- [ ] **Step 1: Write the failing tests**

In `server/src/utils/pointsService.test.js`, inside `describe('awardGamePoints', …)`, immediately before that block's closing `});` (the line just above `describe('awardTournamentPoints'`), add:

```js
  describe('caps', () => {
    const HOUR = 60 * 60 * 1000;

    const newGame = (users, submitter) => ({
      _id: new mongoose.Types.ObjectId(),
      players: users.map((u, i) => ({ player: u._id, rank: i + 1 })),
      submittedBy: submitter._id,
    });
    const seedEarning = (target, amount, ageMs) =>
      PointTransaction.create({
        user: target._id,
        type: 'game_placement_1',
        amount,
        createdAt: new Date(Date.now() - ageMs),
      });
    const gameRowsFor = (target, game) =>
      PointTransaction.find({ user: target._id, 'metadata.gameId': game._id });
    const balanceOf = async target => (await User.findById(target._id)).pointsBalance;

    let warnSpy;
    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    describe('daily cap', () => {
      test('pays in full when the awards land exactly on the cap', async () => {
        await seedEarning(p1, 48, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const rows = await gameRowsFor(p1, game);
        expect(rows.map(r => r.amount).sort((a, b) => a - b)).toEqual([2, 10]); // placement_1 + submitted
        expect(warnSpy).not.toHaveBeenCalled();
      });

      test('truncates an award that would exceed the cap to the remaining headroom', async () => {
        await seedEarning(p1, 55, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const placement = await PointTransaction.findOne({
          user: p1._id,
          type: 'game_placement_1',
          'metadata.gameId': game._id,
        });
        expect(placement.amount).toBe(5);
        expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_submitted' })).toBe(0);
        expect(await balanceOf(p1)).toBe(5);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({
            userId: p1._id,
            gameId: game._id,
            type: 'game_placement_1',
            requested: 10,
            granted: 5,
            reason: 'daily_cap',
          })
        );
      });

      test('pays nothing and writes no row once the cap is reached', async () => {
        await seedEarning(p1, 60, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(0);
        expect(await balanceOf(p1)).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({ userId: p1._id, granted: 0, reason: 'daily_cap' })
        );
      });

      test('does not count earnings older than 24 hours', async () => {
        await seedEarning(p1, 60, 25 * HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await balanceOf(p1)).toBe(12); // 10 placement + 2 submitted, uncapped
      });

      test("does not let one player's earnings limit another player", async () => {
        await seedEarning(p1, 60, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p3._id);

        expect(await balanceOf(p2)).toBe(7);
      });

      test('still pays tournament awards to a player who is at the game cap', async () => {
        await seedEarning(p1, 60, HOUR);
        const tournament = {
          _id: new mongoose.Types.ObjectId(),
          players: [{ player: p1._id, dropped: false }],
          top4: [p1._id],
        };

        await awardTournamentPoints(tournament);

        expect(await balanceOf(p1)).toBe(215); // 15 participation + 200 for 1st
      });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest src/utils/pointsService.test.js -t "daily cap"
```
Expected: FAIL on the truncation, cap-reached and "does not let one player…" cases (currently everything is paid uncapped). "pays in full", "older than 24 hours" and the tournament test already pass.

- [ ] **Step 3: Implement**

In `server/src/utils/pointsService.js`:

1. Immediately after `const GAME_VERIFIED_AMOUNT = 1;` add:

```js
const GAME_POINT_TYPES = [...Object.values(GAME_PLACEMENT_TYPES), 'game_submitted', 'game_verified'];
const GAME_DAILY_CAP = 60;
const GAME_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

function logCappedAward(details) {
  console.warn('Points award capped', details);
}

// Pays at most the headroom left under the daily cap; writes no row when there is none.
async function awardCappedPoints(userId, type, amount, metadata) {
  const since = new Date(Date.now() - GAME_DAILY_WINDOW_MS);
  const earned = await getRecentEarnings(userId, GAME_POINT_TYPES, since);
  const granted = Math.max(0, Math.min(amount, GAME_DAILY_CAP - earned));

  if (granted < amount) {
    logCappedAward({
      userId,
      gameId: metadata.gameId,
      type,
      requested: amount,
      granted,
      reason: 'daily_cap',
    });
  }
  if (granted === 0) {
    return;
  }

  await awardPoints(userId, type, granted, metadata);
}
```

2. Replace the body of `awardGamePoints` so it reads:

```js
async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  const playerAwards = game.players.map(({ player, rank }) =>
    awardCappedPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardCappedPoints(game.submittedBy, 'game_submitted', GAME_SUBMITTED_AMOUNT, { gameId });
  await awardCappedPoints(verifierId, 'game_verified', GAME_VERIFIED_AMOUNT, { gameId });
}
```

- [ ] **Step 4: Run the whole file to verify everything passes**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest src/utils/pointsService.test.js
```
Expected: PASS, all tests (the pre-existing `awardGamePoints` tests still pass; no user in them exceeds 12 points).

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsService.js server/src/utils/pointsService.test.js
git commit -m "$(cat <<'EOF'
feat: cap game points at 60 per player per rolling 24 hours

Tournament awards are exempt. Capped or truncated awards log a warning.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Repeat-group limit

**Files:**
- Modify: `server/src/models/PointTransaction.js` (add `metadata.groupKey` and an index)
- Modify: `server/src/utils/pointsService.js` (constants, `findGameGroupKey`, `hasReachedRepeatGroupLimit`, `awardGamePoints`)
- Test: `server/src/utils/pointsService.test.js` (new `describe('repeat group')` inside `describe('caps')`, after `describe('daily cap')`)

- [ ] **Step 1: Write the failing tests**

In `server/src/utils/pointsService.test.js`, inside `describe('caps', …)` and after the closing `});` of `describe('daily cap', …)`, add:

```js
    describe('repeat group', () => {
      const DAY = 24 * HOUR;

      // Plays a real game, then backdates its ledger rows. Uses the native driver because
      // Mongoose treats createdAt as immutable and would silently drop the update.
      const playAndAge = async (users, ageMs) => {
        const game = newGame(users, users[0]);
        await awardGamePoints(game, users[1]._id);
        await PointTransaction.collection.updateMany(
          { 'metadata.gameId': game._id },
          { $set: { createdAt: new Date(Date.now() - ageMs) } }
        );
      };
      const playAndAgeMany = async (count, users, ageMs) => {
        for (let i = 0; i < count; i += 1) {
          await playAndAge(users, ageMs);
        }
      };
      const makeUser = (name, extra = {}) =>
        User.create({
          displayName: `test-points-${name}`,
          email: `${name}@example.com`,
          password: 'password123',
          clubAffiliation: 'Charleston',
          ...extra,
        });
      const makeGuests = names =>
        User.create(names.map(name => ({ displayName: `test-points-${name}`, isGuest: true })));

      test('skips the game once the same group has 6 point-earning games in 7 days', async () => {
        await playAndAgeMany(6, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await PointTransaction.countDocuments({ 'metadata.gameId': game._id })).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({ gameId: game._id, reason: 'repeat_group' })
        );
      });

      test('still pays the 6th game for the group', async () => {
        await playAndAgeMany(5, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2); // placement_1 + submitted
      });

      test('does not count games older than 7 days', async () => {
        await playAndAgeMany(6, [p1, p2, p3, p4], 8 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2);
      });

      test('treats a different set of registered players as a separate group', async () => {
        const p5 = await makeUser('p5');
        await playAndAgeMany(6, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p5], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2);
      });

      test('ignores guests when identifying the group', async () => {
        const [g1, g2, g3, g4] = await makeGuests(['g1', 'g2', 'g3', 'g4']);
        await playAndAgeMany(6, [p1, p2, g1, g2], 2 * DAY);
        const game = newGame([p1, p2, g3, g4], p1);

        await awardGamePoints(game, p2._id);

        expect(await PointTransaction.countDocuments({ 'metadata.gameId': game._id })).toBe(0);
      });

      test('does not apply to games with fewer than 2 registered players', async () => {
        const [g1, g2, g3] = await makeGuests(['g1', 'g2', 'g3']);
        await playAndAgeMany(6, [p1, g1, g2, g3], 2 * DAY);
        const game = newGame([p1, g1, g2, g3], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2);
      });

      test('stores the same group key on every award row of a game', async () => {
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const rows = await PointTransaction.find({ 'metadata.gameId': game._id });
        expect(rows).toHaveLength(6); // 4 placements + submitted + verified
        expect(rows[0].metadata.groupKey).toBeTruthy();
        expect(new Set(rows.map(r => r.metadata.groupKey)).size).toBe(1);
      });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest src/utils/pointsService.test.js -t "repeat group"
```
Expected: FAIL on "skips the game once…", "ignores guests…" and "stores the same group key…". The other four pass because nothing blocks them yet.

- [ ] **Step 3: Add the schema field and index**

In `server/src/models/PointTransaction.js`, inside `metadata`, after the `placement` line add:

```js
    groupKey: { type: String, default: null },
```

After the existing `pointTransactionSchema.index({ user: 1, createdAt: -1 });` add:

```js
pointTransactionSchema.index({ 'metadata.groupKey': 1, createdAt: -1 });
```

- [ ] **Step 4: Implement the repeat-group check**

In `server/src/utils/pointsService.js`, immediately after the `awardCappedPoints` function (added in Task 2) add:

```js
const REPEAT_GROUP_MAX_GAMES = 6;
const REPEAT_GROUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Identifies a game's group by its registered (non-guest) players; null when fewer than 2.
async function findGameGroupKey(game) {
  const playerIds = game.players.map(({ player }) => player);
  const registered = await User.find({ _id: { $in: playerIds }, isGuest: { $ne: true } })
    .select('_id')
    .lean();

  if (registered.length < 2) {
    return null;
  }
  return registered
    .map(({ _id }) => _id.toString())
    .sort()
    .join(':');
}

// Counts games on the ledger, not the Game collection, because submitters can delete games.
async function hasReachedRepeatGroupLimit(groupKey, gameId) {
  const since = new Date(Date.now() - REPEAT_GROUP_WINDOW_MS);
  const gameIds = await PointTransaction.distinct('metadata.gameId', {
    type: { $in: GAME_POINT_TYPES },
    'metadata.groupKey': groupKey,
    createdAt: { $gte: since },
  });
  const otherGames = gameIds.filter(id => id && id.toString() !== gameId.toString());

  return otherGames.length >= REPEAT_GROUP_MAX_GAMES;
}
```

Then replace `awardGamePoints` with:

```js
async function awardGamePoints(game, verifierId) {
  const gameId = game._id;
  const groupKey = await findGameGroupKey(game);

  if (groupKey && (await hasReachedRepeatGroupLimit(groupKey, gameId))) {
    logCappedAward({ gameId, groupKey, reason: 'repeat_group' });
    return;
  }

  const metadata = { gameId, groupKey };

  const playerAwards = game.players.map(({ player, rank }) =>
    awardCappedPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], metadata)
  );
  await Promise.all(playerAwards);

  await awardCappedPoints(game.submittedBy, 'game_submitted', GAME_SUBMITTED_AMOUNT, metadata);
  await awardCappedPoints(verifierId, 'game_verified', GAME_VERIFIED_AMOUNT, metadata);
}
```

- [ ] **Step 5: Run the whole file to verify everything passes**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest src/utils/pointsService.test.js
```
Expected: PASS, all tests. The daily-cap assertions `userId: p1._id` and `gameId: game._id` still hold because `metadata.gameId` is unchanged.

- [ ] **Step 6: Commit**

```bash
git add server/src/models/PointTransaction.js server/src/utils/pointsService.js server/src/utils/pointsService.test.js
git commit -m "$(cat <<'EOF'
feat: limit game points for repeat groups to 6 games per 7 days

The group is the set of registered players in the game, tracked on the
ledger so deleting a game cannot hide it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Help modal "Limits" section

**Files:**
- Modify: `client/src/components/PointsHelpModal.tsx`
- Test: `client/src/components/__tests__/PointsHelpModal.test.tsx`

- [ ] **Step 1: Write the failing test**

In `client/src/components/__tests__/PointsHelpModal.test.tsx`, add this test after the `'Ranked League section does not show Coming soon'` test:

```tsx
  test('Limits section explains the game caps and that tournament awards are not limited', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const section = screen.getByRole('region', { name: 'Limits' });
    expect(within(section).getByText(/60 points per rolling 24 hours/i)).toBeInTheDocument();
    expect(within(section).getByText(/6 games per 7 days/i)).toBeInTheDocument();
    expect(within(section).getByText(/tournament awards are not limited/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npm install --no-audit --no-fund && npm test -- --watchAll=false --testPathPattern="PointsHelpModal"
```
Expected: FAIL on the new test with "Unable to find an accessible element with the role "region" and name "Limits"". (`npm install` is needed once because the worktree has no `client/node_modules`.)

- [ ] **Step 3: Implement**

In `client/src/components/PointsHelpModal.tsx`, after the `TOURNAMENT_ROWS` constant add:

```tsx
// Mirrors GAME_DAILY_CAP and REPEAT_GROUP_* in server/src/utils/pointsService.js — keep in sync.
const GAME_DAILY_CAP = 60;
const REPEAT_GROUP_MAX_GAMES = 6;
const REPEAT_GROUP_WINDOW_DAYS = 7;
```

Then, after the closing `</section>` of the `Ranked League` section and before the closing `</div>` of `p-6 space-y-6`, add:

```tsx
        <section aria-label="Limits">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Limits</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Game points are capped at {GAME_DAILY_CAP} points per rolling 24 hours.</li>
            <li>
              The same group of players earns points from at most {REPEAT_GROUP_MAX_GAMES} games
              per {REPEAT_GROUP_WINDOW_DAYS} days.
            </li>
            <li>Tournament awards are not limited.</li>
          </ul>
        </section>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="PointsHelpModal"
```
Expected: PASS, all modal tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PointsHelpModal.tsx client/src/components/__tests__/PointsHelpModal.test.tsx
git commit -m "$(cat <<'EOF'
feat: show game point limits in the points help modal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Full verification and cleanup

- [ ] **Step 1: Run the full server suite on the private database**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps npx jest 2>&1 | tail -15
```
Expected: exactly one failing suite, `src/models/DecisionQuiz.test.js` (pre-existing, unrelated). Everything else passes. If anything else fails, investigate before continuing.

- [ ] **Step 2: Run the full client suite and type-check**

```bash
cd client && npm test -- --watchAll=false 2>&1 | tail -15 && npx tsc --noEmit
```
Expected: all tests pass; `tsc` prints nothing.

- [ ] **Step 3: Check formatting of the changed client file**

```bash
cd client && npx prettier --check src/components/PointsHelpModal.tsx src/components/__tests__/PointsHelpModal.test.tsx
```
Expected: "All matched files use Prettier code style!". If it reports differences, run the same command with `--write`, re-run the modal test, and amend into a new commit `style: format points help modal`.

- [ ] **Step 4: Drop the private test database**

```bash
cd server && MONGO_URI=mongodb://localhost:27017/mahjong-test-points-caps node -e "const m=require('mongoose');m.connect(process.env.MONGO_URI).then(()=>m.connection.dropDatabase()).then(()=>m.disconnect())"
```
Expected: exits with no output.

- [ ] **Step 5: Confirm the branch state**

```bash
git status --short && git log --oneline main..HEAD
```
Expected: only the pre-existing `M .claude/settings.local.json` (not ours; do not stage it), and commits for the spec, plan, Tasks 1–4.
