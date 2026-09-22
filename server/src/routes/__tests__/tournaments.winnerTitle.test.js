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

jest.mock('../../models/Tournament', () => {
  const Tournament = jest.fn();
  Tournament.findById = jest.fn();
  return Tournament;
});

jest.mock('../../models/User', () => ({
  findById: jest.fn(),
  PLAYER_POPULATE_FIELDS: 'displayName avatar'
}));

jest.mock('../../models/Game');
jest.mock('../../utils/roundGenerationService', () => ({ generateRoundPairings: jest.fn(), getFinalsMatchCount: jest.fn() }));
jest.mock('../../utils/gameService', () => ({ createGame: jest.fn() }));
jest.mock('../../utils/emailService', () => ({
  sendRoundPairingNotificationEmail: jest.fn(),
  sendNewTournamentNotificationEmail: jest.fn(),
  sendWaitlistPromotionNotificationEmail: jest.fn(),
  sendTournamentUpdateNotificationEmail: jest.fn()
}));
jest.mock('../../utils/pointsService', () => ({ awardTournamentPoints: jest.fn() }));
jest.mock('../../utils/flairGrantService', () => ({ grantTournamentChampionTitle: jest.fn() }));

const Tournament = require('../../models/Tournament');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';

// Under 7 days away, so the create route does not fan out new-tournament notification emails.
const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

const onlineTournamentBody = extra => ({
  name: 'Spring Open',
  date: soon,
  isOnline: true,
  onlineLocation: 'https://example.com/room',
  ...extra
});

function makeStoredTournament(overrides = {}) {
  return {
    _id: TOURNAMENT_ID,
    name: 'Spring Open',
    status: 'NotStarted',
    winnerTitle: undefined,
    date: new Date('2027-05-01T00:00:00.000Z'),
    isOnline: true,
    rounds: [],
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('POST /tournaments — winnerTitle', () => {
  let created;

  beforeEach(() => {
    jest.clearAllMocks();
    Tournament.mockImplementation(data => {
      created = { ...data, _id: TOURNAMENT_ID, save: jest.fn().mockResolvedValue(undefined), populate: jest.fn().mockResolvedValue(undefined), status: 'NotStarted', rounds: [] };
      return created;
    });
  });

  test('stores a trimmed winnerTitle', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: '  Spring Champ  ' }));

    expect(res.status).toBe(201);
    expect(created.winnerTitle).toBe('Spring Champ');
  });

  test('omits winnerTitle when blank so the name default applies', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: '   ' }));

    expect(res.status).toBe(201);
    expect(created).not.toHaveProperty('winnerTitle');
  });

  test('rejects a winnerTitle over 30 characters', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: 'a'.repeat(31) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be more than 30 characters');
    expect(Tournament).not.toHaveBeenCalled();
  });
});

describe('PUT /tournaments/:id — winnerTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const put = body => request(app).put(`/tournaments/${TOURNAMENT_ID}`).send(body);

  test('updates the winnerTitle before the tournament completes', async () => {
    const stored = makeStoredTournament();
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: ' Spring Champ ' });

    expect(res.status).toBe(200);
    expect(stored.winnerTitle).toBe('Spring Champ');
    expect(stored.save).toHaveBeenCalled();
  });

  test('clears the winnerTitle when blank', async () => {
    const stored = makeStoredTournament({ winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: '' });

    expect(res.status).toBe(200);
    expect(stored.winnerTitle).toBeUndefined();
  });

  test('rejects a winnerTitle over 30 characters', async () => {
    Tournament.findById.mockResolvedValue(makeStoredTournament());

    const res = await put({ winnerTitle: 'a'.repeat(31) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be more than 30 characters');
  });

  test('rejects changing the winnerTitle once the tournament is completed', async () => {
    const stored = makeStoredTournament({ status: 'Completed', winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: 'New' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be changed after the tournament is completed');
    expect(stored.winnerTitle).toBe('Old');
    expect(stored.save).not.toHaveBeenCalled();
  });

  test('allows resending the unchanged winnerTitle on a completed tournament', async () => {
    const stored = makeStoredTournament({ status: 'Completed', winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ description: 'Updated', winnerTitle: 'Old' });

    expect(res.status).toBe(200);
    expect(stored.save).toHaveBeenCalled();
  });
});
