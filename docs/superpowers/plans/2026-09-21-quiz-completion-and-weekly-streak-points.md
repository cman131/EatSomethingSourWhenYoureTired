# Quiz Completion & Weekly Streak Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new point-earning paths (quiz completion, weekly attendance streak) with a shared single source of truth for award amounts, replacing the hardcoded/duplicated amounts in the help modal.

**Architecture:** Extract existing award amounts into `pointsConfig.js` and the ledger-write primitives into `pointsLedger.js` (breaking up `pointsService.js` before it grows further and avoiding a circular require between it and the new `weeklyStreakService.js`). Add `quiz_completed` and `weekly_streak_bonus` as new `PointTransaction` types, each deduplicated via a partial unique index exactly like the existing `gameId`/`tournamentId`/`leagueId` pattern. Wire the new awards into the existing quiz-response and game-verification routes, each award wrapped in its own non-blocking try/catch (matching the existing `games.js` convention). Expose amounts via a new `GET /api/points/config` endpoint consumed by a rewritten `PointsHelpModal`.

**Tech Stack:** Node/Express/Mongoose (CommonJS) on the server, React 18/TypeScript (CRA) on the client, Jest + Supertest for server tests, Jest + React Testing Library for client tests.

**Design doc:** `docs/superpowers/specs/2026-09-21-quiz-completion-and-weekly-streak-points-design.md`
**Source tech-debt plan:** `docs/tech-debt/points/new-earning-paths-quizzes-and-streaks.md`

---

## Before you start

Server tests share a MongoDB database (`mongodb://localhost:27017/mahjong-test` by default). Other worktree sessions may be running the same suites concurrently against that database. **Always set a private `MONGO_URI` for every server test command in this plan**, e.g.:

```bash
export MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points"
```

Run this once per shell before any `npx jest` command below (or prefix each command with `MONGO_URI=... `).

Client tests must override `testMatch` when running from inside a `.claude/worktrees/*` path, or CRA reports "No tests found" even though tests exist:

```bash
cd client && npm test -- --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}" --testPathPattern="<spec>"
```

---

## Task 1: Extract award amounts into `pointsConfig.js`

Pure refactor — no behavior change. This is what makes the later `GET /api/points/config` endpoint and quiz/streak amounts share one source of truth with `pointsService.js`.

**Files:**
- Create: `server/src/utils/pointsConfig.js`
- Modify: `server/src/utils/pointsService.js:77-86,124-133,166,179-185`
- Test: `server/src/utils/pointsService.test.js` (existing suite, unchanged — used as the regression check)

- [ ] **Step 1: Create `pointsConfig.js` with the current amounts plus the two new paths' amounts**

```js
// server/src/utils/pointsConfig.js
// Single source of truth for point award amounts. Both the server (pointsService.js) and the
// client (via GET /api/points/config, see routes/points.js) read from this file so the help
// modal can never drift out of sync with what actually gets paid.

const GAME_PLACEMENT_AMOUNTS = { 1: 10, 2: 7, 3: 4, 4: 2 };
const GAME_SUBMITTED_AMOUNT = 2;
const GAME_VERIFIED_AMOUNT = 1;

const TOURNAMENT_PARTICIPATION_AMOUNT = 15;
const TOURNAMENT_PLACEMENT_AMOUNTS = [200, 100, 70, 50];

const RANKED_QUALIFICATION_AMOUNT = 10;
const RANKED_PLACEMENT_AMOUNTS = [150, 100, 50];

// Quiz completion: +1 per distinct quiz, capped per calendar week since GET /generate/random
// can produce unlimited quizzes on demand.
const QUIZ_COMPLETION_AMOUNT = 1;
const QUIZ_WEEKLY_CAP_COUNT = 5;

// Weekly streak: paid once per week when a verified game, a quiz completion, and a site visit
// all land in the same week. Escalates with consecutive qualifying weeks, capped at the last value.
const WEEKLY_STREAK_AMOUNTS = [2, 3, 4, 5];

module.exports = {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
  QUIZ_COMPLETION_AMOUNT,
  QUIZ_WEEKLY_CAP_COUNT,
  WEEKLY_STREAK_AMOUNTS,
};
```

- [ ] **Step 2: Run the existing suite to confirm the current baseline passes before refactoring**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: all tests PASS (this is your regression baseline — note the pass count).

- [ ] **Step 3: Update `pointsService.js` to import amounts from `pointsConfig.js` instead of declaring them inline**

In `server/src/utils/pointsService.js`, replace these four inline declarations:

```js
const GAME_PLACEMENT_AMOUNTS = { 1: 10, 2: 7, 3: 4, 4: 2 };
const GAME_SUBMITTED_AMOUNT = 2;
const GAME_VERIFIED_AMOUNT = 1;
```
```js
const TOURNAMENT_PARTICIPATION_AMOUNT = 15;
```
```js
const TOURNAMENT_PLACEMENT_AMOUNTS = [200, 100, 70, 50];
```
```js
const RANKED_QUALIFICATION_AMOUNT = 10;
```
```js
const RANKED_PLACEMENT_AMOUNTS = [150, 100, 50];
```

with a single import at the top of the file (right after the existing `require('./rankedLeagueConstants')` line):

```js
const {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
} = require('./pointsConfig');
```

Everything else in the file (the functions that use these constants) stays exactly the same — only the declarations move.

- [ ] **Step 4: Run the suite again to confirm no regression**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: PASS, same count as Step 2.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsConfig.js server/src/utils/pointsService.js
git commit -m "refactor: extract point award amounts into pointsConfig.js"
```

---

## Task 2: `weekWindow.js` — shared week-boundary helper

New pure-function module needed by both the quiz weekly cap (Task 7) and the weekly streak evaluator (Task 6).

**Files:**
- Create: `server/src/utils/weekWindow.js`
- Test: `server/src/utils/weekWindow.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/src/utils/weekWindow.test.js
const { MS_PER_WEEK, getWeekStart, getWeekEnd } = require('./weekWindow');

