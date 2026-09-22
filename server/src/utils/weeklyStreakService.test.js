const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const PointTransaction = require('../models/PointTransaction');
const { evaluateWeeklyStreak, evaluateWeeklyStreakForPlayers } = require('./weeklyStreakService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
  await PointTransaction.init();
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Fixed Mondays (UTC) so tests never depend on the real current date.
const WEEK1 = new Date('2026-01-05T00:00:00.000Z');
const WEEK2 = new Date('2026-01-12T00:00:00.000Z');
const WEEK3 = new Date('2026-01-19T00:00:00.000Z');
const WEEK4 = new Date('2026-01-26T00:00:00.000Z');
const WEEK5 = new Date('2026-02-02T00:00:00.000Z');
const midWeek = (weekStart, hours = 12) => new Date(weekStart.getTime() + hours * 60 * 60 * 1000);

let user, p2, p3, p4;

async function makeVerifiedGame(playerIds, verifiedAt) {
  const players = playerIds.map((id, i) => ({ player: id, score: 40000 - i * 5000, position: i + 1 }));
  return Game.create({ submittedBy: playerIds[0], players, verified: true, verifiedAt, gameDate: verifiedAt });
}

async function makeQuizCompletion(userId, createdAt, quizId = new mongoose.Types.ObjectId().toString()) {
  await PointTransaction.collection.insertOne({
    user: userId, type: 'quiz_completed', amount: 1, metadata: { quizId }, createdAt, updatedAt: createdAt,
  });
}

async function setLastActiveAt(userId, date) {
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: date } });
}

async function qualifyWeek(userId, weekStart, { rest = [] } = {}) {
  await makeVerifiedGame([userId, ...rest.length ? rest : [p2._id, p3._id, p4._id]], midWeek(weekStart));
  await makeQuizCompletion(userId, midWeek(weekStart));
  await setLastActiveAt(userId, midWeek(weekStart));
}

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-streak/ });
  await Game.deleteMany({});
  await PointTransaction.deleteMany({});
  [user, p2, p3, p4] = await User.create([
    { displayName: 'test-streak-user', email: 'test-streak@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p2', email: 'test-streak-p2@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p3', email: 'test-streak-p3@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    { displayName: 'test-streak-p4', email: 'test-streak-p4@example.com', password: 'password123', clubAffiliation: 'Charleston' },
  ]);
});

describe('evaluateWeeklyStreak — qualification', () => {
  test('pays nothing when none of the three conditions are met', async () => {
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays nothing when only the game condition is met', async () => {
    await makeVerifiedGame([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays nothing when only the game and quiz conditions are met (no site visit)', async () => {
    await makeVerifiedGame([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));
    await makeQuizCompletion(user._id, midWeek(WEEK1));

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('pays +2 for the first qualifying week when all three conditions are met', async () => {
    await qualifyWeek(user._id, WEEK1);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(2);
    expect(tx.metadata.weekStart.toISOString()).toBe(WEEK1.toISOString());
  });

  test('does not pay a guest user even when all three conditions are met', async () => {
    const guest = await User.create({ displayName: 'test-streak-guest', isGuest: true });
    await makeVerifiedGame([guest._id, p2._id, p3._id, p4._id], midWeek(WEEK1));
    await makeQuizCompletion(guest._id, midWeek(WEEK1));
    await setLastActiveAt(guest._id, midWeek(WEEK1));

    await evaluateWeeklyStreak(guest._id, midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: guest._id, type: 'weekly_streak_bonus' })).toBe(0);
    await User.deleteOne({ _id: guest._id });
  });
});

describe('evaluateWeeklyStreak — escalation and reset', () => {
  test('escalates 2/3/4/5 across four consecutive qualifying weeks', async () => {
    const weeks = [WEEK1, WEEK2, WEEK3, WEEK4];
    const expected = [2, 3, 4, 5];

    for (let i = 0; i < weeks.length; i++) {
      await qualifyWeek(user._id, weeks[i]);
      await evaluateWeeklyStreak(user._id, midWeek(weeks[i]));
      const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': weeks[i] });
      expect(tx.amount).toBe(expected[i]);
    }
  });

  test('caps at +5 for a 5th consecutive qualifying week', async () => {
    for (const week of [WEEK1, WEEK2, WEEK3, WEEK4, WEEK5]) {
      await qualifyWeek(user._id, week);
      await evaluateWeeklyStreak(user._id, midWeek(week));
    }

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': WEEK5 });
    expect(tx.amount).toBe(5);
  });

  test('resets to +2 after a missed week', async () => {
    await qualifyWeek(user._id, WEEK1);
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));
    // WEEK2 intentionally left unqualified (missed week)
    await qualifyWeek(user._id, WEEK3);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK3));

    const tx = await PointTransaction.findOne({ user: user._id, type: 'weekly_streak_bonus', 'metadata.weekStart': WEEK3 });
    expect(tx.amount).toBe(2);
  });
});

describe('evaluateWeeklyStreak — idempotency', () => {
  test('evaluating the same week twice pays only once', async () => {
    await qualifyWeek(user._id, WEEK1);

    await evaluateWeeklyStreak(user._id, midWeek(WEEK1));
    await evaluateWeeklyStreak(user._id, midWeek(WEEK1, 18)); // simulates the quiz-path trigger firing later the same day

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(2);
  });
});

describe('evaluateWeeklyStreakForPlayers', () => {
  test('evaluates every player and pays each independently', async () => {
    await qualifyWeek(user._id, WEEK1, { rest: [p2._id, p3._id, p4._id] });
    await makeQuizCompletion(p2._id, midWeek(WEEK1));
    await setLastActiveAt(p2._id, midWeek(WEEK1));
    // p3 and p4 only have the game condition (no quiz/visit) — should not qualify

    await evaluateWeeklyStreakForPlayers([user._id, p2._id, p3._id, p4._id], midWeek(WEEK1));

    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
    expect(await PointTransaction.countDocuments({ user: p2._id, type: 'weekly_streak_bonus' })).toBe(1);
    expect(await PointTransaction.countDocuments({ user: p3._id, type: 'weekly_streak_bonus' })).toBe(0);
    expect(await PointTransaction.countDocuments({ user: p4._id, type: 'weekly_streak_bonus' })).toBe(0);
  });

  test('one player failing does not stop the others, and the aggregate error lists it', async () => {
    await qualifyWeek(user._id, WEEK1);
    const findByIdSpy = jest.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === p2._id.toString()) {
        throw new Error('db down');
      }
      return User.findOne({ _id: id });
    });

    const error = await evaluateWeeklyStreakForPlayers([user._id, p2._id], midWeek(WEEK1)).catch(err => err);

    findByIdSpy.mockRestore();
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toHaveLength(1);
    expect(await PointTransaction.countDocuments({ user: user._id, type: 'weekly_streak_bonus' })).toBe(1);
  });
});
