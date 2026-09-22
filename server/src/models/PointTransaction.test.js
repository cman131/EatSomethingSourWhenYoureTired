const mongoose = require('mongoose');
const User = require('./User');
const PointTransaction = require('./PointTransaction');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
  await PointTransaction.init(); // new unique partial indexes must exist before the dedupe tests run
});

afterAll(async () => {
  await mongoose.connection.close();
});

let user;

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-pt-model/ });
  user = await User.create({
    displayName: 'test-pt-model-user',
    email: 'test-pt-model@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

afterEach(async () => {
  await PointTransaction.deleteMany({ user: user._id });
});

describe('quiz_completed transactions', () => {
  test('accepts the type with a metadata.quizId string', async () => {
    const tx = await PointTransaction.create({
      user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'abc123' },
    });
    expect(tx.metadata.quizId).toBe('abc123');
  });

  test('rejects a second transaction for the same user, type and quizId', async () => {
    await PointTransaction.create({
      user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'dup-quiz' },
    });

    await expect(
      PointTransaction.create({
        user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'dup-quiz' },
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows the same quizId for a different user', async () => {
    const other = await User.create({
      displayName: 'test-pt-model-other', email: 'test-pt-model-other@example.com',
      password: 'password123', clubAffiliation: 'Charleston',
    });

    await PointTransaction.create({ user: user._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'shared-quiz' } });
    await expect(
      PointTransaction.create({ user: other._id, type: 'quiz_completed', amount: 1, metadata: { quizId: 'shared-quiz' } })
    ).resolves.toBeTruthy();

    await User.deleteOne({ _id: other._id });
    await PointTransaction.deleteMany({ user: other._id });
  });
});

describe('weekly_streak_bonus transactions', () => {
  const weekStart = new Date('2026-01-05T00:00:00.000Z');

  test('accepts the type with a metadata.weekStart date', async () => {
    const tx = await PointTransaction.create({
      user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart },
    });
    expect(tx.metadata.weekStart.toISOString()).toBe(weekStart.toISOString());
  });

  test('rejects a second transaction for the same user, type and weekStart', async () => {
    await PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart } });

    await expect(
      PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 3, metadata: { weekStart } })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows a different weekStart for the same user', async () => {
    const nextWeek = new Date('2026-01-12T00:00:00.000Z');
    await PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 2, metadata: { weekStart } });

    await expect(
      PointTransaction.create({ user: user._id, type: 'weekly_streak_bonus', amount: 3, metadata: { weekStart: nextWeek } })
    ).resolves.toBeTruthy();
  });
});
