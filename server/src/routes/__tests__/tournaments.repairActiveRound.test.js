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
const { generateRoundPairings } = require('../../utils/roundGenerationService');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';
const P1 = '507f1f77bcf86cd799439101';
const P2 = '507f1f77bcf86cd799439102';
const P3 = '507f1f77bcf86cd799439103';
const P4 = '507f1f77bcf86cd799439104';
const P5 = '507f1f77bcf86cd799439105';

function makeMockTournament(overrides = {}) {
  return {
    _id: TOURNAMENT_ID,
    status: 'InProgress',
    preliminaryRoundCount: 1,
    players: [],
    waitlist: [],
    rounds: [],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function repairRequest() {
  return request(app).put(`/tournaments/${TOURNAMENT_ID}/repair-active-round`);
}

describe('PUT /tournaments/:id/repair-active-round', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns 404 when tournament does not exist', async () => {
    Tournament.findById.mockResolvedValue(null);

    const res = await repairRequest();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test.each(['NotStarted', 'Completed', 'Cancelled'])(
    'returns 400 when tournament status is %s',
    async (status) => {
      Tournament.findById.mockResolvedValue(makeMockTournament({ status }));

      const res = await repairRequest();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/in progress/i);
    }
  );

  test('returns 400 when there is no active round with pairings', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament({ rounds: [] }));

    const res = await repairRequest();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no active round/i);
  });

  test('returns 400 when the active round already has a reported result', async () => {
    const tournament = makeMockTournament({
      rounds: [
        {
          roundNumber: 1,
          pairings: [
            { tableNumber: 1, game: '507f1f77bcf86cd799439077', players: [] }
          ]
        }
      ]
    });
    Tournament.findById.mockResolvedValue(tournament);

    const res = await repairRequest();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already|result/i);
  });

  describe('non-finals round', () => {
    function makeActiveRegularRoundTournament() {
      return makeMockTournament({
        preliminaryRoundCount: 3,
        players: [
          { player: { toString: () => P1 }, dropped: false, uma: 10 },
          { player: { toString: () => P2 }, dropped: false, uma: 20 }
        ],
        rounds: [
          {
            roundNumber: 2,
            pairings: [
              {
                tableNumber: 1,
                game: null,
                players: [
                  { player: { toString: () => P1 }, seat: 'East' },
                  { player: { toString: () => P2 }, seat: 'South' },
                  { player: { toString: () => P3 }, seat: 'West' },
                  { player: { toString: () => P4 }, seat: 'North' }
                ]
              }
            ]
          }
        ]
      });
    }

    test('regenerates pairings via generateRoundPairings for the active round number', async () => {
      const tournament = makeActiveRegularRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);
      generateRoundPairings.mockResolvedValue([
        {
          tableNumber: 1,
          players: [
            { player: P4, seat: 'East' },
            { player: P3, seat: 'South' },
            { player: P2, seat: 'West' },
            { player: P1, seat: 'North' }
          ]
        }
      ]);

      const res = await repairRequest();

      expect(res.status).toBe(200);
      expect(generateRoundPairings).toHaveBeenCalledWith(tournament, 2);
      const newPairing = tournament.rounds[0].pairings[0];
      expect(newPairing.game).toBeNull();
      expect(newPairing.players.map(p => p.seat)).toEqual(['East', 'South', 'West', 'North']);
      expect(newPairing.players.map(p => p.player.toString())).toEqual([P4, P3, P2, P1]);
    });

    test('populates rounds.pairings.game before regenerating (for UMA-based strategies)', async () => {
      const tournament = makeActiveRegularRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);
      generateRoundPairings.mockResolvedValue([
        {
          tableNumber: 1,
          players: [
            { player: P1, seat: 'East' },
            { player: P2, seat: 'South' },
            { player: P3, seat: 'West' },
            { player: P4, seat: 'North' }
          ]
        }
      ]);

      await repairRequest();

      expect(tournament.populate).toHaveBeenCalledWith('rounds.pairings.game');
    });

    test('saves the tournament once', async () => {
      const tournament = makeActiveRegularRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);
      generateRoundPairings.mockResolvedValue([
        {
          tableNumber: 1,
          players: [
            { player: P1, seat: 'East' },
            { player: P2, seat: 'South' },
            { player: P3, seat: 'West' },
            { player: P4, seat: 'North' }
          ]
        }
      ]);

      await repairRequest();

      expect(tournament.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('finals round', () => {
    function makeActiveFinalsRoundTournament(overrides = {}) {
      return makeMockTournament({
        preliminaryRoundCount: 3,
        players: [
          { player: P1, dropped: false, uma: 10 },
          { player: P2, dropped: false, uma: 50 },
          { player: P3, dropped: false, uma: 30 },
          { player: P4, dropped: false, uma: 20 },
          { player: P5, dropped: false, uma: 5 }
        ],
        rounds: [
          {
            roundNumber: 4,
            pairings: [
              {
                tableNumber: 1,
                game: null,
                players: [
                  { player: { toString: () => P1 }, seat: 'East' },
                  { player: { toString: () => P3 }, seat: 'South' },
                  { player: { toString: () => P4 }, seat: 'West' },
                  { player: { toString: () => P5 }, seat: 'North' }
                ]
              }
            ]
          }
        ],
        ...overrides
      });
    }

    test('recomputes top4 by current UMA among non-dropped players', async () => {
      const tournament = makeActiveFinalsRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);

      const res = await repairRequest();

      expect(res.status).toBe(200);
      const pairing = tournament.rounds[0].pairings[0];
      expect(pairing.game).toBeNull();
      const newPlayerIds = pairing.players.map(p => p.player.toString()).sort();
      // Top 4 by uma: P2(50), P3(30), P4(20), P1(10) — P5(5) is excluded.
      expect(newPlayerIds).toEqual([P1, P2, P3, P4].sort());
      expect(newPlayerIds).not.toContain(P5);
    });

    test('excludes dropped players from the top4 recomputation', async () => {
      const tournament = makeActiveFinalsRoundTournament();
      // Drop P2, the highest-UMA player — P5 should now make the cut instead.
      tournament.players[1].dropped = true;
      Tournament.findById.mockResolvedValue(tournament);

      await repairRequest();

      const pairing = tournament.rounds[0].pairings[0];
      const newPlayerIds = pairing.players.map(p => p.player.toString());
      expect(newPlayerIds).not.toContain(P2);
      expect(newPlayerIds).toContain(P5);
    });

    test('does not call generateRoundPairings for a finals round', async () => {
      const tournament = makeActiveFinalsRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);

      await repairRequest();

      expect(generateRoundPairings).not.toHaveBeenCalled();
    });

    test('returns 400 when fewer than 4 non-dropped players remain', async () => {
      const tournament = makeActiveFinalsRoundTournament();
      tournament.players.forEach((p, i) => { if (i > 0) p.dropped = true; });
      Tournament.findById.mockResolvedValue(tournament);

      const res = await repairRequest();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not enough/i);
    });

    test('assigns each of the 4 seats exactly once', async () => {
      const tournament = makeActiveFinalsRoundTournament();
      Tournament.findById.mockResolvedValue(tournament);

      await repairRequest();

      const pairing = tournament.rounds[0].pairings[0];
      const seats = pairing.players.map(p => p.seat).sort();
      expect(seats).toEqual(['East', 'North', 'South', 'West']);
    });
  });

  test('populates the response the same way other tournament-mutation routes do', async () => {
    const tournament = makeMockTournament({
      preliminaryRoundCount: 3,
      players: [
        { player: P1, dropped: false, uma: 10 },
        { player: P2, dropped: false, uma: 20 },
        { player: P3, dropped: false, uma: 30 },
        { player: P4, dropped: false, uma: 40 }
      ],
      rounds: [
        {
          roundNumber: 4,
          pairings: [
            {
              tableNumber: 1,
              game: null,
              players: [
                { player: { toString: () => P1 }, seat: 'East' },
                { player: { toString: () => P2 }, seat: 'South' },
                { player: { toString: () => P3 }, seat: 'West' },
                { player: { toString: () => P4 }, seat: 'North' }
              ]
            }
          ]
        }
      ]
    });
    Tournament.findById.mockResolvedValue(tournament);

    await repairRequest();

    expect(tournament.populate).toHaveBeenCalledWith('players.player', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('waitlist.player', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('createdBy', 'displayName avatar');
    expect(tournament.populate).toHaveBeenCalledWith('rounds.pairings.players.player', 'displayName avatar');
  });
});
