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
