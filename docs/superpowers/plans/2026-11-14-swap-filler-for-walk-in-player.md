# Swap Filler For Walk-In Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin correct the record when a real walk-in played in a filler's seat, by swapping the filler's identity for the real player's — per completed round, and with a full pairing re-shuffle for the still-in-progress round — then retroactively awarding the points the filler was skipped for.

**Architecture:** One new admin-only route, `POST /api/tournaments/:id/swap-filler`, added to the existing `server/src/routes/tournaments.js` monolith (it already holds every other tournament-mutation route; this follows that established pattern rather than introducing a new file). It validates a real player + a set of `{ roundNumber, fillerId }` selections, then for each selection either (a) swaps the identity in-place on an already-played pairing/game and replays point awards, or (b) for the still-unplayed active round, adds the real player to the roster and regenerates that round's pairings from scratch via the existing `generateRoundPairings`. A new client component, `SwapFillerModal.tsx`, drives this from `TournamentDetail.tsx`.

**Tech Stack:** Express 4 / Mongoose (server), React 18 + TypeScript (client), Jest + Supertest (server tests), Jest + React Testing Library (client tests).

**Design doc:** `docs/superpowers/specs/2026-11-14-swap-filler-for-walk-in-player-design.md` — read it first; this plan implements it exactly, with one correctness refinement discovered during planning (see Task 5's note on unverified games).

---

## File Structure

- **Modify** `server/src/routes/tournaments.js` — add the `POST /:id/swap-filler` route and two new destructured requires (`awardGamePoints` from the existing `pointsService` import, `updateRankedPoints` from a new `rankedLeagueService` import).
- **Create** `server/src/routes/__tests__/tournaments.swapFiller.test.js` — all server-side coverage for the new route.
- **Modify** `client/src/services/api.ts` — add `tournamentsApi.swapFiller(...)`.
- **Create** `client/src/components/tournaments/SwapFillerModal.tsx` — the two-step modal (pick player → map rounds to fillers → submit).
- **Create** `client/src/components/tournaments/SwapFillerModal.test.tsx` — coverage for the modal's round/filler derivation and submit flow.
- **Modify** `client/src/pages/TournamentDetail.tsx` — new state, handler, button, and modal mount.

---

## Task 1: Route scaffold — tournament status and request-shape validation

**Files:**
- Modify: `server/src/routes/tournaments.js:12` (requires) and after line 1518 (new route, right after `reconcile-active-round`)
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js` (new file)

- [ ] **Step 1: Write the failing tests**

Create `server/src/routes/__tests__/tournaments.swapFiller.test.js`:

```js
const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { _id: 'adminUserId123456789012', isAdmin: true };
    next();
  }
}));

jest.mock('../../middleware/validation', () => ({
  validateMongoId: () => (req, res, next) => next(),
  validateGameCreation: () => (req, res, next) => next()
}));

jest.mock('../../models/Tournament', () => ({ findById: jest.fn() }));

jest.mock('../../models/User', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  PLAYER_POPULATE_FIELDS: 'displayName avatar'
}));

jest.mock('../../models/Game', () => ({ findById: jest.fn() }));

jest.mock('../../utils/roundGenerationService', () => ({
  generateRoundPairings: jest.fn(),
  getFinalsMatchCount: jest.fn()
}));

jest.mock('../../utils/gameService', () => ({ createGame: jest.fn() }));

jest.mock('../../utils/pointsService', () => ({
  awardTournamentPoints: jest.fn(),
  awardGamePoints: jest.fn()
}));

jest.mock('../../utils/rankedLeagueService', () => ({
  updateRankedPoints: jest.fn()
}));

jest.mock('../../utils/emailService', () => ({
  sendRoundPairingNotificationEmail: jest.fn(),
  sendNewTournamentNotificationEmail: jest.fn(),
  sendWaitlistPromotionNotificationEmail: jest.fn(),
  sendTournamentUpdateNotificationEmail: jest.fn()
}));

const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';
const REAL_PLAYER_ID = '507f1f77bcf86cd799439022';
const FILLER_ID = '507f1f77bcf86cd799439033';

