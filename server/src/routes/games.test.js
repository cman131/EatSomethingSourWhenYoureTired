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
jest.mock('../utils/pointsService', () => ({
  awardGamePoints: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const { awardGamePoints } = require('../utils/pointsService');
const { updateRankedPoints } = require('../utils/rankedLeagueService');

const GAME_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f191e810c19729de860ea';

function buildTestApp() {
  const app = express();
  app.use(express.json());
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
    Tournament.find.mockResolvedValue([]);

    const app = buildTestApp();
    const res = await request(app)
      .delete(`/api/games/${GAME_ID}`)
      .set('Authorization', 'Bearer ignored');

    expect(res.status).toBe(200);
    expect(pairingForOtherGame.game).not.toBeNull();
    expect(tournament.save).not.toHaveBeenCalled();
  });
});

describe('PUT /api/games/:id/verify — verification is atomic', () => {
  const unverifiedGame = () => ({
    _id: GAME_ID,
    verified: false,
    submittedBy: { toString: () => 'someone-else' },
    players: [{ player: { toString: () => USER_ID } }],
  });

  const verifiedGame = (overrides = {}) => ({
    _id: GAME_ID,
    verified: true,
    isRanked: false,
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Game.findById.mockResolvedValue(unverifiedGame());
    Tournament.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
  });

  it('flips verified only if the game is still unverified, then awards points for the updated game', async () => {
    const updated = verifiedGame();
    Game.findOneAndUpdate.mockResolvedValue(updated);

    const res = await request(buildTestApp()).put(`/api/games/${GAME_ID}/verify`);

    expect(res.status).toBe(200);
    expect(Game.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GAME_ID, verified: false },
      { $set: expect.objectContaining({ verified: true, verifiedAt: expect.any(Date) }) },
      { new: true }
    );
    expect(awardGamePoints).toHaveBeenCalledTimes(1);
    expect(awardGamePoints).toHaveBeenCalledWith(updated, expect.anything());
  });

  it('returns 400 and awards nothing when another request verified the game first', async () => {
    Game.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(buildTestApp()).put(`/api/games/${GAME_ID}/verify`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already verified/i);
    expect(awardGamePoints).not.toHaveBeenCalled();
    expect(updateRankedPoints).not.toHaveBeenCalled();
  });

  it('updates ranked points for a verified ranked game', async () => {
    const updated = verifiedGame({ isRanked: true });
    Game.findOneAndUpdate.mockResolvedValue(updated);

    const res = await request(buildTestApp()).put(`/api/games/${GAME_ID}/verify`);

    expect(res.status).toBe(200);
    expect(updateRankedPoints).toHaveBeenCalledWith(updated);
  });
});
