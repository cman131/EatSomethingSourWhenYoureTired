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
  reverseRankedPoints: jest.fn(),
}));
jest.mock('../utils/pointsService', () => ({
  awardGamePoints: jest.fn(),
  reverseGamePoints: jest.fn(),
  undoGamePoints: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const { awardGamePoints, reverseGamePoints, undoGamePoints } = require('../utils/pointsService');
const { updateRankedPoints, reverseRankedPoints } = require('../utils/rankedLeagueService');

const GAME_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f191e810c19729de860ea';

function buildTestApp({ userId = USER_ID, isAdmin = true } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      _id: { toString: () => userId },
      isAdmin,
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

describe('DELETE /api/games/:id — verified-game policy and points reversal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Tournament.find.mockResolvedValue([]);
    reverseGamePoints.mockResolvedValue(undefined);
    reverseRankedPoints.mockResolvedValue(undefined);
  });

  it('forbids a submitter (non-admin) from deleting their own verified game', async () => {
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => USER_ID },
      verified: true,
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    Game.findById.mockResolvedValue(game);

    const app = buildTestApp({ isAdmin: false });
    const res = await request(app).delete(`/api/games/${GAME_ID}`);

    expect(res.status).toBe(403);
    expect(reverseGamePoints).not.toHaveBeenCalled();
    expect(reverseRankedPoints).not.toHaveBeenCalled();
    expect(game.deleteOne).not.toHaveBeenCalled();
  });

  it('allows a submitter (non-admin) to delete their own unverified game', async () => {
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => USER_ID },
      verified: false,
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    Game.findById.mockResolvedValue(game);

    const app = buildTestApp({ isAdmin: false });
    const res = await request(app).delete(`/api/games/${GAME_ID}`);

    expect(res.status).toBe(200);
    expect(reverseGamePoints).not.toHaveBeenCalled();
    expect(reverseRankedPoints).not.toHaveBeenCalled();
    expect(game.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('reverses points and ranked points before deleting a verified game as an admin', async () => {
    const gameId = { toString: () => GAME_ID };
    const game = {
      _id: gameId,
      submittedBy: { toString: () => 'someone-else' },
      verified: true,
      isRanked: true,
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    Game.findById.mockResolvedValue(game);

    const app = buildTestApp({ isAdmin: true });
    const res = await request(app).delete(`/api/games/${GAME_ID}`);

    expect(res.status).toBe(200);
    expect(reverseGamePoints).toHaveBeenCalledWith(gameId);
    expect(reverseRankedPoints).toHaveBeenCalledWith(game);
    expect(game.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('does not attempt to reverse points when deleting an unverified game', async () => {
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => 'someone-else' },
      verified: false,
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    Game.findById.mockResolvedValue(game);

    const app = buildTestApp({ isAdmin: true });
    const res = await request(app).delete(`/api/games/${GAME_ID}`);

    expect(res.status).toBe(200);
    expect(reverseGamePoints).not.toHaveBeenCalled();
    expect(reverseRankedPoints).not.toHaveBeenCalled();
  });

  it('still deletes the game even if reversing its points fails', async () => {
    const game = {
      _id: { toString: () => GAME_ID },
      submittedBy: { toString: () => 'someone-else' },
      verified: true,
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    Game.findById.mockResolvedValue(game);
    reverseGamePoints.mockRejectedValue(new Error('db down'));

    const app = buildTestApp({ isAdmin: true });
    const res = await request(app).delete(`/api/games/${GAME_ID}`);

    expect(res.status).toBe(200);
    expect(game.deleteOne).toHaveBeenCalledTimes(1);
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

describe('PATCH /api/games/:id — admin edit reconciles points for a verified game', () => {
  const PLAYER_IDS = ['p1', 'p2', 'p3', 'p4'];
  const VERIFIER_ID = { toString: () => 'verifier-id' };

  function makePlayers() {
    return PLAYER_IDS.map((id, index) => ({
      player: { toString: () => id },
      score: 25000,
      position: index + 1,
    }));
  }

  function makeGame({ verified = true, isRanked = false } = {}) {
    return {
      _id: { toString: () => GAME_ID },
      players: makePlayers(),
      verified,
      verifiedBy: VERIFIER_ID,
      isRanked,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      populate: jest.fn().mockResolvedValue(undefined),
    };
  }

  function validBody() {
    return {
      players: PLAYER_IDS.map((id, index) => ({ player: id, score: 25000 + index, position: index + 1 })),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    undoGamePoints.mockResolvedValue(undefined);
    reverseRankedPoints.mockResolvedValue(undefined);
    awardGamePoints.mockResolvedValue(undefined);
    updateRankedPoints.mockResolvedValue(undefined);
  });

  it('undoes the old points and ranked delta before saving, then reapplies after', async () => {
    const game = makeGame({ verified: true, isRanked: true });
    Game.findById.mockResolvedValue(game);

    const res = await request(buildTestApp()).patch(`/api/games/${GAME_ID}`).send(validBody());

    expect(res.status).toBe(200);
    expect(undoGamePoints).toHaveBeenCalledWith(game._id);
    expect(reverseRankedPoints).toHaveBeenCalledWith(game);
    expect(awardGamePoints).toHaveBeenCalledWith(game, game.verifiedBy);
    expect(updateRankedPoints).toHaveBeenCalledWith(game);

    // reversal must happen before the score/position rewrite is saved
    expect(undoGamePoints.mock.invocationCallOrder[0]).toBeLessThan(game.save.mock.invocationCallOrder[0]);
    expect(reverseRankedPoints.mock.invocationCallOrder[0]).toBeLessThan(game.save.mock.invocationCallOrder[0]);
    // reapplication must happen after the save
    expect(awardGamePoints.mock.invocationCallOrder[0]).toBeGreaterThan(game.save.mock.invocationCallOrder[0]);
    expect(updateRankedPoints.mock.invocationCallOrder[0]).toBeGreaterThan(game.save.mock.invocationCallOrder[0]);
  });

  it('does not touch points for an unverified game', async () => {
    const game = makeGame({ verified: false });
    Game.findById.mockResolvedValue(game);

    const res = await request(buildTestApp()).patch(`/api/games/${GAME_ID}`).send(validBody());

    expect(res.status).toBe(200);
    expect(undoGamePoints).not.toHaveBeenCalled();
    expect(reverseRankedPoints).not.toHaveBeenCalled();
    expect(awardGamePoints).not.toHaveBeenCalled();
    expect(updateRankedPoints).not.toHaveBeenCalled();
  });

  it('does not reapply ranked points for a non-ranked verified game', async () => {
    const game = makeGame({ verified: true, isRanked: false });
    Game.findById.mockResolvedValue(game);

    const res = await request(buildTestApp()).patch(`/api/games/${GAME_ID}`).send(validBody());

    expect(res.status).toBe(200);
    expect(awardGamePoints).toHaveBeenCalledWith(game, game.verifiedBy);
    expect(updateRankedPoints).not.toHaveBeenCalled();
    // the ranked delta is still reversed unconditionally; reverseRankedPoints itself no-ops for an unranked game
    expect(reverseRankedPoints).toHaveBeenCalledWith(game);
  });

  it('still saves the new scores even if undoing the old points fails', async () => {
    const game = makeGame({ verified: true });
    Game.findById.mockResolvedValue(game);
    undoGamePoints.mockRejectedValue(new Error('db down'));

    const res = await request(buildTestApp()).patch(`/api/games/${GAME_ID}`).send(validBody());

    expect(res.status).toBe(200);
    expect(game.save).toHaveBeenCalledTimes(1);
    expect(awardGamePoints).toHaveBeenCalledWith(game, game.verifiedBy);
  });
});