function makeMockTournament(overrides = {}) {
  return {
    _id: TOURNAMENT_ID,
    status: 'InProgress',
    players: [],
    waitlist: [],
    rounds: [],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function swapRequest(body) {
  return request(app)
    .post(`/tournaments/${TOURNAMENT_ID}/swap-filler`)
    .send(body);
}

describe('POST /tournaments/:id/swap-filler', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns 400 when realPlayerId is missing', async () => {
    const res = await swapRequest({ roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/realPlayerId/i);
  });

  test('returns 400 when roundSelections is missing', async () => {
    const res = await swapRequest({ realPlayerId: REAL_PLAYER_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/roundSelections/i);
  });

  test('returns 400 when roundSelections is an empty array', async () => {
    const res = await swapRequest({ realPlayerId: REAL_PLAYER_ID, roundSelections: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/roundSelections/i);
  });

  test('returns 400 when roundSelections has duplicate round numbers', async () => {
    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [
        { roundNumber: 1, fillerId: FILLER_ID },
        { roundNumber: 1, fillerId: '507f1f77bcf86cd799439044' }
      ]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/duplicate/i);
  });

  test('returns 404 when tournament does not exist', async () => {
    Tournament.findById.mockResolvedValue(null);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(404);
  });

  test.each(['NotStarted', 'Completed', 'Cancelled'])(
    'returns 400 when tournament status is %s',
    async (status) => {
      Tournament.findById.mockResolvedValue(makeMockTournament({ status }));

      const res = await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/in progress/i);
    }
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — `404` (route doesn't exist yet) for every case.

- [ ] **Step 3: Add the new requires**

In `server/src/routes/tournaments.js`, line 12 currently reads:

```js
const { awardTournamentPoints } = require('../utils/pointsService');
```

Replace it with:

```js
const { awardTournamentPoints, awardGamePoints } = require('../utils/pointsService');
const { updateRankedPoints } = require('../utils/rankedLeagueService');
```

- [ ] **Step 4: Add the route scaffold**

Immediately after the `reconcile-active-round` route's closing `});` (the route ending at what is currently line 1518, right before the `// @route   POST /api/tournaments/:id/signup` comment), insert:

```js
// @route   POST /api/tournaments/:id/swap-filler
// @desc    Swap a filler player for the real walk-in who was actually sitting in their seat (Admin only)
// @access  Private (Admin only)
router.post('/:id/swap-filler', authenticateToken, validateMongoId('id'), requireAdmin, async (req, res) => {
  try {
    const { realPlayerId, roundSelections } = req.body;

    if (!realPlayerId) {
      return res.status(400).json({
        success: false,
        message: 'realPlayerId is required'
      });
    }

    if (!Array.isArray(roundSelections) || roundSelections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'roundSelections must be a non-empty array'
      });
    }

    const roundNumbers = roundSelections.map(s => s.roundNumber);
    if (new Set(roundNumbers).size !== roundNumbers.length) {
      return res.status(400).json({
        success: false,
        message: 'roundSelections cannot contain duplicate round numbers'
      });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (tournament.status !== 'InProgress') {
      return res.status(400).json({
        success: false,
        message: 'Can only swap a filler while the tournament is in progress'
      });
    }

    res.status(501).json({ success: false, message: 'Not yet implemented' });
  } catch (error) {
    console.error('Swap filler error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to swap filler for walk-in player'
    });
  }
});
```

(The `501` placeholder response is deliberate and temporary — Task 2 replaces it with real player-eligibility validation, Task 3 with round validation, Task 4+ with the actual processing. Each task's tests only assert on behavior already implemented, so this is never a "placeholder in the final plan," just the normal incremental-TDD shape of one route being built up commit by commit.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 7 cases in this file.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: scaffold POST /tournaments/:id/swap-filler with status/shape validation"
```

---

## Task 2: Real player eligibility validation

**Files:**
- Modify: `server/src/routes/tournaments.js` (the route added in Task 1)
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the `describe('POST /tournaments/:id/swap-filler', ...)` block in the test file:

```js
  test('returns 404 when real player does not exist', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament());
    User.findById.mockResolvedValue(null);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/real player/i);
  });

  test('returns 400 when real player is a guest', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament());
    User.findById.mockResolvedValue({ _id: REAL_PLAYER_ID, isGuest: true });

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/guest/i);
  });

  test('returns 400 when real player is already in tournament.players', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament({
      players: [{ player: { toString: () => REAL_PLAYER_ID }, dropped: true }]
    }));
    User.findById.mockResolvedValue({ _id: REAL_PLAYER_ID, isGuest: false });

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('returns 400 when real player is on the waitlist', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament({
      waitlist: [{ player: { toString: () => REAL_PLAYER_ID } }]
    }));
    User.findById.mockResolvedValue({ _id: REAL_PLAYER_ID, isGuest: false });

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/waitlist/i);
  });
```

Note: `realPlayerId` is a plain string in the request body, and the route compares it against `p.player.toString()` the same way the rest of this file does (see `kick`/`drop` above) — the mock player objects above only need a `toString` method for this comparison to work.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — all four new cases get the `501` placeholder instead of their expected status/message.

- [ ] **Step 3: Implement the validation**

Replace the `res.status(501)...` placeholder line from Task 1 with:

```js
    const realPlayer = await User.findById(realPlayerId);

    if (!realPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Real player not found'
      });
    }

    if (realPlayer.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'Cannot swap in a guest user'
      });
    }

    const alreadyRegistered = tournament.players.some(
      p => p.player.toString() === realPlayerId
    );
    if (alreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Player is already registered in this tournament; this tool is only for walk-ins who never signed up'
      });
    }

    const alreadyWaitlisted = (tournament.waitlist || []).some(
      w => w.player.toString() === realPlayerId
    );
    if (alreadyWaitlisted) {
      return res.status(400).json({
        success: false,
        message: 'Player is on the waitlist; this tool is only for walk-ins who never signed up'
      });
    }

    res.status(501).json({ success: false, message: 'Not yet implemented' });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 11 cases so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: validate real-player eligibility in swap-filler route"
```

---

## Task 3: Round/filler-presence validation

**Files:**
- Modify: `server/src/routes/tournaments.js`
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

- [ ] **Step 1: Write the failing tests**

Add a helper and tests to the test file. First, add this helper near `makeMockTournament` (used by this task and later ones):

```js
function makeValidTournament(overrides = {}) {
  return makeMockTournament({
    players: [],
    waitlist: [],
    rounds: [
      {
        roundNumber: 1,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { player: { toString: () => FILLER_ID }, seat: 'East' },
              { player: { toString: () => 'p2' }, seat: 'South' },
              { player: { toString: () => 'p3' }, seat: 'West' },
              { player: { toString: () => 'p4' }, seat: 'North' }
            ]
          }
        ]
      }
    ],
    ...overrides
  });
}

function mockEligibleRealPlayer() {
  User.findById.mockResolvedValue({ _id: REAL_PLAYER_ID, isGuest: false });
}

