jest.mock('../models/User', () => ({
  PLAYER_POPULATE_FIELDS: 'displayName avatar',
}));
jest.mock('../utils/rankedLeagueService', () => ({
  getCurrentLeague: jest.fn(),
  RANKED_GAMES_THRESHOLD: 7,
}));
jest.mock('../utils/pointsService', () => ({
  awardPoints: jest.fn(),
  awardRankedQualificationPoints: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const { getCurrentLeague } = require('../utils/rankedLeagueService');
const { awardPoints, awardRankedQualificationPoints } = require('../utils/pointsService');

const USER_ID = '507f191e810c19729de860ea';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: { toString: () => USER_ID } };
    next();
  });
  app.use('/api/ranked-leagues', require('./rankedLeagues'));
  return app;
}

function makeLeague(players = []) {
  const league = {
    _id: 'league-1',
    players,
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
  };
  league.toObject = () => ({ _id: league._id, players: [...league.players] });
  return league;
}

describe('ranked league routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ranked-leagues/current', () => {
    it('includes the games threshold needed to qualify for the leaderboard', async () => {
      getCurrentLeague.mockResolvedValue(makeLeague());

      const res = await request(buildTestApp()).get('/api/ranked-leagues/current');

      expect(res.status).toBe(200);
      expect(res.body.data.league.rankedGamesThreshold).toBe(7);
    });
  });

  describe('POST /api/ranked-leagues/current/join', () => {
    it('adds the player to the league without awarding any points', async () => {
      const league = makeLeague();
      getCurrentLeague.mockResolvedValue(league);

      const res = await request(buildTestApp()).post('/api/ranked-leagues/current/join');

      expect(res.status).toBe(200);
      expect(league.players).toHaveLength(1);
      expect(league.save).toHaveBeenCalledTimes(1);
      expect(awardPoints).not.toHaveBeenCalled();
      expect(awardRankedQualificationPoints).not.toHaveBeenCalled();
    });

    it('includes the games threshold in the response', async () => {
      getCurrentLeague.mockResolvedValue(makeLeague());

      const res = await request(buildTestApp()).post('/api/ranked-leagues/current/join');

      expect(res.body.data.league.rankedGamesThreshold).toBe(7);
    });

    it('is a no-op when the player has already joined', async () => {
      const league = makeLeague([{ player: { toString: () => USER_ID }, rankedPoints: 500 }]);
      getCurrentLeague.mockResolvedValue(league);

      const res = await request(buildTestApp()).post('/api/ranked-leagues/current/join');

      expect(res.status).toBe(200);
      expect(league.players).toHaveLength(1);
      expect(league.save).not.toHaveBeenCalled();
    });
  });
});
