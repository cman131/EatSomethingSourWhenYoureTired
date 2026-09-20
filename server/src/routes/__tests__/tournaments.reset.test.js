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
  PLAYER_POPULATE_FIELDS: 'displayName avatar'
}));

jest.mock('../../models/Game');

jest.mock('../../utils/roundGenerationService', () => ({
  generateRoundPairings: jest.fn(),
  getFinalsMatchCount: jest.fn()
}));

jest.mock('../../utils/gameService', () => ({ createGame: jest.fn() }));

jest.mock('../../utils/emailService', () => ({
  sendRoundPairingNotificationEmail: jest.fn(),
  sendNewTournamentNotificationEmail: jest.fn(),
  sendWaitlistPromotionNotificationEmail: jest.fn(),
  sendTournamentUpdateNotificationEmail: jest.fn()
}));

const Tournament = require('../../models/Tournament');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';
const ROUND_NUMBER = 1;

function makeMockTournament({ startDate = null, pairings = [] } = {}) {
  return {
    _id: TOURNAMENT_ID,
    createdBy: { toString: () => 'adminUserId123456789012' },
    status: 'InProgress',
    rounds: [{ roundNumber: ROUND_NUMBER, startDate, pairings }],
    players: [],
    waitlist: [],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined)
  };
}

describe('PUT /tournaments/:id/rounds/:roundNumber/reset', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns 400 when round has already been started', async () => {
    Tournament.findById.mockResolvedValue(
      makeMockTournament({ startDate: new Date('2024-01-01') })
    );

    const res = await request(app)
      .put(`/tournaments/${TOURNAMENT_ID}/rounds/${ROUND_NUMBER}/reset`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/started/i);
  });

  test('does not persist changes when round has already been started', async () => {
    const tournament = makeMockTournament({ startDate: new Date('2024-01-01') });
    Tournament.findById.mockResolvedValue(tournament);

    await request(app)
      .put(`/tournaments/${TOURNAMENT_ID}/rounds/${ROUND_NUMBER}/reset`);

    expect(tournament.save).not.toHaveBeenCalled();
  });

  test('returns 400 when round has pairings with associated games', async () => {
    Tournament.findById.mockResolvedValue(
      makeMockTournament({ pairings: [{ game: '507f1f77bcf86cd799439099' }] })
    );

    const res = await request(app)
      .put(`/tournaments/${TOURNAMENT_ID}/rounds/${ROUND_NUMBER}/reset`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/game/i);
  });

  test('clears pairings for an unstarted round with no linked games', async () => {
    const tournament = makeMockTournament({ pairings: [{ players: [] }] });
    Tournament.findById.mockResolvedValue(tournament);

    const res = await request(app)
      .put(`/tournaments/${TOURNAMENT_ID}/rounds/${ROUND_NUMBER}/reset`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(tournament.save).toHaveBeenCalled();
  });
});