function mockFillerLookup(fillerIds, { isGuest = true } = {}) {
  User.find.mockReturnValue({
    select: jest.fn().mockResolvedValue(
      fillerIds.map(id => ({ _id: { toString: () => id }, isGuest }))
    )
  });
}
```

Then add these tests:

```js
  test('returns 400 when the selected round does not exist', async () => {
    Tournament.findById.mockResolvedValue(makeValidTournament());
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 99, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/round 99/i);
  });

  test('returns 400 when the filler is not a guest user', async () => {
    Tournament.findById.mockResolvedValue(makeValidTournament());
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID], { isGuest: false });

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a filler/i);
  });

  test('returns 400 when the filler is not seated in the named round', async () => {
    Tournament.findById.mockResolvedValue(makeValidTournament());
    mockEligibleRealPlayer();
    const otherFillerId = '507f1f77bcf86cd799439055';
    mockFillerLookup([otherFillerId]);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: otherFillerId }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found in round 1/i);
  });

  test('returns 400 when the active round has another table with a game already', async () => {
    const tournament = makeValidTournament({
      rounds: [
        {
          roundNumber: 1,
          pairings: [
            {
              tableNumber: 1,
              game: null,
              players: [
                { player: { toString: () => FILLER_ID }, seat: 'East' },
                { player: { toString: () => 'p2' }, seat: 'South' },
                { player: { toString: () => 'p3' }, seat: 'West' },
                { player: { toString: () => 'p4' }, seat: 'North' }
              ]
            },
            {
              tableNumber: 2,
              game: '507f1f77bcf86cd799439066',
              players: [
                { player: { toString: () => 'p5' }, seat: 'East' },
                { player: { toString: () => 'p6' }, seat: 'South' },
                { player: { toString: () => 'p7' }, seat: 'West' },
                { player: { toString: () => 'p8' }, seat: 'North' }
              ]
            }
          ]
        }
      ]
    });
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already played/i);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — all four new cases get the `501` placeholder.

- [ ] **Step 3: Implement the validation**

Replace the `res.status(501)...` placeholder line from Task 2 with:

```js
    const fillerIds = [...new Set(roundSelections.map(s => s.fillerId))];
    const fillerUsers = await User.find({ _id: { $in: fillerIds } }).select('isGuest');
    const fillerUsersById = new Map(fillerUsers.map(u => [u._id.toString(), u]));

    for (const fillerId of fillerIds) {
      const fillerUser = fillerUsersById.get(fillerId);
      if (!fillerUser || !fillerUser.isGuest) {
        return res.status(400).json({
          success: false,
          message: `${fillerId} is not a filler (guest) user`
        });
      }
    }

    // Resolve each selection to its round/pairing/player-entry, validating presence as we go.
    const resolvedSelections = [];
    for (const selection of roundSelections) {
      const { roundNumber, fillerId } = selection;
      const round = tournament.rounds.find(r => r.roundNumber === roundNumber);

      if (!round || !round.pairings || round.pairings.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Round ${roundNumber} has no pairings`
        });
      }

      let foundPairing = null;
      let foundPlayerEntry = null;
      for (const pairing of round.pairings) {
        const entry = pairing.players.find(p => p.player.toString() === fillerId);
        if (entry) {
          foundPairing = pairing;
          foundPlayerEntry = entry;
          break;
        }
      }

      if (!foundPairing) {
        return res.status(400).json({
          success: false,
          message: `Filler ${fillerId} was not found in round ${roundNumber}`
        });
      }

      if (!foundPairing.game && round.pairings.some(p => p.game)) {
        return res.status(400).json({
          success: false,
          message: `Round ${roundNumber} has some tables already played; wait until the round fully ends before swapping its active seat`
        });
      }

      resolvedSelections.push({ roundNumber, round, pairing: foundPairing, playerEntry: foundPlayerEntry, fillerId });
    }

    res.status(501).json({ success: false, message: 'Not yet implemented' });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 15 cases so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: validate round/filler presence in swap-filler route"
```

---

## Task 4: Completed-round identity swap (pairing + game)

**Files:**
- Modify: `server/src/routes/tournaments.js`
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the test file:

```js
function makeCompletedRoundTournament() {
  return makeMockTournament({
    players: [],
    waitlist: [],
    rounds: [
      {
        roundNumber: 1,
        pairings: [
          {
            tableNumber: 1,
            game: '507f1f77bcf86cd799439077',
            players: [
              { player: { toString: () => FILLER_ID }, seat: 'East' },
              { player: { toString: () => 'p2' }, seat: 'South' },
              { player: { toString: () => 'p3' }, seat: 'West' },
              { player: { toString: () => 'p4' }, seat: 'North' }
            ]
          }
        ]
      }
    ]
  });
}

function makeMockGame(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439077',
    verified: true,
    verifiedBy: 'verifierId',
    isRanked: false,
    players: [
      { player: { toString: () => FILLER_ID }, score: 25000, position: 1, rank: 1 },
      { player: { toString: () => 'p2' }, score: 25000, position: 2, rank: 2 },
      { player: { toString: () => 'p3' }, score: 25000, position: 3, rank: 3 },
      { player: { toString: () => 'p4' }, score: 25000, position: 4, rank: 4 }
    ],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}
```

```js
  describe('completed-round swap', () => {
    test('replaces the filler with the real player in the pairing and the linked game', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame();
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);

      const res = await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(res.status).toBe(200);
      const pairingPlayer = tournament.rounds[0].pairings[0].players[0];
      expect(pairingPlayer.player).toBe(REAL_PLAYER_ID);
      expect(game.players[0].player).toBe(REAL_PLAYER_ID);
      expect(game.save).toHaveBeenCalled();
    });

    test('adds the real player to tournament.players exactly once', async () => {
      const tournament = makeCompletedRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(makeMockGame());

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(tournament.players).toHaveLength(1);
      expect(tournament.players[0]).toEqual({ player: REAL_PLAYER_ID, dropped: false });
    });

    test('saves the tournament once', async () => {
      const tournament = makeCompletedRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(makeMockGame());

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(tournament.save).toHaveBeenCalledTimes(1);
    });
  });
```

Note: `realPlayer._id` is set from `User.findById`'s mock, which in `mockEligibleRealPlayer()` returns `{ _id: REAL_PLAYER_ID, isGuest: false }` — a plain string `_id` (not an ObjectId instance), so the implementation must assign that `_id` directly (not re-wrap it), and the pairing/game comparisons above (`toBe(REAL_PLAYER_ID)`) check for exactly that.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — all three new cases get the `501` placeholder (and `tournament.players`/`game.players` are untouched).

- [ ] **Step 3: Implement the processing**

Replace the `res.status(501)...` placeholder line from Task 3 with:

```js
    resolvedSelections.sort((a, b) => a.roundNumber - b.roundNumber);

    let playerAdded = false;
    const activeRoundSelections = [];

    for (const selection of resolvedSelections) {
      const { pairing, playerEntry, fillerId } = selection;

      if (pairing.game) {
        playerEntry.player = realPlayer._id;
        tournament.markModified('rounds');

        const game = await Game.findById(pairing.game);
        if (game) {
          const gamePlayerEntry = game.players.find(p => p.player.toString() === fillerId);
          if (gamePlayerEntry) {
            gamePlayerEntry.player = realPlayer._id;
            await game.save();
          }
        }
      } else {
        activeRoundSelections.push(selection);
      }
    }

    if (!playerAdded) {
      tournament.players.push({ player: realPlayer._id, dropped: false });
      tournament.markModified('players');
      playerAdded = true;
    }

    await tournament.save();

    res.json({
      success: true,
      message: 'Filler swapped for walk-in player successfully',
      data: { tournament }
    });