describe('getWeekStart', () => {
  test('a Monday maps to itself at midnight UTC', () => {
    const monday = new Date('2026-01-05T15:30:00Z'); // a Monday
    expect(getWeekStart(monday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  test('a midweek date maps back to that week\'s Monday', () => {
    const wednesday = new Date('2026-01-07T23:59:59Z');
    expect(getWeekStart(wednesday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  test('a Sunday maps back to the Monday that started its week', () => {
    const sunday = new Date('2026-01-11T00:00:01Z');
    expect(getWeekStart(sunday).toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });
});

describe('getWeekEnd', () => {
  test('is exactly 7 days after the week start', () => {
    const weekStart = new Date('2026-01-05T00:00:00.000Z');
    expect(getWeekEnd(weekStart).toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });
});

test('MS_PER_WEEK is 7 days in milliseconds', () => {
  expect(MS_PER_WEEK).toBe(7 * 24 * 60 * 60 * 1000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/weekWindow.test.js`
Expected: FAIL with "Cannot find module './weekWindow'"

- [ ] **Step 3: Write the implementation**

```js
// server/src/utils/weekWindow.js
// Shared week-boundary math for the quiz weekly cap and the weekly streak evaluator. Weeks run
// Monday 00:00 UTC through the following Monday 00:00 UTC (exclusive), computed purely from the
// clock so there is no scheduler or stored week-rollover state to keep in sync (see
// .claude/rules/context.md: no background jobs or queues).

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = (day + 6) % 7; // Monday -> 0, Tuesday -> 1, ..., Sunday -> 6
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

function getWeekEnd(weekStart) {
  return new Date(weekStart.getTime() + MS_PER_WEEK);
}

module.exports = { MS_PER_WEEK, getWeekStart, getWeekEnd };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/weekWindow.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/weekWindow.js server/src/utils/weekWindow.test.js
git commit -m "feat: add weekWindow helper for ISO week boundaries"
```

---

## Task 3: Extract ledger primitives into `pointsLedger.js`

Pure refactor. This is what lets `weeklyStreakService.js` (Task 6) write deduplicated awards without creating a circular require with `pointsService.js` (neither file will require the other; both will require `pointsLedger.js`).

**Files:**
- Create: `server/src/utils/pointsLedger.js`
- Modify: `server/src/utils/pointsService.js:1-44`
- Test: `server/src/utils/pointsService.test.js` (existing suite, unchanged — regression check)

- [ ] **Step 1: Run the existing suite to confirm the current baseline passes before refactoring**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: PASS, same count as Task 1 Step 4.

- [ ] **Step 2: Create `pointsLedger.js` with the extracted primitives**

```js
// server/src/utils/pointsLedger.js
// Low-level ledger writes shared by pointsService.js (game/tournament/ranked/quiz awards) and
// weeklyStreakService.js (streak awards). Kept separate from pointsService.js so the latter never
// has to require weeklyStreakService.js (or vice versa) just to share this primitive.

const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

const DUPLICATE_KEY_ERROR = 11000;

async function removeLedgerRow(transaction) {
  try {
    await PointTransaction.deleteOne({ _id: transaction._id });
  } catch (cleanupError) {
    console.error(
      `Point ledger drift: transaction ${transaction._id} has no matching balance update`,
      cleanupError
    );
  }
}

// The ledger row is written first; if the balance update then fails the row is removed again,
// so an error leaves the ledger and pointsBalance in agreement.
async function recordAward({ userId, type, amount, metadata = {} }) {
  const transaction = await PointTransaction.create({ user: userId, type, amount, metadata });
  try {
    await User.updateOne(
      { _id: userId },
      { $inc: { pointsBalance: amount, totalPointsEarned: amount } }
    );
  } catch (error) {
    await removeLedgerRow(transaction);
    throw error;
  }
}

// Relies on the unique partial indexes on PointTransaction (per game / per tournament / per league /
// per quiz / per week): a duplicate-key error means this award was already made, so it is skipped.
async function recordAwardOnce(award) {
  try {
    await recordAward(award);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR) {
      throw error;
    }
  }
}

module.exports = { recordAward, recordAwardOnce };
```

- [ ] **Step 3: Update `pointsService.js` to import these instead of defining them**

Delete the following block from the top of `server/src/utils/pointsService.js` (everything from `const DUPLICATE_KEY_ERROR` through the end of `recordAwardOnce`):

```js
const DUPLICATE_KEY_ERROR = 11000;

async function removeLedgerRow(transaction) {
  try {
    await PointTransaction.deleteOne({ _id: transaction._id });
  } catch (cleanupError) {
    console.error(
      `Point ledger drift: transaction ${transaction._id} has no matching balance update`,
      cleanupError
    );
  }
}

// The ledger row is written first; if the balance update then fails the row is removed again,
// so an error leaves the ledger and pointsBalance in agreement.
async function recordAward({ userId, type, amount, metadata = {} }) {
  const transaction = await PointTransaction.create({ user: userId, type, amount, metadata });
  try {
    await User.updateOne(
      { _id: userId },
      { $inc: { pointsBalance: amount, totalPointsEarned: amount } }
    );
  } catch (error) {
    await removeLedgerRow(transaction);
    throw error;
  }
}

// Relies on the unique partial indexes on PointTransaction (per game / per tournament / per league):
// a duplicate-key error means this award was already made, so it is skipped.
async function recordAwardOnce(award) {
  try {
    await recordAward(award);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR) {
      throw error;
    }
  }
}
```

Replace it with an import, placed right after the existing `const Game = require('../models/Game');` line:

```js
const { recordAward, recordAwardOnce } = require('./pointsLedger');
```

Nothing else in the file changes — `awardAll`, `awardAllOnce`, `awardGamePoints`, etc. keep calling `recordAward`/`recordAwardOnce` exactly as before, now via the import.

- [ ] **Step 4: Run the suite again to confirm no regression**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: PASS, same count as Step 1.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsLedger.js server/src/utils/pointsService.js
git commit -m "refactor: extract ledger write primitives into pointsLedger.js"
```

---

## Task 4: `PointTransaction` model — new types, metadata fields, indexes

**Files:**
- Modify: `server/src/models/PointTransaction.js`
- Test: `server/src/models/PointTransaction.test.js` (new)

- [ ] **Step 1: Write the failing tests**

```js
// server/src/models/PointTransaction.test.js
const mongoose = require('mongoose');
const User = require('./User');
const PointTransaction = require('./PointTransaction');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
  await PointTransaction.init(); // new unique partial indexes must exist before the dedupe tests run
});

afterAll(async () => {
  await mongoose.connection.close();
});

let user;

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-pt-model/ });
  user = await User.create({
    displayName: 'test-pt-model-user',
    email: 'test-pt-model@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

afterEach(async () => {
  await PointTransaction.deleteMany({ user: user._id });
});

describe('quiz_completed transactions', () => {
  test('accepts the type with a metadata.quizId string', async () => {
    const tx = await PointTransaction.create({
      user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'abc123' },
    });
    expect(tx.metadata.quizId).toBe('abc123');
  });

  test('rejects a second transaction for the same user, type and quizId', async () => {
    await PointTransaction.create({
      user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'dup-quiz' },
    });

    await expect(
      PointTransaction.create({
        user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'dup-quiz' },
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows the same quizId for a different user', async () => {
    const other = await User.create({
      displayName: 'test-pt-model-other', email: 'test-pt-model-other@example.com',
      password: 'password123', clubAffiliation: 'Charleston',
    });

    await PointTransaction.create({ user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'shared-quiz' } });
    await expect(
      PointTransaction.create({ user: other._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'shared-quiz' } })
    ).resolves.toBeTruthy();

    await User.deleteOne({ _id: other._id });
    await PointTransaction.deleteMany({ user: other._id });
  });
});

describe('weekly_streak_bonus transactions', () => {
  const weekStart = new Date('2026-01-05T00:00:00.000Z');

  test('accepts the type with a metadata.weekStart date', async () => {
    const tx = await PointTransaction.create({
      user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart },
    });
    expect(tx.metadata.weekStart.toISOString()).toBe(weekStart.toISOString());
  });

  test('rejects a second transaction for the same user, type and weekStart', async () => {
    await PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart } });

    await expect(
      PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 3, metadata: { weekStart } })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows a different weekStart for the same user', async () => {
    const nextWeek = new Date('2026-01-12T00:00:00.000Z');
    await PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart } });

    await expect(
      PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 3, metadata: { weekStart: nextWeek } })
    ).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/models/PointTransaction.test.js`
Expected: FAIL — `quiz_completed`/`weekly_streak_bonus` are not in the `POINT_TRANSACTION_TYPES` enum, so `create` rejects with a validation error instead of succeeding.

- [ ] **Step 3: Update the model**

In `server/src/models/PointTransaction.js`, add the two new types to the enum array (after `'shop_purchase'`):

```js
const POINT_TRANSACTION_TYPES = [
  'game_played',       // retirement pending — run a one-time migration to confirm no active user holds this type before removing
  'game_placement_1',
  'game_placement_2',
  'game_placement_3',
  'game_placement_4',
  'game_submitted',
  'game_verified',
  'tournament_participated',
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
  'ranked_league_qualified',
  'ranked_league_placement_1',
  'ranked_league_placement_2',
  'ranked_league_placement_3',
  'shop_purchase',
  'quiz_completed',
  'weekly_streak_bonus',
];
```

Add the two new metadata fields (quiz ids are SHA-256 hash strings, not ObjectIds, unlike every other metadata field here):

```js
  // Mongoose strict mode silently drops undeclared keys, so any new metadata key must be declared here.
  metadata: {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem', default: null },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', default: null },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'RankedLeague', default: null },
    placement: { type: Number, default: null },
    quizId: { type: String, default: null },
    weekStart: { type: Date, default: null },
  },
```

Add the two new partial unique indexes (after the existing three, same pattern):

```js
pointTransactionSchema.index(
  { user: 1, type: 1, 'metadata.quizId': 1 },
  { unique: true, partialFilterExpression: { 'metadata.quizId': { $type: 'string' } } }
);
pointTransactionSchema.index(
  { user: 1, type: 1, 'metadata.weekStart': 1 },
  { unique: true, partialFilterExpression: { 'metadata.weekStart': { $type: 'date' } } }
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/models/PointTransaction.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full pointsService suite to confirm the enum change didn't break anything**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/models/PointTransaction.js server/src/models/PointTransaction.test.js
git commit -m "feat: add quiz_completed and weekly_streak_bonus transaction types"
```

---

## Task 5: `User.lastActiveAt` + auth middleware tracking

**Files:**
- Modify: `server/src/models/User.js:152-160`
- Modify: `server/src/middleware/auth.js`
- Test: `server/src/middleware/auth.test.js` (new)

- [ ] **Step 1: Add the field to the User model**

In `server/src/models/User.js`, right after `totalPointsEarned`:

```js
  totalPointsEarned: {
    type: Number,
    default: 0,
  },
  // Updated at most once per calendar week (see middleware/auth.js) — the "visited the site"
  // signal for the weekly streak bonus (see utils/weeklyStreakService.js).
  lastActiveAt: {
    type: Date,
    default: null,
  },
```

- [ ] **Step 2: Write the failing tests**

```js
// server/src/middleware/auth.test.js
process.env.JWT_SECRET = 'test-secret-auth-lastactive';

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const { authenticateToken, generateToken } = require('./auth');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function buildTestApp() {
  const app = express();
  app.use(authenticateToken);
  app.get('/protected', (req, res) => res.json({ success: true }));
  return app;
}

let user;

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-auth-lastactive/ });
  user = await User.create({
    displayName: 'test-auth-lastactive-user',
    email: 'test-auth-lastactive@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

describe('authenticateToken lastActiveAt tracking', () => {
  test('sets lastActiveAt on first authenticated request', async () => {
    const token = generateToken(user._id);

    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.lastActiveAt).toBeInstanceOf(Date);
  });

  test('updates lastActiveAt when the stored value is from a previous week', async () => {
    const token = generateToken(user._id);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: twoWeeksAgo } });

    await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    const updated = await User.findById(user._id);
    expect(updated.lastActiveAt.getTime()).toBeGreaterThan(twoWeeksAgo.getTime());
  });

  test('does not write to the database when lastActiveAt is already within the current week', async () => {
    const token = generateToken(user._id);
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } });
    const updateSpy = jest.spyOn(User, 'updateOne');

    await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/middleware/auth.test.js`
Expected: FAIL — `lastActiveAt` is never set today, so the first two tests fail on the `toBeInstanceOf(Date)`/`toBeGreaterThan` assertions.

- [ ] **Step 4: Update the middleware**

In `server/src/middleware/auth.js`, add the import at the top:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getWeekStart, getWeekEnd } = require('../utils/weekWindow');
```

Then, inside `authenticateToken`, replace:

```js
    // Prevent guest users from authenticating
    if (user.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'Guest users cannot access authenticated routes'
      });
    }

    req.user = user;
    next();
```

with:

```js
    // Prevent guest users from authenticating
    if (user.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'Guest users cannot access authenticated routes'
      });
    }

    // Track "visited the site" for the weekly streak bonus (utils/weeklyStreakService.js), at
    // most once per week so this doesn't add a write to every authenticated request.
    const now = new Date();
    const weekStart = getWeekStart(now);
    if (!user.lastActiveAt || user.lastActiveAt < weekStart || user.lastActiveAt >= getWeekEnd(weekStart)) {
      try {
        await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: now } });
        user.lastActiveAt = now;
      } catch (err) {
        console.error(`Failed to update lastActiveAt for user ${user._id}:`, err);
      }
    }

    req.user = user;
    next();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/middleware/auth.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/models/User.js server/src/middleware/auth.js server/src/middleware/auth.test.js
git commit -m "feat: track lastActiveAt for the weekly streak bonus"
```

---

## Task 6: `weeklyStreakService.js`

The core new logic: checks the three weekly conditions and pays the escalating bonus.

**Files:**
- Create: `server/src/utils/weeklyStreakService.js`
- Test: `server/src/utils/weeklyStreakService.test.js` (new)

- [ ] **Step 1: Write the failing tests**

```js
// server/src/utils/weeklyStreakService.test.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const PointTransaction = require('../models/PointTransaction');
const { evaluateWeeklyStreak, evaluateWeeklyStreakForPlayers } = require('./weeklyStreakService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
  await PointTransaction.init();
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Fixed Mondays (UTC) so tests never depend on the real current date.
const WEEK1 = new Date('2026-01-05T00:00:00.000Z');
const WEEK2 = new Date('2026-01-12T00:00:00.000Z');
const WEEK3 = new Date('2026-01-19T00:00:00.000Z');
const WEEK4 = new Date('2026-01-26T00:00:00.000Z');
const WEEK5 = new Date('2026-02-02T00:00:00.000Z');
const midWeek = (weekStart, hours = 12) => new Date(weekStart.getTime() + hours * 60 * 60 * 1000);

let user, p2, p3, p4;

async function makeVerifiedGame(playerIds, verifiedAt) {
  const players = playerIds.map((id, i) => ({ player: id, score: 40000 - i * 5000, position: i + 1 }));
  return Game.create({ submittedBy: playerIds[0], players, verified: true, verifiedAt, gameDate: verifiedAt });
}

async function makeQuizCompletion(userId, createdAt, quizId = new mongoose.Types.ObjectId().toString()) {
  await PointTransaction.collection.insertOne({
    user: userId, type: 'quiz_completed', amount: 1, metadata: { quizId }, createdAt, updatedAt: createdAt,
  });
}

async function setLastActiveAt(userId, date) {
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: date } });
}

async function qualifyWeek(userId, weekStart, { rest = [] } = {}) {
  await makeVerifiedGame([userId, ...rest.length ? rest : [p2._id, p3._id, p4._id]], midWeek(weekStart));
  await makeQuizCompletion(userId, midWeek(weekStart));
  await setLastActiveAt(userId, midWeek(weekStart));
}

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-streak/ });
  await Game.deleteMany({});
  await PointTransaction.deleteMany({});
  [user, p2, p3, p4] = await User.create([
    { displayName: 'test-streak-user', email: 'test-streak@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p2', email: 'test-streak-p2@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p3', email: 'test-streak-p3@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p4', email: 'test-streak-p4@example.com', password: 'password123', clubAffiliation: 'Charleston' },
  ]);
});

