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
const Game = require('../../models/Game');
const { awardGamePoints } = require('../../utils/pointsService');
const { updateRankedPoints } = require('../../utils/rankedLeagueService');
const { generateRoundPairings } = require('../../utils/roundGenerationService');
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

  describe('active-round reshuffle', () => {
    function makeActiveRoundTournament() {
      return makeMockTournament({
        players: [{ player: { toString: () => '507f1f77bcf86cd799439102' }, dropped: false }],
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
                  { player: { toString: () => '507f1f77bcf86cd799439102' }, seat: 'South' },
                  { player: { toString: () => '507f1f77bcf86cd799439103' }, seat: 'West' },
                  { player: { toString: () => '507f1f77bcf86cd799439104' }, seat: 'North' }
                ]
              }
            ]
          }
        ]
      });
    }

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
            { player: '507f1f77bcf86cd799439102', seat: 'South' },
            { player: '507f1f77bcf86cd799439103', seat: 'West' },
            { player: '507f1f77bcf86cd799439104', seat: 'North' }
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
            { player: '507f1f77bcf86cd799439102', seat: 'East' },
            { player: '507f1f77bcf86cd799439103', seat: 'South' },
            { player: '507f1f77bcf86cd799439104', seat: 'West' }
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
            { player: '507f1f77bcf86cd799439102', seat: 'South' },
            { player: '507f1f77bcf86cd799439103', seat: 'West' },
            { player: '507f1f77bcf86cd799439104', seat: 'North' }
          ]
        }
      ]);

      await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [{ roundNumber: 1, fillerId: FILLER_ID }]
      });

      expect(tournament.populate).toHaveBeenCalledWith('rounds.pairings.game');

      // Proves ORDER, not just that both were called: UMA-based round strategies
      // read pairing.game.players, so populate must resolve before generateRoundPairings runs.
      const populateCallOrder = tournament.populate.mock.invocationCallOrder[0];
      const generateCallOrder = generateRoundPairings.mock.invocationCallOrder[0];
      expect(populateCallOrder).toBeLessThan(generateCallOrder);
    });
  });

  describe('mixed completed-round and active-round selections', () => {
    test('adds the real player to tournament.players exactly once when one request swaps a completed round and an active round', async () => {
      const ROUND2_FILLER_ID = '507f1f77bcf86cd799439201';
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
                  { player: { toString: () => 'p2' }, seat: 'South' },
                  { player: { toString: () => 'p3' }, seat: 'West' },
                  { player: { toString: () => 'p4' }, seat: 'North' }
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
                  { player: { toString: () => ROUND2_FILLER_ID }, seat: 'East' },
                  { player: { toString: () => '507f1f77bcf86cd799439202' }, seat: 'South' },
                  { player: { toString: () => '507f1f77bcf86cd799439203' }, seat: 'West' },
                  { player: { toString: () => '507f1f77bcf86cd799439204' }, seat: 'North' }
                ]
              }
            ]
          }
        ]
      });

      Tournament.findById.mockResolvedValue(tournament);
      mockEligibleRealPlayer();
      mockFillerLookup([FILLER_ID, ROUND2_FILLER_ID]);
      Game.findById.mockResolvedValue(makeMockGame());
      generateRoundPairings.mockResolvedValue([
        {
          tableNumber: 1,
          players: [
            { player: REAL_PLAYER_ID, seat: 'East' },
            { player: '507f1f77bcf86cd799439202', seat: 'South' },
            { player: '507f1f77bcf86cd799439203', seat: 'West' },
            { player: '507f1f77bcf86cd799439204', seat: 'North' }
          ]
        }
      ]);

      const res = await swapRequest({
        realPlayerId: REAL_PLAYER_ID,
        roundSelections: [
          { roundNumber: 1, fillerId: FILLER_ID },
          { roundNumber: 2, fillerId: ROUND2_FILLER_ID }
        ]
      });

      expect(res.status).toBe(200);
      expect(tournament.players).toHaveLength(1);
      expect(tournament.players[0]).toEqual({ player: REAL_PLAYER_ID, dropped: false });
    });
  });
});