```

Note: `playerAdded` and `activeRoundSelections` are introduced now even though nothing branches on `activeRoundSelections` yet, and the `if (!playerAdded)` push happens unconditionally right after the loop — this is intentionally the final shape for the completed-round-only path; Task 6 inserts the active-round branch (which sets `playerAdded = true` earlier) between the loop and this push, without changing this block's logic for the completed-round case.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 18 cases so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: swap filler identity in pairing and linked game"
```

---

## Task 5: Retroactive points and ranked replay for completed-round swaps

**Files:**
- Modify: `server/src/routes/tournaments.js`
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

This task adds one correctness refinement beyond the design doc: a game attached to a pairing is not
guaranteed `verified` — a round can have one table finish early (game submitted but not yet
verified by a second player) while the round itself is still active. The design doc's "completed
round" framing assumed verified-by-construction, which is only true once the *whole round* has
ended (enforced by `/rounds/:roundNumber/end`'s own check). Gating the award calls on
`game.verified` keeps this consistent with the domain rule in `CLAUDE.md`: "Games require
verification by a second player before counting toward ranked stats."

- [ ] **Step 1: Write the failing tests**

Add to the test file (needs `awardGamePoints` and `updateRankedPoints` imported from their mocked
modules — add these requires near the top, with the other requires):

```js
const { awardGamePoints } = require('../../utils/pointsService');
const { updateRankedPoints } = require('../../utils/rankedLeagueService');
const Game = require('../../models/Game');
```

```js
  describe('retroactive points for completed-round swap', () => {
    test('awards game points for a verified game', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame({ verified: true });
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(awardGamePoints).toHaveBeenCalledWith(game, game.verifiedBy);
    });

    test('does not award points for an unverified game', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame({ verified: false });
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(awardGamePoints).not.toHaveBeenCalled();
    });

    test('updates ranked points for a verified ranked game', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame({ verified: true, isRanked: true });
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(updateRankedPoints).toHaveBeenCalledWith(game);
    });

    test('does not update ranked points for a non-ranked game', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame({ verified: true, isRanked: false });
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(updateRankedPoints).not.toHaveBeenCalled();
    });

    test('a failed point award does not fail the request', async () => {
      const tournament = makeCompletedRoundTournament();
      const game = makeMockGame({ verified: true });
      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID]);
      Game.findById.mockResolvedValue(game);
      awardGamePoints.mockRejectedValueOnce(new Error('boom'));

      const res = await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(res.status).toBe(200);
      expect(tournament.save).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — `awardGamePoints`/`updateRankedPoints` are never called yet.

- [ ] **Step 3: Implement the award replay**

In the completed-round branch added in Task 4, replace:

```js
          if (gamePlayerEntry) {
            gamePlayerEntry.player = realPlayer._id;
            await game.save();
          }
```

with:

```js
          if (gamePlayerEntry) {
            gamePlayerEntry.player = realPlayer._id;
            await game.save();

            if (game.verified) {
              try {
                await awardGamePoints(game, game.verifiedBy);
              } catch (err) {
                console.error(`Failed to award game points after filler swap for game ${game._id}:`, err);
              }

              if (game.isRanked) {
                try {
                  await updateRankedPoints(game);
                } catch (err) {
                  console.error(`Failed to update ranked points after filler swap for game ${game._id}:`, err);
                }
              }
            }
          }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 23 cases so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: replay game/ranked points for completed-round filler swaps"
```

---

## Task 6: Active-round reshuffle

**Files:**
- Modify: `server/src/routes/tournaments.js`
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the test file:

```js
const { generateRoundPairings } = require('../../utils/roundGenerationService');
```

```js
function makeActiveRoundTournament() {
  return makeMockTournament({
    players: [{ player: { toString: () => 'p2' }, dropped: false }],
    waitlist: [],
    rounds: [
      {
        roundNumber: 1,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { player: { toString: () => FILLER_ID }, seat: 'East' },
              { player: { toString: () => 'p2' }, seat: 'South' },
              { player: { toString: () => 'p3' }, seat: 'West' },
              { player: { toString: () => 'p4' }, seat: 'North' }
            ]
          }
        ]
      }
    ]
  });
}