describe('evaluateWeeklyStreak — qualification', () => {
  test('pays nothing when none of the three conditions are met', async () => {
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays nothing when only the game condition is met', async () => {
    await makeVerifiedGame([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays nothing when only the game and quiz conditions are met (no site visit)', async () => {
    await makeVerifiedGame([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));
    await makeQuizCompletion(user._id, midWeek(WEEK1));

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays +2 for the first qualifying week when all three conditions are met', async () => {
    await qualifyWeek(user._id, WEEK1);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(2);
    expect(tx.metadata.weekStart.toISOString()).toBe(WEEK1.toISOString());
  });

  test('does not pay a guest user even when all three conditions are met', async () => {
    const guest = await User.create({ displayName: 'test-streak-guest', isGuest: true });
    await makeVerifiedGame([guest._id, p2._id, p3._id, p4._id], midWeek(WEEK1));
    await makeQuizCompletion(guest._id, midWeek(WEEK1));
    await setLastActiveAt(guest._id, midWeek(WEEK1));

    await evaluateWeeklyStreak(guest._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: guest._id, type: 'weekly_streak_bonus' })).toBe(0);
    await User.deleteOne({ _id: guest._id });
  });
});

describe('evaluateWeeklyStreak — escalation and reset', () => {
  test('escalates 2/3/4/5 across four consecutive qualifying weeks', async () => {
    const weeks = [WEEK1, WEEK2, WEEK3, WEEK4];
    const expected = [2, 3, 4, 5];

    for (let i = 0; i < weeks.length; i++) {
      await qualifyWeek(user._id, weeks[i]);
      await evaluateWeeklyStreak(user._id, midWeek(weeks[i]));
      const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': weeks[i] });
      expect(tx.amount).toBe(expected[i]);
    }
  });

  test('caps at +5 for a 5th consecutive qualifying week', async () => {
    for (const week of [WEEK1, WEEK2, WEEK3, WEEK4, WEEK5]) {
      await qualifyWeek(user._id, week);
      await evaluateWeeklyStreak(user._id, midWeek(week));
    }

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': WEEK5 });
    expect(tx.amount).toBe(5);
  });

  test('resets to +2 after a missed week', async () => {
    await qualifyWeek(user._id, WEEK1);
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));
    // WEEK2 intentionally left unqualified (missed week)
    await qualifyWeek(user._id, WEEK3);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK3));

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': WEEK3 });
    expect(tx.amount).toBe(2);
  });
});

