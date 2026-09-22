jest.mock('../models/DecisionQuiz');
jest.mock('../models/Tile', () => ({ find: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/pointsService', () => ({
  awardQuizCompletionPoints: jest.fn(),
}));
jest.mock('../utils/weeklyStreakService', () => ({
  evaluateWeeklyStreak: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const DecisionQuiz = require('../models/DecisionQuiz');
const { awardQuizCompletionPoints } = require('../utils/pointsService');
const { evaluateWeeklyStreak } = require('../utils/weeklyStreakService');

const USER_ID = '507f191e810c19729de860ea';
const QUIZ_ID = 'abc123quizid';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: { toString: () => USER_ID } };
    next();
  });
  app.use('/api/decision-quizzes', require('./decisionQuizzes'));
  return app;
}

function mockQuiz({ responses = new Map(), hand = ['M1'] } = {}) {
  return {
    id: QUIZ_ID,
    players: [{ isUser: true, hand, discard: [], melds: [] }],
    doraIndicators: [],
    responses,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/decision-quizzes/:id/response — points side effects', () => {
  it('awards quiz completion points and evaluates the weekly streak on a first response', async () => {
    DecisionQuiz.findOne.mockResolvedValue(mockQuiz());

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
    expect(awardQuizCompletionPoints).toHaveBeenCalledWith(expect.anything(), QUIZ_ID);
    expect(evaluateWeeklyStreak).toHaveBeenCalledWith(expect.anything());
  });

  it('does not award points when the user already responded', async () => {
    const alreadyResponded = mockQuiz({
      responses: new Map([['M1', [{ toString: () => USER_ID }]]]),
    });
    DecisionQuiz.findOne.mockResolvedValue(alreadyResponded);

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(400);
    expect(awardQuizCompletionPoints).not.toHaveBeenCalled();
    expect(evaluateWeeklyStreak).not.toHaveBeenCalled();
  });

  it('still returns 200 when awarding points fails', async () => {
    DecisionQuiz.findOne.mockResolvedValue(mockQuiz());
    awardQuizCompletionPoints.mockRejectedValueOnce(new Error('db down'));

    const res = await request(buildTestApp())
      .put(`/api/decision-quizzes/${QUIZ_ID}/response`)
      .send({ tileId: 'M1' });

    expect(res.status).toBe(200);
  });
});
