const mongoose = require('mongoose');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { awardPoints, spendPoints, awardGamePoints } = require('./pointsService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

let user;

beforeEach(async () => {
  await PointTransaction.deleteMany({});
  await User.deleteMany({ displayName: /^test-points/ });
  user = await User.create({
    displayName: 'test-points-user',
    email: 'test-points@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

describe('awardPoints', () => {
  test('creates a PointTransaction document', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx).not.toBeNull();
    expect(tx.type).toBe('game_played');
    expect(tx.amount).toBe(5);
  });

  test('increments pointsBalance on the user', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(5);
  });

  test('increments totalPointsEarned on the user', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const updated = await User.findById(user._id);
    expect(updated.totalPointsEarned).toBe(5);
  });

  test('stores optional metadata', async () => {
    const gameId = new mongoose.Types.ObjectId();
    await awardPoints(user._id, 'game_submitted', 10, { gameId });

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx.metadata.gameId.toString()).toBe(gameId.toString());
  });

  test('accumulates across multiple awards', async () => {
    await awardPoints(user._id, 'game_played', 5, {});
    await awardPoints(user._id, 'game_submitted', 10, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(15);
    expect(updated.totalPointsEarned).toBe(15);
  });
});

describe('spendPoints', () => {
  test('decrements pointsBalance only (not totalPointsEarned)', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 50, totalPointsEarned: 50 });

    await spendPoints(user._id, 20, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(30);
    expect(updated.totalPointsEarned).toBe(50);
  });

  test('creates a negative PointTransaction', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 50, totalPointsEarned: 50 });

    await spendPoints(user._id, 20, {});

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx.type).toBe('shop_purchase');
    expect(tx.amount).toBe(-20);
  });

  test('throws when balance is insufficient', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });

    await expect(spendPoints(user._id, 20, {})).rejects.toThrow('Insufficient points balance');
  });
});

describe('awardGamePoints', () => {
  let p1, p2, p3, p4;

  beforeEach(async () => {
    [p1, p2, p3, p4] = await User.create([
      { displayName: 'test-points-p1', email: 'p1@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p2', email: 'p2@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p3', email: 'p3@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p4', email: 'p4@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    ]);
  });

  test('awards correct placement type and amount to each player', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const cases = [
      { user: p1._id, type: 'game_placement_1', amount: 8 },
      { user: p2._id, type: 'game_placement_2', amount: 5 },
      { user: p3._id, type: 'game_placement_3', amount: 3 },
      { user: p4._id, type: 'game_placement_4', amount: 1 },
    ];

    for (const { user, type, amount } of cases) {
      const tx = await PointTransaction.findOne({ user, type });
      expect(tx).not.toBeNull();
      expect(tx.amount).toBe(amount);
    }
  });

  test('awards game_submitted (+5) to the submitter', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p1._id, type: 'game_submitted' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(5);
  });

  test('awards game_verified (+2) to the verifier', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p2._id, type: 'game_verified' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(2);
  });

  test('submitter who finishes 1st gets game_placement_1 and game_submitted (total 13)', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const updated = await User.findById(p1._id);
    expect(updated.pointsBalance).toBe(13); // 8 (placement_1) + 5 (submitted)
  });
});