describe('evaluateWeeklyStreak — idempotency', () => {
  test('evaluating the same week twice pays only once', async () => {
    await qualifyWeek(user._id, WEEK1);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1, 18)); // simulates the quiz-path trigger firing later the same day

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(2);
  });
});

describe('evaluateWeeklyStreakForPlayers', () => {
  test('evaluates every player and pays each independently', async () => {
    await qualifyWeek(user._id, WEEK1, { rest: [p2._id, p3._id, p4._id] });
    await makeQuizCompletion(p2._id, midWeek(WEEK1));
    await setLastActiveAt(p2._id, midWeek(WEEK1));
    // p3 and p4 only have the game condition (no quiz/visit) — should not qualify

    await evaluateWeeklyStreakForPlayers([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
    expect(await PointTransaction.countDocuments({ user: p2._id, type: 'weekly_streak_bonus' })).toBe(1);
    expect(await PointTransaction.countDocuments({ user: p3._id, type: 'weekly_streak_bonus' })).toBe(0);
    expect(await PointTransaction.countDocuments({ user: p4._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('one player failing does not stop the others, and the aggregate error lists it', async () => {
    await qualifyWeek(user._id, WEEK1);
    const findByIdSpy = jest.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === p2._id.toString()) {
        throw new Error('db down');
      }
      return User.findOne({ _id: id });
    });

    const error = await evaluateWeeklyStreakForPlayers([user._id, p2._id], midWeek(WEEK1)).catch(err => err);

    findByIdSpy.mockRestore();
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toHaveLength(1);
    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/weeklyStreakService.test.js`
Expected: FAIL with "Cannot find module './weeklyStreakService'"

- [ ] **Step 3: Write the implementation**

```js
// server/src/utils/weeklyStreakService.js
const User = require('../models/User');
const Game = require('../models/Game');
const PointTransaction = require('../models/PointTransaction');
const { recordAwardOnce } = require('./pointsLedger');
const { WEEKLY_STREAK_AMOUNTS } = require('./pointsConfig');
const { MS_PER_WEEK, getWeekStart, getWeekEnd } = require('./weekWindow');

async function hasVerifiedGameInWeek(userId, weekStart, weekEnd) {
  const game = await Game.exists({
    'players.player': userId,
    verified: true,
    verifiedAt: { $gte: weekStart, $lt: weekEnd },
  });
  return Boolean(game);
}

async function hasQuizCompletionInWeek(userId, weekStart, weekEnd) {
  const tx = await PointTransaction.exists({
    user: userId,
    type: 'quiz_completed',
    createdAt: { $gte: weekStart, $lt: weekEnd },
  });
  return Boolean(tx);
}

function wasActiveInWeek(user, weekStart, weekEnd) {
  return Boolean(user.lastActiveAt) && user.lastActiveAt >= weekStart && user.lastActiveAt < weekEnd;
}

// Walks backward week by week counting consecutive prior paid weeks, stopping once the escalation
// cap is reached (every further week pays the same capped amount) or a gap is found.
async function computeStreakLength(userId, weekStart) {
  let length = 1;
  let checkWeek = weekStart;
  while (length < WEEKLY_STREAK_AMOUNTS.length) {
    checkWeek = new Date(checkWeek.getTime() - MS_PER_WEEK);
    const priorPaid = await PointTransaction.exists({
      user: userId,
      type: 'weekly_streak_bonus',
      'metadata.weekStart': checkWeek,
    });
    if (!priorPaid) {
      break;
    }
    length += 1;
  }
  return length;
}

// Checks whether `userId` met all three weekly goals (verified game, quiz completion, site visit)
// in the week containing `referenceDate`, and pays the escalating streak bonus if so. Safe to call
// repeatedly for the same week — the unique partial index on metadata.weekStart makes the payout
// land at most once, however many times (or from however many trigger points) this runs.
async function evaluateWeeklyStreak(userId, referenceDate = new Date()) {
  const user = await User.findById(userId).select('isGuest lastActiveAt');
  if (!user || user.isGuest) {
    return;
  }

  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);

  const [hasGame, hasQuiz] = await Promise.all([
    hasVerifiedGameInWeek(userId, weekStart, weekEnd),
    hasQuizCompletionInWeek(userId, weekStart, weekEnd),
  ]);

  if (!hasGame || !hasQuiz || !wasActiveInWeek(user, weekStart, weekEnd)) {
    return;
  }

  const streakLength = await computeStreakLength(userId, weekStart);
  const amount = WEEKLY_STREAK_AMOUNTS[Math.min(streakLength, WEEKLY_STREAK_AMOUNTS.length) - 1];

  await recordAwardOnce({
    userId,
    type: 'weekly_streak_bonus',
    amount,
    metadata: { weekStart },
  });
}

// Evaluates every player from a just-verified game. One player's failure does not stop the others;
// throws an AggregateError listing every failure once all evaluations were attempted (mirrors
// pointsService.awardGamePoints' failure-isolation pattern), so the route can log it without
// blocking the response.
async function evaluateWeeklyStreakForPlayers(userIds, referenceDate = new Date()) {
  const results = await Promise.allSettled(
    userIds.map(userId => evaluateWeeklyStreak(userId, referenceDate))
  );

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to evaluate weekly streak for ${failures.length} of ${userIds.length} players`
    );
  }
}

module.exports = {
  evaluateWeeklyStreak,
  evaluateWeeklyStreakForPlayers,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/weeklyStreakService.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/weeklyStreakService.js server/src/utils/weeklyStreakService.test.js
git commit -m "feat: add weeklyStreakService with escalating streak bonus"
```

---

## Task 7: `pointsService.awardQuizCompletionPoints`

**Files:**
- Modify: `server/src/utils/pointsService.js`
- Test: `server/src/utils/pointsService.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/utils/pointsService.test.js` (add this import to the top destructure alongside the existing ones):

```js
const {
  awardPoints,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
  awardQuizCompletionPoints,
} = require('./pointsService');
```

Then add a new `describe` block at the end of the file:

```js
describe('awardQuizCompletionPoints', () => {
  test('awards 1 point with the quizId recorded', async () => {
    await awardQuizCompletionPoints(user._id, 'quiz-abc');

    const tx = await PointTransaction.findOne({ user: user._id, type: 'quiz_completed' });
    expect(tx.amount).toBe(1);
    expect(tx.metadata.quizId).toBe('quiz-abc');
    expect((await User.findById(user._id)).pointsBalance).toBe(1);
  });

  test('awards only once for the same quizId', async () => {
    await awardQuizCompletionPoints(user._id, 'quiz-abc');
    await awardQuizCompletionPoints(user._id, 'quiz-abc');

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'quiz_completed' })).toBe(1);
    expect((await User.findById(user._id)).pointsBalance).toBe(1);
  });

  test('awards again for a different quizId', async () => {
    await awardQuizCompletionPoints(user._id, 'quiz-1');
    await awardQuizCompletionPoints(user._id, 'quiz-2');

    expect((await User.findById(user._id)).pointsBalance).toBe(2);
  });

  test('does not award a guest user', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });

    await awardQuizCompletionPoints(guest._id, 'quiz-abc');

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
  });

  test('stops paying once the weekly cap of 5 is reached', async () => {
    for (let i = 1; i <= 5; i++) {
      await awardQuizCompletionPoints(user._id, `quiz-${i}`);
    }
    await awardQuizCompletionPoints(user._id, 'quiz-6');

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'quiz_completed' })).toBe(5);
    expect((await User.findById(user._id)).pointsBalance).toBe(5);
  });

  test('resets the cap the following week', async () => {
    const lastWeekTx = await PointTransaction.create([1, 2, 3, 4, 5].map(i => ({
      user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: `last-week-${i}` },
    })));
    await PointTransaction.updateMany(
      { _id: { $in: lastWeekTx.map(tx => tx._id) } },
      { $set: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
    );

    await awardQuizCompletionPoints(user._id, 'this-week-1');

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'quiz_completed', metadata: { quizId: 'this-week-1' } })).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js -t "awardQuizCompletionPoints"`
Expected: FAIL with "awardQuizCompletionPoints is not a function"

- [ ] **Step 3: Implement `awardQuizCompletionPoints` in `pointsService.js`**

Add the new config import to the existing `require('./pointsConfig')` destructure at the top of the file:

```js
const {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
  QUIZ_COMPLETION_AMOUNT,
  QUIZ_WEEKLY_CAP_COUNT,
} = require('./pointsConfig');
const { getWeekStart, getWeekEnd } = require('./weekWindow');
```

Add these two functions right before the final `module.exports`:

```js
async function hasQuizWeeklyCapRoom(userId, referenceDate = new Date()) {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);
  const earnedThisWeek = await PointTransaction.countDocuments({
    user: userId,
    type: 'quiz_completed',
    createdAt: { $gte: weekStart, $lt: weekEnd },
  });
  return earnedThisWeek < QUIZ_WEEKLY_CAP_COUNT;
}

// Awards +QUIZ_COMPLETION_AMOUNT once per (user, quizId) via the ledger's unique index, unless the
// user has already hit the weekly quiz cap. GET /generate/random (decisionQuizzes.js, discardQuizzes.js)
// can produce unlimited quizzes on demand, so the cap is what keeps this path from being farmable.
async function awardQuizCompletionPoints(userId, quizId) {
  const eligibleAwards = await excludeGuestAwards([
    { userId, type: 'quiz_completed', amount: QUIZ_COMPLETION_AMOUNT, metadata: { quizId } },
  ]);
  if (eligibleAwards.length === 0) {
    return;
  }
  if (!(await hasQuizWeeklyCapRoom(userId))) {
    return;
  }
  await recordAwardOnce(eligibleAwards[0]);
}
```

Update `module.exports` to include it:

```js
module.exports = {
  awardPoints,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
  awardQuizCompletionPoints,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/utils/pointsService.test.js`
Expected: PASS, full file (previous count + 6 new tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsService.js server/src/utils/pointsService.test.js
git commit -m "feat: award quiz completion points with a weekly cap"
```

---

## Task 8: Wire weekly-streak evaluation into game verification

**Files:**
- Modify: `server/src/routes/games.js:1-11,309-323`
- Test: `server/src/routes/games.test.js`

- [ ] **Step 1: Write the failing test**

In `server/src/routes/games.test.js`, add a mock for the new service near the existing mocks:

```js
jest.mock('../utils/weeklyStreakService', () => ({
  evaluateWeeklyStreakForPlayers: jest.fn(),
}));
```

Add the import alongside the existing ones:

```js
const { evaluateWeeklyStreakForPlayers } = require('../utils/weeklyStreakService');
```

Update the `verifiedGame` factory (inside `describe('PUT /api/games/:id/verify ...')`) to include a `players` array by default, since the new code reads it:

```js
  const verifiedGame = (overrides = {}) => ({
    _id: GAME_ID,
    verified: true,
    isRanked: false,
    players: [{ player: { toString: () => USER_ID } }],
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });
```

Add a new test at the end of the `describe('PUT /api/games/:id/verify — verification is atomic')` block:

```js
  it('evaluates the weekly streak for every player after awarding points', async () => {
    const updated = verifiedGame({
      players: [
        { player: { toString: () => 'p1' } },
        { player: { toString: () => 'p2' } },
      ],
    });
    Game.findOneAndUpdate.mockResolvedValue(updated);

    const res = await request(buildTestApp()).put(`/api/games/${GAME_ID}/verify`);

    expect(res.status).toBe(200);
    expect(evaluateWeeklyStreakForPlayers).toHaveBeenCalledWith(updated.players.map(p => p.player));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/games.test.js -t "evaluates the weekly streak"`
Expected: FAIL — `evaluateWeeklyStreakForPlayers` is never called (games.js doesn't import or call it yet).

- [ ] **Step 3: Wire it into the route**

In `server/src/routes/games.js`, add the import alongside the existing `pointsService` import:

```js
const { awardGamePoints } = require('../utils/pointsService');
const { evaluateWeeklyStreakForPlayers } = require('../utils/weeklyStreakService');
```

In the `/:id/verify` handler, add a third try/catch block right after the existing ranked-points block:

```js
    if (verifiedGame.isRanked) {
      try {
        await updateRankedPoints(verifiedGame);
      } catch (err) {
        console.error(`Failed to update ranked points for game ${verifiedGame._id}:`, err);
      }
    }

    try {
      await evaluateWeeklyStreakForPlayers(verifiedGame.players.map(p => p.player));
    } catch (err) {
      console.error(`Failed to evaluate weekly streak for game ${verifiedGame._id}:`, err);
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/games.test.js`
Expected: PASS, full file

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/games.js server/src/routes/games.test.js
git commit -m "feat: evaluate the weekly streak after a game is verified"
```

---

## Task 9: Wire quiz-completion award + streak evaluation into the quiz routes

**Files:**
- Modify: `server/src/routes/decisionQuizzes.js:1-6,373-388`
- Modify: `server/src/routes/discardQuizzes.js:1-5,391-401`
- Test: `server/src/routes/decisionQuizzes.points.test.js` (new)
- Test: `server/src/routes/discardQuizzes.points.test.js` (new)

- [ ] **Step 1: Write the failing test for the decision quiz route**

```js
// server/src/routes/decisionQuizzes.points.test.js
jest.mock('../models/DecisionQuiz');
jest.mock('../models/Tile', () => ({ find: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/pointsService', () => ({
  awardQuizCompletionPoints: jest.fn(),
}));
jest.mock('../utils/weeklyStreakService', () => ({
  evaluateWeeklyStreak: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const DecisionQuiz = require('../models/DecisionQuiz');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');

const USER_ID = '507f191e810c19729de860ea';
const QUIZ_ID = 'abc123quizid';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: { toString: () => USER_ID } };
    next();
  });
  app.use('/api/decision-quizzes', require('./decisionQuizzes'));
  return app;
}

function mockQuiz({ responses = new Map(), hand = ['M1'] } = {}) {
  return {
    id: QUIZ_ID,
    players: [{ isUser: true, hand, discard: [], melds: [] }],
    responses,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/decision-quizzes/:id/response — points side effects', () => {
  it('awards quiz completion points and evaluates the weekly streak on a first response', async () => {
    DecisionQuiz.findOne.mockResolvedValue(mockQuiz());

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
    expect(awardQuizCompletionPoints).toHaveBeenCalledWith(expect.anything(), QUIZ_ID);
    expect(evaluateWeeklyStreak).toHaveBeenCalledWith(expect.anything());
  });

  it('does not award points when the user already responded', async () => {
    const alreadyResponded = mockQuiz({
      responses: new Map([['M1', [{ toString: () => USER_ID }]]]),
    });
    DecisionQuiz.findOne.mockResolvedValue(alreadyResponded);

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(400);
    expect(awardQuizCompletionPoints).not.toHaveBeenCalled();
    expect(evaluateWeeklyStreak).not.toHaveBeenCalled();
  });

  it('still returns 200 when awarding points fails', async () => {
    DecisionQuiz.findOne.mockResolvedValue(mockQuiz());
    awardQuizCompletionPoints.mockRejectedValueOnce(new Error('db down'));

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/decisionQuizzes.points.test.js`
Expected: FAIL — `awardQuizCompletionPoints`/`evaluateWeeklyStreak` are never called (not wired up yet).

- [ ] **Step 3: Wire it into `decisionQuizzes.js`**

Add the imports at the top of the file:

```js
const express = require('express');
const DecisionQuiz = require('../models/DecisionQuiz');
const Tile = require('../models/Tile');
const { generateDecisionQuiz } = require('../utils/decisionQuizService');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');
```

In the `PUT /:id/response` handler, replace:

```js
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');
    await quiz.save();

    // Reload quiz to get fresh data
```

with:

```js
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');
    await quiz.save();

    try {
      await awardQuizCompletionPoints(userId, quizId);
    } catch (err) {
      console.error(`Failed to award quiz completion points for user ${userId}, quiz ${quizId}:`, err);
    }
    try {
      await evaluateWeeklyStreak(userId);
    } catch (err) {
      console.error(`Failed to evaluate weekly streak for user ${userId} after quiz ${quizId}:`, err);
    }

    // Reload quiz to get fresh data
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/decisionQuizzes.points.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for the discard quiz route**

```js
// server/src/routes/discardQuizzes.points.test.js
jest.mock('../models/DiscardQuiz');
jest.mock('../models/Tile', () => ({ find: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/pointsService', () => ({
  awardQuizCompletionPoints: jest.fn(),
}));
jest.mock('../utils/weeklyStreakService', () => ({
  evaluateWeeklyStreak: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const DiscardQuiz = require('../models/DiscardQuiz');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');

const USER_ID = '507f191e810c19729de860ea';
const QUIZ_ID = 'def456quizid';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: { toString: () => USER_ID } };
    next();
  });
  app.use('/api/discard-quizzes', require('./discardQuizzes'));
  return app;
}

function mockQuiz({ hand = ['M1'] } = {}) {
  return {
    id: QUIZ_ID,
    hand,
    doraIndicator: 'P1',
    seat: 'E',
    roundWind: 'E',
    responses: new Map(),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/discard-quizzes/:id/response — points side effects', () => {
  it('awards quiz completion points and evaluates the weekly streak', async () => {
    DiscardQuiz.findOne.mockResolvedValue(mockQuiz());

    const res = await request(buildTestApp())
      .put(`/api/discard-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
    expect(awardQuizCompletionPoints).toHaveBeenCalledWith(expect.anything(), QUIZ_ID);
    expect(evaluateWeeklyStreak).toHaveBeenCalledWith(expect.anything());
  });

  it('still returns 200 when evaluating the weekly streak fails', async () => {
    DiscardQuiz.findOne.mockResolvedValue(mockQuiz());
    evaluateWeeklyStreak.mockRejectedValueOnce(new Error('db down'));

    const res = await request(buildTestApp())
      .put(`/api/discard-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/discardQuizzes.points.test.js`
Expected: FAIL — not wired up yet.

- [ ] **Step 7: Wire it into `discardQuizzes.js`**

Add the imports at the top of the file:

```js
const express = require('express');
const DiscardQuiz = require('../models/DiscardQuiz');
const Tile = require('../models/Tile');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');
```

In the `PUT /:id/response` handler, replace:

```js
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');

    await quiz.save();

    // Reload quiz to get fresh data
```

with:

```js
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');

    await quiz.save();

    try {
      await awardQuizCompletionPoints(userId, quizId);
    } catch (err) {
      console.error(`Failed to award quiz completion points for user ${userId}, quiz ${quizId}:`, err);
    }
    try {
      await evaluateWeeklyStreak(userId);
    } catch (err) {
      console.error(`Failed to evaluate weekly streak for user ${userId} after quiz ${quizId}:`, err);
    }

    // Reload quiz to get fresh data
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/discardQuizzes.points.test.js`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/decisionQuizzes.js server/src/routes/decisionQuizzes.points.test.js server/src/routes/discardQuizzes.js server/src/routes/discardQuizzes.points.test.js
git commit -m "feat: award quiz completion points on quiz response"
```

---

## Task 10: `GET /api/points/config`

**Files:**
- Modify: `server/src/routes/points.js`
- Test: `server/src/routes/points.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/src/routes/points.test.js` (add a new top-level `describe`):

```js
describe('GET /api/points/config', () => {
  test('returns every award amount', async () => {
    const res = await request(app).get('/api/points/config');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      gamePlacementAmounts: { 1: 10, 2: 7, 3: 4, 4: 2 },
      gameSubmittedAmount: 2,
      gameVerifiedAmount: 1,
      tournamentParticipationAmount: 15,
      tournamentPlacementAmounts: [200, 100, 70, 50],
      rankedQualificationAmount: 10,
      rankedPlacementAmounts: [150, 100, 50],
      quizCompletionAmount: 1,
      quizWeeklyCapCount: 5,
      weeklyStreakAmounts: [2, 3, 4, 5],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/points.test.js -t "GET /api/points/config"`
Expected: FAIL with 404 (route doesn't exist yet)

- [ ] **Step 3: Add the route**

In `server/src/routes/points.js`, add the import at the top:

```js
const express = require('express');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { attachHistoryContext } = require('../utils/pointsHistoryContext');
const pointsConfig = require('../utils/pointsConfig');
```

Add the new route (after `GET /me/history`, before `module.exports`):

```js
// @route   GET /api/points/config
// @desc    Get the current award amounts, so the client never hardcodes them
// @access  Private
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        gamePlacementAmounts: pointsConfig.GAME_PLACEMENT_AMOUNTS,
        gameSubmittedAmount: pointsConfig.GAME_SUBMITTED_AMOUNT,
        gameVerifiedAmount: pointsConfig.GAME_VERIFIED_AMOUNT,
        tournamentParticipationAmount: pointsConfig.TOURNAMENT_PARTICIPATION_AMOUNT,
        tournamentPlacementAmounts: pointsConfig.TOURNAMENT_PLACEMENT_AMOUNTS,
        rankedQualificationAmount: pointsConfig.RANKED_QUALIFICATION_AMOUNT,
        rankedPlacementAmounts: pointsConfig.RANKED_PLACEMENT_AMOUNTS,
        quizCompletionAmount: pointsConfig.QUIZ_COMPLETION_AMOUNT,
        quizWeeklyCapCount: pointsConfig.QUIZ_WEEKLY_CAP_COUNT,
        weeklyStreakAmounts: pointsConfig.WEEKLY_STREAK_AMOUNTS,
      },
    });
  } catch (error) {
    console.error('Get points config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get points config' });
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest src/routes/points.test.js`
Expected: PASS, full file

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/points.js server/src/routes/points.test.js
git commit -m "feat: add GET /api/points/config endpoint"
```

---

## Task 11: Client — `pointsApi.getConfig`, rewritten `PointsHelpModal`, `Points.tsx` labels

**Files:**
- Modify: `client/src/services/api.ts` (near `pointsApi`, after line 760)
- Modify: `client/src/components/PointsHelpModal.tsx` (full rewrite)
- Modify: `client/src/components/__tests__/PointsHelpModal.test.tsx` (full rewrite)
- Modify: `client/src/pages/Points.tsx:9-27`

- [ ] **Step 1: Add the `PointsConfig` type and `getConfig` call to `api.ts`**

In `client/src/services/api.ts`, add the interface right before `export const pointsApi = {`:

```ts
export interface PointsConfig {
  gamePlacementAmounts: { 1: number; 2: number; 3: number; 4: number };
  gameSubmittedAmount: number;
  gameVerifiedAmount: number;
  tournamentParticipationAmount: number;
  tournamentPlacementAmounts: number[];
  rankedQualificationAmount: number;
  rankedPlacementAmounts: number[];
  quizCompletionAmount: number;
  quizWeeklyCapCount: number;
  weeklyStreakAmounts: number[];
}

export const pointsApi = {
  getSummary: async () => {
    return apiRequest<ApiResponse<PointsSummary>>('/points/me');
  },

  getHistory: async (page = 1, limit = 20) => {
    return apiRequest<ApiResponse<PointsHistory>>(`/points/me/history?page=${page}&limit=${limit}`);
  },

  getConfig: async () => {
    return apiRequest<ApiResponse<PointsConfig>>('/points/config');
  },
};
```

(This replaces the existing `pointsApi` object — keep `getSummary` and `getHistory` exactly as they are, just add `getConfig`.)

- [ ] **Step 2: Write the failing test for the rewritten modal**

Replace the entire contents of `client/src/components/__tests__/PointsHelpModal.test.tsx`:

```tsx
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PointsHelpModal from '../PointsHelpModal';

jest.mock('../../hooks/useApi', () => ({
  useApi: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  pointsApi: { getConfig: jest.fn() },
}));

const { useApi } = require('../../hooks/useApi');
const { pointsApi } = require('../../services/api');

const mockConfig = {
  gamePlacementAmounts: { 1: 10, 2: 7, 3: 4, 4: 2 },
  gameSubmittedAmount: 2,
  gameVerifiedAmount: 1,
  tournamentParticipationAmount: 15,
  tournamentPlacementAmounts: [200, 100, 70, 50],
  rankedQualificationAmount: 10,
  rankedPlacementAmounts: [150, 100, 50],
  quizCompletionAmount: 1,
  quizWeeklyCapCount: 5,
  weeklyStreakAmounts: [2, 3, 4, 5],
};

function mockLoaded(data: unknown = mockConfig) {
  useApi.mockReturnValue({ data: { data }, loading: false, error: null });
}

function expectRowPoints(sectionName: string, label: string, points: string) {
  const section = screen.getByRole('region', { name: sectionName });
  const row = within(section).getByText(label).closest('tr') as HTMLElement;
  expect(within(row).getByText(points)).toBeInTheDocument();
}

describe('PointsHelpModal', () => {
  test('renders the modal heading', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('shows a loading state while fetching config', () => {
    useApi.mockReturnValue({ data: null, loading: true, error: null });
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows an error state when the config fetch fails', () => {
    useApi.mockReturnValue({ data: null, loading: false, error: 'network error' });
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  test('renders all five section headings once loaded', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ranked League' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quizzes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weekly Streak' })).toBeInTheDocument();
  });

  test.each([
    ['1st place', '+10'],
    ['2nd place', '+7'],
    ['3rd place', '+4'],
    ['4th place', '+2'],
    ['Submit a game', '+2'],
    ['Verify a game', '+1'],
  ])('Games section: %s awards %s', (label, points) => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Games', label, points);
  });

  test.each([
    ['Participate', '+15'],
    ['1st place', '+200'],
    ['2nd place', '+100'],
    ['3rd place', '+70'],
    ['4th place', '+50'],
  ])('Tournaments section: %s awards %s', (label, points) => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Tournaments', label, points);
  });

  test('Ranked League section awards qualify points for reaching the leaderboard', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Ranked League', 'Qualify for the leaderboard', '+10');
  });

  test('Quizzes section shows the amount and the weekly cap', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Quizzes', 'Complete a quiz', '+1');
    expect(screen.getByText(/5 points per week/i)).toBeInTheDocument();
  });

  test('Weekly Streak section mentions the escalating amounts and the cap', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    const section = screen.getByRole('region', { name: 'Weekly Streak' });
    expect(within(section).getByText(/\+2/)).toBeInTheDocument();
    expect(within(section).getByText(/capped at \+5/i)).toBeInTheDocument();
  });

  test('calls onClose when the X button is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when the backdrop is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not call onClose when the modal content is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByText('How to Earn Points'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}" --testPathPattern="PointsHelpModal"`
Expected: FAIL — the current modal renders hardcoded rows and never calls `useApi`/`pointsApi.getConfig`, and has no Quizzes/Weekly Streak sections.

- [ ] **Step 4: Rewrite `PointsHelpModal.tsx`**

Replace the entire contents of `client/src/components/PointsHelpModal.tsx`:

```tsx
import React from 'react';
import { useApi } from '../hooks/useApi';
import { pointsApi, PointsConfig } from '../services/api';

interface Props {
  onClose: () => void;
}

function PointsTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="min-w-full text-sm">
      <tbody className="divide-y divide-gray-100">
        {rows.map(([label, pts]) => (
          <tr key={label}>
            <td className="py-2 text-gray-700">{label}</td>
            <td className="py-2 text-right font-medium text-green-600">{pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildRows(config: PointsConfig) {
  const gameRows: [string, string][] = [
    ['1st place', `+${config.gamePlacementAmounts[1]}`],
    ['2nd place', `+${config.gamePlacementAmounts[2]}`],
    ['3rd place', `+${config.gamePlacementAmounts[3]}`],
    ['4th place', `+${config.gamePlacementAmounts[4]}`],
    ['Submit a game', `+${config.gameSubmittedAmount}`],
    ['Verify a game', `+${config.gameVerifiedAmount}`],
  ];
  const tournamentRows: [string, string][] = [
    ['Participate', `+${config.tournamentParticipationAmount}`],
    ['1st place', `+${config.tournamentPlacementAmounts[0]}`],
    ['2nd place', `+${config.tournamentPlacementAmounts[1]}`],
    ['3rd place', `+${config.tournamentPlacementAmounts[2]}`],
    ['4th place', `+${config.tournamentPlacementAmounts[3]}`],
  ];
  const rankedRows: [string, string][] = [
    ['Qualify for the leaderboard', `+${config.rankedQualificationAmount}`],
    ['Finish a season 1st', `+${config.rankedPlacementAmounts[0]}`],
    ['Finish a season 2nd', `+${config.rankedPlacementAmounts[1]}`],
    ['Finish a season 3rd', `+${config.rankedPlacementAmounts[2]}`],
  ];
  const quizRows: [string, string][] = [
    ['Complete a quiz', `+${config.quizCompletionAmount}`],
  ];
  return { gameRows, tournamentRows, rankedRows, quizRows };
}

const PointsHelpModal: React.FC<Props> = ({ onClose }) => {
  const { data, loading, error } = useApi<{ data: PointsConfig }>(pointsApi.getConfig, []);
  const config = data?.data;
  const rows = config ? buildRows(config) : null;

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">How to Earn Points</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-6">
          {loading && <p className="text-sm text-gray-500">Loading point values...</p>}
          {error && <p className="text-sm text-red-600">Failed to load point values.</p>}
          {config && rows && (
            <>
              <section aria-label="Games">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Games</h3>
                <PointsTable rows={rows.gameRows} />
              </section>
              <section aria-label="Tournaments">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Tournaments</h3>
                <PointsTable rows={rows.tournamentRows} />
              </section>
              <section aria-label="Ranked League">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Ranked League</h3>
                <PointsTable rows={rows.rankedRows} />
                <p className="mt-2 text-xs text-gray-500">
                  Season placements are paid when the 90-day season ends, to qualified players only. Tied players share a placement.
                </p>
              </section>
              <section aria-label="Quizzes">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Quizzes</h3>
                <PointsTable rows={rows.quizRows} />
                <p className="mt-2 text-xs text-gray-500">
                  Capped at {config.quizWeeklyCapCount} points per week.
                </p>
              </section>
              <section aria-label="Weekly Streak">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Weekly Streak</h3>
                <p className="text-sm text-gray-700">
                  Play a verified game, complete a quiz, and visit the site in the same week to earn a bonus
                  that grows the more consecutive weeks you keep it up: +{config.weeklyStreakAmounts.join(' / +')},
                  capped at +{config.weeklyStreakAmounts[config.weeklyStreakAmounts.length - 1]}.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointsHelpModal;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}" --testPathPattern="PointsHelpModal"`
Expected: PASS (18 tests)

- [ ] **Step 6: Add labels for the two new transaction types in `Points.tsx`**

In `client/src/pages/Points.tsx`, add two entries to `POINT_TYPE_LABELS` (after `shop_purchase`):

```ts
const POINT_TYPE_LABELS: Record<string, string> = {
  game_played: 'Game Played',
  game_placement_1: 'Game 1st Place',
  game_placement_2: 'Game 2nd Place',
  game_placement_3: 'Game 3rd Place',
  game_placement_4: 'Game 4th Place',
  game_submitted: 'Game Submitted',
  game_verified: 'Game Verified',
  tournament_participated: 'Tournament Participated',
  tournament_placement_1: 'Tournament 1st Place',
  tournament_placement_2: 'Tournament 2nd Place',
  tournament_placement_3: 'Tournament 3rd Place',
  tournament_placement_4: 'Tournament 4th Place',
  ranked_league_qualified: 'Ranked League Qualified',
  ranked_league_placement_1: 'Ranked Season 1st Place',
  ranked_league_placement_2: 'Ranked Season 2nd Place',
  ranked_league_placement_3: 'Ranked Season 3rd Place',
  shop_purchase: 'Shop Purchase',
  quiz_completed: 'Quiz Completed',
  weekly_streak_bonus: 'Weekly Streak Bonus',
};
```

- [ ] **Step 7: Run the full client suite to confirm nothing else broke**

Run: `cd client && npm test -- --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}"`
Expected: PASS (same 18 suites as the Task 0 baseline, no new failures — `Points.test.tsx` and `PointsHelpModal.test.tsx` both green)

- [ ] **Step 8: Commit**

```bash
git add client/src/services/api.ts client/src/components/PointsHelpModal.tsx client/src/components/__tests__/PointsHelpModal.test.tsx client/src/pages/Points.tsx
git commit -m "feat: generate the points help modal from GET /api/points/config"
```

---

## Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full server suite**

Run: `cd server && MONGO_URI="mongodb://localhost:27017/mahjong-test-quiz-streak-points" npx jest`
Expected: PASS. (`DecisionQuiz.test.js` has one pre-existing unrelated failure — a fixture missing `roundNumber` — documented before this plan started; confirm no *other* suite fails.)

- [ ] **Step 2: Run the full client suite**

Run: `cd client && npm test -- --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}"`
Expected: PASS, all suites.

- [ ] **Step 3: Drop the private test database**

```bash
mongosh mongodb://localhost:27017/mahjong-test-quiz-streak-points --eval "db.dropDatabase()"
```

- [ ] **Step 4: Update the source tech-debt plan's Suggested Fix checklist mentally against what shipped**

No file edit here — this is a sanity check before handoff. Confirm each item in `docs/tech-debt/points/new-earning-paths-quizzes-and-streaks.md`'s `## Suggested Fix` was addressed:
1. Single server-side config module serving the modal — done (Task 1, Task 10, Task 11).
2. New earn types added to the enum, source keys declared in metadata — done (Task 4).
3. Quiz points awarded on first response only, through an idempotent once-mechanism, behind a cap — done (Task 7, Task 9).
4. Streaks/weekly goals evaluated inline, no scheduler — done (Task 6, Task 8, Task 9).
5. Tests: idempotent quiz award, cap boundary, streak window rollover — done (Task 6, Task 7).

- [ ] **Step 5: Final commit (if anything is unstaged)**

```bash
git status
```
If clean, nothing to do — every task already committed its own changes. If anything is unstaged (shouldn't be), stage and commit it with a description of what it is before finishing.

---

## Summary of new/changed files

**New:**
- `server/src/utils/pointsConfig.js`
- `server/src/utils/weekWindow.js` + `.test.js`
- `server/src/utils/pointsLedger.js`
- `server/src/utils/weeklyStreakService.js` + `.test.js`
- `server/src/models/PointTransaction.test.js`
- `server/src/middleware/auth.test.js`
- `server/src/routes/decisionQuizzes.points.test.js`
- `server/src/routes/discardQuizzes.points.test.js`

**Modified:**
- `server/src/utils/pointsService.js` (+`.test.js`)
- `server/src/models/PointTransaction.js`
- `server/src/models/User.js`
- `server/src/middleware/auth.js`
- `server/src/routes/games.js` (+`.test.js`)
- `server/src/routes/decisionQuizzes.js`
- `server/src/routes/discardQuizzes.js`
- `server/src/routes/points.js` (+`.test.js`)
- `client/src/services/api.ts`
- `client/src/components/PointsHelpModal.tsx` (+`__tests__/PointsHelpModal.test.tsx`)
- `client/src/pages/Points.tsx`