describe('active-round reshuffle', () => {
  test('adds the real player to tournament.players before regenerating pairings', async () => {
    const tournament = makeActiveRoundTournament();
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);
    generateRoundPairings.mockResolvedValue([
      {
        tableNumber: 1,
        players: [
          { player: REAL_PLAYER_ID, seat: 'East' },
          { player: 'p2', seat: 'South' },
          { player: 'p3', seat: 'West' },
          { player: 'p4', seat: 'North' }
        ]
      }
    ]);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(res.status).toBe(200);
    expect(tournament.players).toHaveLength(2);
    expect(tournament.players.some(p => p.player === REAL_PLAYER_ID)).toBe(true);
    expect(generateRoundPairings).toHaveBeenCalledWith(tournament, 1);
  });

  test('replaces the round pairings with the freshly generated ones', async () => {
    const tournament = makeActiveRoundTournament();
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);
    generateRoundPairings.mockResolvedValue([
      {
        tableNumber: 1,
        players: [
          { player: REAL_PLAYER_ID, seat: 'North' },
          { player: 'p2', seat: 'East' },
          { player: 'p3', seat: 'South' },
          { player: 'p4', seat: 'West' }
        ]
      }
    ]);

    await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    const newPairing = tournament.rounds[0].pairings[0];
    expect(newPairing.game).toBeNull();
    expect(newPairing.players.map(p => p.seat)).toEqual(['North', 'East', 'South', 'West']);
    expect(newPairing.players.find(p => p.player.toString() === REAL_PLAYER_ID)).toBeTruthy();
    expect(
      newPairing.players.some(p => p.player.toString() === FILLER_ID)
    ).toBe(false);
  });

  test('populates rounds.pairings.game before regenerating (for UMA-based strategies)', async () => {
    const tournament = makeActiveRoundTournament();
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);
    generateRoundPairings.mockResolvedValue([
      {
        tableNumber: 1,
        players: [
          { player: REAL_PLAYER_ID, seat: 'East' },
          { player: 'p2', seat: 'South' },
          { player: 'p3', seat: 'West' },
          { player: 'p4', seat: 'North' }
        ]
      }
    ]);

    await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(tournament.populate).toHaveBeenCalledWith('rounds.pairings.game');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — `generateRoundPairings` is never called; `tournament.players` never gains an entry
for the active-round case (it currently only happens in the completed-round path from Task 4).

- [ ] **Step 3: Implement the active-round branch**

Replace:

```js
    if (!playerAdded) {
      tournament.players.push({ player: realPlayer._id, dropped: false });
      tournament.markModified('players');
      playerAdded = true;
    }

    await tournament.save();
```

with:

```js
    if (activeRoundSelections.length > 0) {
      if (!playerAdded) {
        tournament.players.push({ player: realPlayer._id, dropped: false });
        tournament.markModified('players');
        playerAdded = true;
      }

      await tournament.populate('rounds.pairings.game');

      for (const { round } of activeRoundSelections) {
        const newPairings = await generateRoundPairings(tournament, round.roundNumber);
        round.pairings = newPairings.map(p => ({
          tableNumber: p.tableNumber,
          players: p.players.map(pl => ({
            player: new mongoose.Types.ObjectId(pl.player),
            seat: pl.seat
          })),
          game: null
        }));
      }
      tournament.markModified('rounds');
    }

    if (!playerAdded) {
      tournament.players.push({ player: realPlayer._id, dropped: false });
      tournament.markModified('players');
      playerAdded = true;
    }

    await tournament.save();
```

Note: `new mongoose.Types.ObjectId(pl.player)` will throw for the mock player ids used in this
task's tests (e.g. `REAL_PLAYER_ID`, `'p2'`) unless they're valid 24-hex-char strings —
`REAL_PLAYER_ID` already is (`507f1f77bcf86cd799439022`), but `'p2'`/`'p3'`/`'p4'` are not. Fix
`makeActiveRoundTournament` and this task's `generateRoundPairings.mockResolvedValue(...)` calls
to use valid-looking ids throughout (e.g. `'507f1f77bcf86cd799439102'` for p2, `...103` for p3,
`...104` for p4) before running Step 2 — go back and apply that substitution to every mock player
id in this task's test additions (`FILLER_ID` and `REAL_PLAYER_ID` are already valid; only the
plain `'p2'`/`'p3'`/`'p4'` placeholders need it). The assertions' shape is unchanged, only the
literal id strings.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 26 cases so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: regenerate active-round pairings on filler swap"
```

---

## Task 7: Response population and a mixed-rounds integration test

**Files:**
- Modify: `server/src/routes/tournaments.js`
- Test: `server/src/routes/__tests__/tournaments.swapFiller.test.js`

- [ ] **Step 1: Write the failing test**

Add:

```js
  test('populates the response the same way other tournament-mutation routes do', async () => {
    const tournament = makeCompletedRoundTournament();
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID]);
    Game.findById.mockResolvedValue(makeMockGame());

    await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
    });

    expect(tournament.populate).toHaveBeenCalledWith('players.player', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('waitlist.player', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('createdBy', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('rounds.pairings.players.player', 'displayName avatar');
  });

  test('a single request can swap a completed round and reshuffle the active round together', async () => {
    const tournament = makeMockTournament({
      players: [],
      waitlist: [],
      rounds: [
        {
          roundNumber: 1,
          pairings: [
            {
              tableNumber: 1,
              game: '507f1f77bcf86cd799439077',
              players: [
                { player: { toString: () => FILLER_ID }, seat: 'East' },
                { player: { toString: () => '507f1f77bcf86cd799439102' }, seat: 'South' },
                { player: { toString: () => '507f1f77bcf86cd799439103' }, seat: 'West' },
                { player: { toString: () => '507f1f77bcf86cd799439104' }, seat: 'North' }
              ]
            }
          ]
        },
        {
          roundNumber: 2,
          pairings: [
            {
              tableNumber: 1,
              game: null,
              players: [
                { player: { toString: () => '507f1f77bcf86cd799439055' }, seat: 'East' },
                { player: { toString: () => '507f1f77bcf86cd799439102' }, seat: 'South' },
                { player: { toString: () => '507f1f77bcf86cd799439103' }, seat: 'West' },
                { player: { toString: () => '507f1f77bcf86cd799439104' }, seat: 'North' }
              ]
            }
          ]
        }
      ]
    });
    Tournament.findById.mockResolvedValue(tournament);
    mockEligibleRealPlayer();
    mockFillerLookup([FILLER_ID, '507f1f77bcf86cd799439055']);
    Game.findById.mockResolvedValue(makeMockGame());
    generateRoundPairings.mockResolvedValue([
      {
        tableNumber: 1,
        players: [
          { player: REAL_PLAYER_ID, seat: 'East' },
          { player: '507f1f77bcf86cd799439102', seat: 'South' },
          { player: '507f1f77bcf86cd799439103', seat: 'West' },
          { player: '507f1f77bcf86cd799439104', seat: 'North' }
        ]
      }
    ]);

    const res = await swapRequest({
      realPlayerId: REAL_PLAYER_ID,
      roundSelections: [
        { roundNumber: 2, fillerId: '507f1f77bcf86cd799439055' },
        { roundNumber: 1, fillerId: FILLER_ID }
      ]
    });

    expect(res.status).toBe(200);
    // Round 1 (completed) was corrected in place:
    expect(tournament.rounds[0].pairings[0].players[0].player).toBe(REAL_PLAYER_ID);
    // Round 2 (active) was fully regenerated, and round 1's history was already corrected
    // by the time generateRoundPairings ran for round 2:
    expect(generateRoundPairings).toHaveBeenCalledWith(tournament, 2);
    expect(tournament.rounds[0].pairings[0].players[0].player).toBe(REAL_PLAYER_ID);
    // tournament.players gained exactly one entry despite two selections both needing it:
    expect(tournament.players).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: FAIL — the response is never populated yet.

- [ ] **Step 3: Add the response population**

Replace the final `res.json({...})` block (from Task 4) with:

```js
    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('waitlist.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);
    await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);

    await prepareTournamentForResponse(tournament);

    res.json({
      success: true,
      message: 'Filler swapped for walk-in player successfully',
      data: {
        tournament
      }
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npm test -- --watchAll=false --testPathPattern="tournaments.swapFiller"`
Expected: PASS — all 28 cases.

- [ ] **Step 5: Run the full server suite to check for regressions**

Run: `cd server && npm test -- --watchAll=false`
Expected: PASS (no regressions in other route tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.swapFiller.test.js
git commit -m "feat: populate swap-filler response like other tournament routes"
```

---

## Task 8: Client API method

**Files:**
- Modify: `client/src/services/api.ts:650` (right after `reconcileActiveRound`)

- [ ] **Step 1: Add the method**

In `client/src/services/api.ts`, immediately after the `reconcileActiveRound` method (currently
ending at line 654), add:

```ts
  swapFiller: async (
    tournamentId: string,
    payload: { realPlayerId: string; roundSelections: { roundNumber: number; fillerId: string }[] }
  ) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/${tournamentId}/swap-filler`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
```

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat: add tournamentsApi.swapFiller client method"
```

(No dedicated test for this method — consistent with every other method on `tournamentsApi`,
none of which have unit tests of their own; `api.ts` has no test file in this codebase. It's
exercised indirectly by the modal's tests in Task 9/10 via a mock.)

---

## Task 9: `SwapFillerModal` — deriving filler-occupied rounds

**Files:**
- Create: `client/src/components/tournaments/SwapFillerModal.tsx`
- Create: `client/src/components/tournaments/SwapFillerModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/tournaments/SwapFillerModal.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwapFillerModal from './SwapFillerModal';
import { Tournament } from '../../services/api';

jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api');
  return {
    ...actual,
    usersApi: { searchUsers: jest.fn() },
    tournamentsApi: { swapFiller: jest.fn() },
  };
});

function buildTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    _id: 'tournament-1',
    name: 'Test Tournament',
    status: 'InProgress',
    isOnline: false,
    isEastOnly: false,
    ruleset: 'WRC2025',
    players: [],
    rounds: [
      {
        roundNumber: 1,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { seat: 'East', player: { _id: 'filler-1', displayName: 'Filler 1', isGuest: true } },
              { seat: 'South', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
              { seat: 'West', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
              { seat: 'North', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
            ],
          },
        ],
      } as any,
      {
        roundNumber: 2,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { seat: 'East', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
              { seat: 'South', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
              { seat: 'West', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
              { seat: 'North', player: { _id: 'user-5', displayName: 'Eve', isGuest: false } },
            ],
          },
        ],
      } as any,
    ],
    ...overrides,
  } as Tournament;
}

