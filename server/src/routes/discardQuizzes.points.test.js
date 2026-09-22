jest.mock('../models/DiscardQuiz');
jest.mock('../models/Tile', () => ({ find: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/pointsService', () => ({
  awardQuizCompletionPoints: jest.fn(),
}));
jest.mock('../utils/weeklyStreakService', () => ({
  evaluateWeeklyStreak: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const DiscardQuiz = require('../models/DiscardQuiz');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');

const USER_ID = '507f191e810c19729de860ea';
const QUIZ_ID = 'def456quizid';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: { toString: () => USER_ID } };
    next();
  });
  app.use('/api/discard-quizzes', require('./discardQuizzes'));
  return app;
}

function mockQuiz({ hand = ['M1'] } = {}) {
  return {
    id: QUIZ_ID,
    hand,
    doraIndicator: 'P1',
    seat: 'E',
    roundWind: 'E',
    responses: new Map(),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/discard-quizzes/:id/response — points side effects', () => {
  it('awards quiz completion points and evaluates the weekly streak', async () => {
    DiscardQuiz.findOne.mockResolvedValue(mockQuiz());

    const res = await request(buildTestApp())
      .put(`/api/discard-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
    expect(awardQuizCompletionPoints).toHaveBeenCalledWith(expect.anything(), QUIZ_ID);
    expect(evaluateWeeklyStreak).toHaveBeenCalledWith(expect.anything());
  });

  it('still returns 200 when evaluating the weekly streak fails', async () => {
    DiscardQuiz.findOne.mockResolvedValue(mockQuiz());
    evaluateWeeklyStreak.mockRejectedValueOnce(new Error('db down'));

    const res = await request(buildTestApp())
      .put(`/api/discard-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
  });
});
