# Game Deletion Stale Pairing Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a misleading admin UI confirmation message and add a regression test locking in the server's pairing-clear behavior on game deletion.

**Architecture:** The server-side fix (`DELETE /api/games/:id` nullifying `pairing.game` in all owning tournaments) already exists in `server/src/routes/games.js:597-616`. This plan (1) corrects the frontend confirmation dialog to accurately reflect what happens, and (2) adds a Jest unit test that fails if the pairing-clear logic is ever removed.

**Tech Stack:** TypeScript/React 18 (frontend), Node.js/Express (backend), Jest + supertest (testing)

---

### Task 1: Fix the misleading deletion confirmation message

**Files:**
- Modify: `client/src/pages/TournamentGamesAdmin.tsx:153`

- [ ] **Step 1: Locate the line to change**

Open `client/src/pages/TournamentGamesAdmin.tsx`. Find the `handleDeleteGame` function at line 152. The current `window.confirm` call reads:

```ts
if (!tournament || tournament.status === 'Completed' || !window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
```

- [ ] **Step 2: Replace the confirmation message**

Change only the string passed to `window.confirm`. The rest of the condition is unchanged:

```ts
if (!tournament || tournament.status === 'Completed' || !window.confirm('Delete this game? The pairing will be reset and players can resubmit a new game for this table.')) {
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/TournamentGamesAdmin.tsx
git commit -m "fix: update game deletion confirm message to reflect pairing reset behavior"
```

---

### Task 2: Add a regression test for the pairing-clear behavior

**Files:**
- Create: `server/src/routes/games.test.js`

This test ensures that `DELETE /api/games/:id` sets `pairing.game = null` on every owning tournament pairing. It uses Jest mocks to avoid a real MongoDB connection — no new dependencies needed.

- [ ] **Step 1: Install server dev dependencies (if not done)**

```bash
cd server && npm install
```

Expected: exits 0; `node_modules/jest` and `node_modules/supertest` already present.

- [ ] **Step 2: Write the failing test**

Create `server/src/routes/games.test.js` with the following content:

```js
// Mock all module-level side-effects before any require() of the router
jest.mock('../models/Game');
jest.mock('../models/Tournament');
jest.mock('../models/User', () => {
  const fn = jest.fn();
  fn.findById = jest.fn();
  fn.PLAYER_POPULATE_FIELDS = '_id name username';
  return fn;
});
jest.mock('../utils/emailService', () => ({
  sendNewCommentNotificationEmail: jest.fn(),
}));
jest.mock('../utils/gameService', () => ({
  createGame: jest.fn(),
}));
jest.mock('../utils/rankedLeagueService', () => ({
  getCurrentLeague: jest.fn(),
  updateRankedPoints: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');

// Valid 24-char hex ObjectId strings (real format, passes validateMongoId)
const GAME_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f191e810c19729de860ea';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  // Bypass JWT: inject a pre-authenticated admin user
  app.use((req, _res, next) => {
    req.user = {
      _id: { toString: () => USER_ID },
      isAdmin: true,
    };
    next();
  });
  app.use('/api/games', require('./games'));
  return app;
}

describe('DELETE /api/games/:id — pairing reference cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets pairing.game to null for every tournament pairing that references the deleted game', async () => {
    const pairing = {
      game: { toString: () => GAME_ID },
    };
    const tournament = {
      rounds: [{ pairings: [pairing] }],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => USER_ID },
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    Game.findById.mockResolvedValue(game);
    Tournament.find.mockResolvedValue([tournament]);

    const app = buildTestApp();
    const res = await request(app)
      .delete(`/api/games/${GAME_ID}`)
      .set('Authorization', 'Bearer ignored');

    expect(res.status).toBe(200);
    expect(pairing.game).toBeNull();
    expect(tournament.markModified).toHaveBeenCalledWith('rounds');
    expect(tournament.save).toHaveBeenCalledTimes(1);
    expect(game.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('leaves pairings referencing other games untouched', async () => {
    const OTHER_GAME_ID = '507f1f77bcf86cd799439012';
    const pairingForOtherGame = {
      game: { toString: () => OTHER_GAME_ID },
    };
    const tournament = {
      rounds: [{ pairings: [pairingForOtherGame] }],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => USER_ID },
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    Game.findById.mockResolvedValue(game);
    // Tournament.find returns empty because MongoDB query uses the game id — simulate with empty
    Tournament.find.mockResolvedValue([]);

    const app = buildTestApp();
    const res = await request(app)
      .delete(`/api/games/${GAME_ID}`)
      .set('Authorization', 'Bearer ignored');

    expect(res.status).toBe(200);
    // pairingForOtherGame.game is still the OTHER_GAME_ID object (not null)
    expect(pairingForOtherGame.game).not.toBeNull();
    expect(tournament.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails (missing implementation path)**

```bash
cd server && npx jest src/routes/games.test.js --no-coverage 2>&1
```

Expected: tests FAIL because the mocks are not yet wired. If the test file itself has a syntax error, fix it before proceeding.

Actually — these tests exercise the **existing** delete handler. They should PASS (the fix is already in place). Expected output:

```
PASS src/routes/games.test.js
  DELETE /api/games/:id — pairing reference cleanup
    ✓ sets pairing.game to null for every tournament pairing that references the deleted game
    ✓ leaves pairings referencing other games untouched
```

If they fail, the assertion tells you exactly which invariant is broken. Fix `games.js` before committing.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/games.test.js
git commit -m "test: add regression test for pairing reference cleanup on game deletion"
```