function renderModal(tournament: Tournament) {
  return render(
    <SwapFillerModal
      isOpen={true}
      onClose={jest.fn()}
      onSwapped={jest.fn()}
      tournament={tournament}
    />
  );
}

describe('SwapFillerModal round/filler derivation', () => {
  test('shows round 1 (has a filler) but not round 2 (no filler) before a player is picked', () => {
    renderModal(buildTournament());

    expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/round 2/i)).not.toBeInTheDocument();
  });

  test('labels the filler option with its table and seat', () => {
    renderModal(buildTournament());

    expect(screen.getByText(/Filler 1.*Table 1.*East/i)).toBeInTheDocument();
  });

  test('renders nothing selectable when no round has a filler', () => {
    renderModal(buildTournament({
      rounds: [
        {
          roundNumber: 1,
          pairings: [
            {
              tableNumber: 1,
              game: null,
              players: [
                { seat: 'East', player: { _id: 'user-1', displayName: 'Alice', isGuest: false } },
                { seat: 'South', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
                { seat: 'West', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
                { seat: 'North', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
              ],
            },
          ],
        } as any,
      ],
    }));

    expect(screen.getByText(/no filler-occupied seats/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="SwapFillerModal"`
Expected: FAIL — `Cannot find module './SwapFillerModal'`.

- [ ] **Step 3: Write the component (round/filler derivation only, no search/submit yet)**

Create `client/src/components/tournaments/SwapFillerModal.tsx`:

```tsx
import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Tournament } from '../../services/api';

interface SwapFillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwapped: (tournament: Tournament) => void;
  tournament: Tournament;
}

interface FillerOption {
  fillerId: string;
  label: string;
}

interface RoundFillerOptions {
  roundNumber: number;
  options: FillerOption[];
}

function deriveRoundFillerOptions(tournament: Tournament): RoundFillerOptions[] {
  const rounds = (tournament.rounds || []) as any[];

  return rounds
    .map((round) => {
      const options: FillerOption[] = [];
      for (const pairing of round.pairings || []) {
        for (const playerEntry of pairing.players || []) {
          const player = playerEntry.player;
          if (player && typeof player === 'object' && player.isGuest) {
            options.push({
              fillerId: player._id,
              label: `${player.displayName} — Table ${pairing.tableNumber}, ${playerEntry.seat}`,
            });
          }
        }
      }
      return { roundNumber: round.roundNumber, options };
    })
    .filter((round) => round.options.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

const SwapFillerModal: React.FC<SwapFillerModalProps> = ({ isOpen, onClose, tournament }) => {
  const roundFillerOptions = useMemo(() => deriveRoundFillerOptions(tournament), [tournament]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Swap In a Walk-In Player</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {roundFillerOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No filler-occupied seats found in this tournament.</p>
            ) : (
              <div className="space-y-3">
                {roundFillerOptions.map(({ roundNumber, options }) => (
                  <div key={roundNumber}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Round {roundNumber}
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                      <option value="">— not this round —</option>
                      {options.map((option) => (
                        <option key={option.fillerId} value={option.fillerId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapFillerModal;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="SwapFillerModal"`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/tournaments/SwapFillerModal.tsx client/src/components/tournaments/SwapFillerModal.test.tsx
git commit -m "feat: scaffold SwapFillerModal with per-round filler derivation"
```

---

## Task 10: `SwapFillerModal` — player search, selection state, and submit

**Files:**
- Modify: `client/src/components/tournaments/SwapFillerModal.tsx`
- Modify: `client/src/components/tournaments/SwapFillerModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `SwapFillerModal.test.tsx` (needs `usersApi`/`tournamentsApi` imported from the mocked
module, and `fireEvent`/`waitFor` from RTL):

```tsx
import { fireEvent, waitFor } from '@testing-library/react';
import { usersApi, tournamentsApi } from '../../services/api';

const mockedSearchUsers = usersApi.searchUsers as jest.Mock;
const mockedSwapFiller = tournamentsApi.swapFiller as jest.Mock;
```

```tsx
describe('SwapFillerModal player search and submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('excludes a search result who is already registered or waitlisted', async () => {
    mockedSearchUsers.mockResolvedValue({
      data: {
        users: [
          { _id: 'walkin-1', displayName: 'Walkin', isGuest: false },
          { _id: 'registered-1', displayName: 'AlreadyIn', isGuest: false },
          { _id: 'waitlisted-1', displayName: 'OnWaitlist', isGuest: false },
        ],
      },
    });
    renderModal(buildTournament({
      players: [{ player: { _id: 'registered-1' }, dropped: false } as any],
      waitlist: [{ player: { _id: 'waitlisted-1' } } as any],
    }));

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'a' } });
    await waitFor(() => expect(screen.getByText('Walkin')).toBeInTheDocument());

    expect(screen.queryByText('AlreadyIn')).not.toBeInTheDocument();
    expect(screen.queryByText('OnWaitlist')).not.toBeInTheDocument();
  });

  test('submit is disabled until a player is picked and at least one round is mapped', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    renderModal(buildTournament());

    expect(screen.getByRole('button', { name: /swap/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await waitFor(() => expect(screen.getByText('Walkin')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Walkin'));

    expect(screen.getByRole('button', { name: /swap/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });

    expect(screen.getByRole('button', { name: /swap/i })).not.toBeDisabled();
  });

  test('submits the real player id and the mapped round selections', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    const updatedTournament = buildTournament();
    mockedSwapFiller.mockResolvedValue({ data: { tournament: updatedTournament } });
    const onSwapped = jest.fn();
    const onClose = jest.fn();
    render(
      <SwapFillerModal isOpen={true} onClose={onClose} onSwapped={onSwapped} tournament={buildTournament()} />
    );

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await waitFor(() => expect(screen.getByText('Walkin')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Walkin'));
    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });
    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    await waitFor(() => expect(mockedSwapFiller).toHaveBeenCalledWith('tournament-1', {
      realPlayerId: 'walkin-1',
      roundSelections: [{ roundNumber: 1, fillerId: 'filler-1' }],
    }));
    await waitFor(() => expect(onSwapped).toHaveBeenCalledWith(updatedTournament));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('shows the server error on a failed submit', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    mockedSwapFiller.mockRejectedValue(new Error('Round 1 has some tables already played'));
    renderModal(buildTournament());

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await waitFor(() => expect(screen.getByText('Walkin')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Walkin'));
    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });
    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    await waitFor(() => expect(screen.getByText(/already played/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="SwapFillerModal"`
Expected: FAIL — there's no search input, no selectable player result, no submit button yet.

- [ ] **Step 3: Implement search, selection state, and submit**

The round-selector list must stay unconditionally rendered (not hidden behind picking a player
first) so Task 9's three tests keep passing unchanged — only the search-box-vs-selected-player
block toggles on `realPlayer`. Replace the full contents of
`client/src/components/tournaments/SwapFillerModal.tsx` with:

```tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { usersApi, tournamentsApi, Tournament, User } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface SwapFillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwapped: (tournament: Tournament) => void;
  tournament: Tournament;
}

interface FillerOption {
  fillerId: string;
  label: string;
}

interface RoundFillerOptions {
  roundNumber: number;
  options: FillerOption[];
}

function deriveRoundFillerOptions(tournament: Tournament): RoundFillerOptions[] {
  const rounds = (tournament.rounds || []) as any[];

  return rounds
    .map((round) => {
      const options: FillerOption[] = [];
      for (const pairing of round.pairings || []) {
        for (const playerEntry of pairing.players || []) {
          const player = playerEntry.player;
          if (player && typeof player === 'object' && player.isGuest) {
            options.push({
              fillerId: player._id,
              label: `${player.displayName} — Table ${pairing.tableNumber}, ${playerEntry.seat}`,
            });
          }
        }
      }
      return { roundNumber: round.roundNumber, options };
    })
    .filter((round) => round.options.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

function derivePlayerIdsToExclude(tournament: Tournament): Set<string> {
  const ids = new Set<string>();
  for (const entry of tournament.players || []) {
    const id = typeof entry.player === 'string' ? entry.player : entry.player._id;
    if (id) ids.add(id);
  }
  for (const entry of tournament.waitlist || []) {
    const id = typeof entry.player === 'string' ? entry.player : entry.player._id;
    if (id) ids.add(id);
  }
  return ids;
}

const SwapFillerModal: React.FC<SwapFillerModalProps> = ({ isOpen, onClose, onSwapped, tournament }) => {
  const roundFillerOptions = useMemo(() => deriveRoundFillerOptions(tournament), [tournament]);
  const excludedPlayerIds = useMemo(() => derivePlayerIdsToExclude(tournament), [tournament]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [realPlayer, setRealPlayer] = useState<User | null>(null);
  const [roundSelections, setRoundSelections] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const response = await usersApi.searchUsers(searchTerm, 20);
        setSearchResults(
          response.data.users.filter((u) => !u.isGuest && !excludedPlayerIds.has(u._id))
        );
      } catch (err: any) {
        setError(err.message || 'Failed to search users');
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, excludedPlayerIds]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handlePickRound = (roundNumber: number, fillerId: string) => {
    setRoundSelections((prev) => {
      const next = { ...prev };
      if (fillerId) {
        next[roundNumber] = fillerId;
      } else {
        delete next[roundNumber];
      }
      return next;
    });
  };

  const canSubmit = realPlayer !== null && Object.keys(roundSelections).length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!realPlayer) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await tournamentsApi.swapFiller(tournament._id, {
        realPlayerId: realPlayer._id,
        roundSelections: Object.entries(roundSelections).map(([roundNumber, fillerId]) => ({
          roundNumber: Number(roundNumber),
          fillerId,
        })),
      });
      onSwapped(response.data.tournament);
      setSearchTerm('');
      setSearchResults([]);
      setRealPlayer(null);
      setRoundSelections({});
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to swap filler for walk-in player');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Swap In a Walk-In Player</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              {realPlayer ? (
                <div className="flex items-center justify-between">
                  <UserDisplay user={realPlayer} size="md" showLink={false} showRealName={true} />
                  <button
                    onClick={() => setRealPlayer(null)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="swap-filler-search" className="block text-sm font-medium text-gray-700 mb-2">
                    Search for the walk-in player
                  </label>
                  <input
                    ref={searchInputRef}
                    id="swap-filler-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search users..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />

                  <div className="max-h-96 overflow-y-auto mt-2">
                    {searching ? (
                      <p className="text-gray-500 text-sm py-2">Searching users...</p>
                    ) : (
                      searchResults.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => setRealPlayer(user)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
                        >
                          <UserDisplay user={user} size="md" showLink={false} showRealName={true} className="flex-1" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {roundFillerOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No filler-occupied seats found in this tournament.</p>
            ) : (
              <div className="space-y-3">
                {roundFillerOptions.map(({ roundNumber, options }) => (
                  <div key={roundNumber}>
                    <label
                      htmlFor={`swap-filler-round-${roundNumber}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Round {roundNumber}
                    </label>
                    <select
                      id={`swap-filler-round-${roundNumber}`}
                      value={roundSelections[roundNumber] || ''}
                      onChange={(e) => handlePickRound(roundNumber, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    >
                      <option value="">— not this round —</option>
                      {options.map((option) => (
                        <option key={option.fillerId} value={option.fillerId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Swapping...' : 'Swap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapFillerModal;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="SwapFillerModal"`
Expected: PASS — all 7 cases (3 from Task 9, 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/tournaments/SwapFillerModal.tsx client/src/components/tournaments/SwapFillerModal.test.tsx
git commit -m "feat: add player search, selection state, and submit to SwapFillerModal"
```

---

## Task 11: Wire `SwapFillerModal` into `TournamentDetail`

**Files:**
- Modify: `client/src/pages/TournamentDetail.tsx`

No test file exists for this page today (confirmed: no `TournamentDetail.test.tsx`), and the
sibling "Reconcile active round" button it sits beside isn't covered at the page level either —
only through the modal/API layer, same as `SwapFillerModal` already is via Task 9/10. This task
stays consistent with that existing convention rather than introducing new page-level test
infrastructure as a side effect of one button.

- [ ] **Step 1: Import the modal and add state**

In `client/src/pages/TournamentDetail.tsx`, add the import alongside the other modal imports
(after line 13's `AddPlayerModal` import):

```ts
import SwapFillerModal from '../components/tournaments/SwapFillerModal';
```

Add state alongside `isAddPlayerModalOpen` (line 31):

```ts
  const [isSwapFillerModalOpen, setIsSwapFillerModalOpen] = useState(false);
```

- [ ] **Step 2: Add the handler**

Add alongside `handleReconcileActiveRound` (after it, around line 287):

```ts
  const handleFillerSwapped = (updatedTournament: Tournament) => {
    setTournament(updatedTournament);
  };
```

- [ ] **Step 3: Add the button**

In the `tournament.status === 'InProgress'` admin-actions block (around line 532-564), add a new
button right after the existing "Reconcile active round" button (which ends around line 543):

```tsx
                {user?.isAdmin && (
                  <button
                    onClick={() => setIsSwapFillerModalOpen(true)}
                    disabled={actionLoading}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Swap a filler's seat for the real walk-in player who was actually playing it"
                  >
                    Swap in a walk-in player
                  </button>
                )}
```

- [ ] **Step 4: Mount the modal**

After the `AddPlayerModal` mount (around line 660), add:

```tsx
      <SwapFillerModal
        isOpen={isSwapFillerModalOpen}
        onClose={() => setIsSwapFillerModalOpen(false)}
        onSwapped={handleFillerSwapped}
        tournament={tournament}
      />
```

- [ ] **Step 5: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manually verify in the dev server**

Run: `cd server && npm run dev` (in one terminal) and `cd client && npm start` (in another).
Open an `InProgress` tournament you're an admin on that has at least one filler-occupied round
(any tournament whose active-player count wasn't a multiple of 4 when a round was generated).
Confirm:
- The "Swap in a walk-in player" button appears only for admins, only while `InProgress`.
- Opening it, searching, and picking a player shows only rounds that actually contain a filler.
- Submitting with no round selected is blocked (button stays disabled).
- Submitting a real selection updates the roster/pairings in the page without a full reload.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/TournamentDetail.tsx
git commit -m "feat: wire SwapFillerModal into TournamentDetail admin actions"
```

---

## Final Self-Review Notes (for whoever executes this plan)

- Task 6's note about `mongoose.Types.ObjectId` requiring valid-looking hex ids is easy to miss —
  double-check every mock player id introduced in Tasks 6 and 7 is a 24-hex-char string before
  running those tasks' tests, not just `FILLER_ID`/`REAL_PLAYER_ID`.
- The known ranked-league gap documented in the design spec (per-game, not per-player, idempotency
  in `updateRankedPoints`) is intentionally not fixed by this plan — Task 5 awards/replays points
  exactly as the design spec describes, gap included.
- This plan does not touch `roundGenerationService.js`, `pointsService.js`, or
  `rankedLeagueService.js` — all three are called as-is. If a future change to any of them changes
  behavior this route depends on (e.g. `generateRoundPairings`'s signature, or
  `updateRankedPoints`'s idempotency key), this route's tests (mocked against today's behavior)
  would not catch that; nothing to action here, just worth knowing.
