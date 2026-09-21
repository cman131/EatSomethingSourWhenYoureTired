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

jest.mock('../../utils/pointsService', () => ({
  awardTournamentPoints: jest.fn().mockResolvedValue(undefined)
}));

const Tournament = require('../../models/Tournament');
const { getFinalsMatchCount } = require('../../utils/roundGenerationService');
const { awardTournamentPoints } = require('../../utils/pointsService');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';
const PLAYER_IDS = [
  '507f1f77bcf86cd799439021',
  '507f1f77bcf86cd799439022',
  '507f1f77bcf86cd799439023',
  '507f1f77bcf86cd799439024',
  '507f1f77bcf86cd799439025'
];

function makeMockTournament({ status = 'InProgress', preliminaryRoundCount = 1 } = {}) {
  return {
    _id: TOURNAMENT_ID,
    createdBy: { toString: () => 'adminUserId123456789012' },
    status,
    preliminaryRoundCount,
    rounds: [{
      roundNumber: 1,
      pairings: [{ tableNumber: 1, players: [], game: { verified: true, players: [] } }]
    }],
    players: PLAYER_IDS.map((id, index) => ({ player: id, dropped: false, uma: 50 - index })),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined)
  };
}

const endRound = () => request(app).put(`/tournaments/${TOURNAMENT_ID}/rounds/1/end`);

describe('PUT /tournaments/:id/rounds/:roundNumber/end — tournament points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFinalsMatchCount.mockReturnValue(0);
  });

  test('awards tournament points once when ending the last round completes the tournament', async () => {
    const tournament = makeMockTournament();
    Tournament.findById.mockResolvedValue(tournament);

    const res = await endRound();

    expect(res.status).toBe(200);
    expect(tournament.status).toBe('Completed');
    expect(awardTournamentPoints).toHaveBeenCalledTimes(1);
    expect(awardTournamentPoints).toHaveBeenCalledWith(tournament);
  });

  test('returns 400 and awards nothing when the tournament is already completed', async () => {
    const tournament = makeMockTournament({ status: 'Completed' });
    Tournament.findById.mockResolvedValue(tournament);

    const res = await endRound();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already completed/i);
    expect(awardTournamentPoints).not.toHaveBeenCalled();
    expect(tournament.save).not.toHaveBeenCalled();
  });
});
