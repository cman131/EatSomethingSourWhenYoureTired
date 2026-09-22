const mongoose = require('mongoose');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Game = require('../models/Game');
const {
  awardPoints,
  getRecentEarnings,
  spendPoints,
  adjustPoints,
  AdjustmentFailure,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
} = require('./pointsService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
  await PointTransaction.init(); // the once-only awards rely on the unique partial indexes existing
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.connection.close();
});

let user;

beforeEach(async () => {
  // Scoped to this suite's users: Jest runs suites in parallel against the same database
  const staleUsers = await User.find({ displayName: /^test-points/ }).select('_id');
  await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
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

  test('does not award points to guest users', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });

    await awardPoints(guest._id, 'game_placement_1', 10, {});

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
    const updated = await User.findById(guest._id);
    expect(updated.pointsBalance).toBe(0);
    expect(updated.totalPointsEarned).toBe(0);
  });

  test('removes the ledger row and rethrows when the balance update fails', async () => {
    jest.spyOn(User, 'updateOne').mockRejectedValueOnce(new Error('balance write failed'));

    await expect(awardPoints(user._id, 'game_submitted', 5, {})).rejects.toThrow('balance write failed');

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(0);
    expect((await User.findById(user._id)).pointsBalance).toBe(0);
  });

  test('rethrows the balance error even when removing the ledger row also fails', async () => {
    jest.spyOn(User, 'updateOne').mockRejectedValueOnce(new Error('balance write failed'));
    jest.spyOn(PointTransaction, 'deleteOne').mockRejectedValueOnce(new Error('cleanup failed'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(awardPoints(user._id, 'game_submitted', 5, {})).rejects.toThrow('balance write failed');
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

describe('adjustPoints', () => {
  let admin;

  beforeEach(async () => {
    admin = await User.create({
      displayName: 'test-points-admin',
      email: 'test-points-admin@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
      isAdmin: true,
    });
  });

  test('increments pointsBalance for a positive adjustment', async () => {
    const result = await adjustPoints({ userId: user._id, amount: 25, adjustedBy: admin._id, reason: 'missed award' });

    expect(result).toEqual({ adjusted: true });
    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(25);
  });

  test('does not change totalPointsEarned for a positive adjustment', async () => {
    await adjustPoints({ userId: user._id, amount: 25, adjustedBy: admin._id, reason: 'missed award' });

    const updated = await User.findById(user._id);
    expect(updated.totalPointsEarned).toBe(0);
  });

  test('decrements pointsBalance for a negative adjustment', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 50, totalPointsEarned: 50 });

    const result = await adjustPoints({ userId: user._id, amount: -20, adjustedBy: admin._id, reason: 'correcting overpay' });

    expect(result).toEqual({ adjusted: true });
    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(30);
    expect(updated.totalPointsEarned).toBe(50);
  });

  test('creates an admin_adjustment ledger row with adjustedBy and reason', async () => {
    await adjustPoints({ userId: user._id, amount: 25, adjustedBy: admin._id, reason: 'missed award' });

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx.type).toBe('admin_adjustment');
    expect(tx.amount).toBe(25);
    expect(tx.metadata.adjustedBy.toString()).toBe(admin._id.toString());
    expect(tx.metadata.reason).toBe('missed award');
  });

  test('rejects a negative adjustment that would drop the balance below zero', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });

    const result = await adjustPoints({ userId: user._id, amount: -20, adjustedBy: admin._id, reason: 'penalty' });

    expect(result).toEqual({ adjusted: false, reason: AdjustmentFailure.InsufficientBalance });
    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(10);
    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(0);
  });

  test('reports user not found without writing a ledger row', async () => {
    const missingUserId = new mongoose.Types.ObjectId();

    const result = await adjustPoints({ userId: missingUserId, amount: 10, adjustedBy: admin._id, reason: 'test' });

    expect(result).toEqual({ adjusted: false, reason: AdjustmentFailure.UserNotFound });
    expect(await PointTransaction.countDocuments({ user: missingUserId })).toBe(0);
  });
});

describe('getRecentEarnings', () => {
  const HOUR = 60 * 60 * 1000;
  const seed = (type, amount, ageMs) =>
    PointTransaction.create({ user: user._id, type, amount, createdAt: new Date(Date.now() - ageMs) });
  const cutoff24h = () => new Date(Date.now() - 24 * HOUR);

  test('sums the given types since the cutoff', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('game_submitted', 2, 2 * HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1', 'game_submitted'], cutoff24h());

    expect(total).toBe(12);
  });

  test('ignores types that were not asked for', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('tournament_participated', 15, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h());

    expect(total).toBe(10);
  });

  test('ignores rows older than the cutoff', async () => {
    await seed('game_placement_1', 10, 25 * HOUR);
    await seed('game_placement_1', 4, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h());

    expect(total).toBe(4);
  });

  test('ignores negative (spend) rows', async () => {
    await seed('game_placement_1', 10, HOUR);
    await seed('shop_purchase', -20, HOUR);

    const total = await getRecentEarnings(user._id, ['game_placement_1', 'shop_purchase'], cutoff24h());

    expect(total).toBe(10);
  });

  test('returns 0 when the user has no matching rows', async () => {
    expect(await getRecentEarnings(user._id, ['game_placement_1'], cutoff24h())).toBe(0);
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
      { user: p1._id, type: 'game_placement_1', amount: 10 },
      { user: p2._id, type: 'game_placement_2', amount: 7 },
      { user: p3._id, type: 'game_placement_3', amount: 4 },
      { user: p4._id, type: 'game_placement_4', amount: 2 },
    ];

    for (const { user, type, amount } of cases) {
      const tx = await PointTransaction.findOne({ user, type });
      expect(tx).not.toBeNull();
      expect(tx.amount).toBe(amount);
    }
  });

  test('awards game_submitted (+2) to the submitter after rebalance', async () => {
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
    expect(tx.amount).toBe(2);
  });

  test('awards game_verified (+1) to the verifier after rebalance', async () => {
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
    expect(tx.amount).toBe(1);
  });

  test('submitter who finishes 1st gets game_placement_1 and game_submitted (total 12)', async () => {
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
    expect(updated.pointsBalance).toBe(12); // 10 (placement_1) + 2 (submitted)
  });

  test('does not award placement points to guest players', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: guest._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p3._id);

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
    expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_placement_1' })).toBe(1);
  });

  test('resolves guests with a single query for the whole game', async () => {
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
    const findSpy = jest.spyOn(User, 'find');
    const findByIdSpy = jest.spyOn(User, 'findById');

    await awardGamePoints(game, p2._id);

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(await PointTransaction.countDocuments({ user: { $in: [p1._id, p2._id, p3._id, p4._id] } })).toBe(6);
  });

  describe('idempotency and failure isolation', () => {
    function makeGame(overrides = {}) {
      return {
        _id: new mongoose.Types.ObjectId(),
        players: [
          { player: p1._id, rank: 1 },
          { player: p2._id, rank: 2 },
          { player: p3._id, rank: 3 },
          { player: p4._id, rank: 4 },
        ],
        submittedBy: p1._id,
        ...overrides,
      };
    }

    const playerIds = () => [p1, p2, p3, p4].map(p => p._id);
    const balanceOf = async u => (await User.findById(u._id)).pointsBalance;

    test('replaying the same game pays each player only once', async () => {
      const game = makeGame();

      await awardGamePoints(game, p2._id);
      await awardGamePoints(game, p2._id);

      expect(await balanceOf(p1)).toBe(12); // 10 placement + 2 submitted
      expect(await balanceOf(p2)).toBe(8); // 7 placement + 1 verified
      expect(await balanceOf(p3)).toBe(4);
      expect(await balanceOf(p4)).toBe(2);
      expect(await PointTransaction.countDocuments({ user: { $in: playerIds() } })).toBe(6);
    });

    test('a second game still pays the same players', async () => {
      await awardGamePoints(makeGame(), p2._id);
      await awardGamePoints(makeGame(), p2._id);

      expect(await balanceOf(p3)).toBe(8);
    });

    test('one failed placement award does not stop the remaining awards', async () => {
      const game = makeGame();
      const realCreate = PointTransaction.create.bind(PointTransaction);
      const createSpy = jest.spyOn(PointTransaction, 'create').mockImplementation(async doc => {
        if (doc.user.toString() === p2._id.toString() && doc.type === 'game_placement_2') {
          throw new Error('db down');
        }
        return realCreate(doc);
      });

      await expect(awardGamePoints(game, p3._id)).rejects.toThrow(/1 of 6/);
      createSpy.mockRestore();

      expect(await balanceOf(p1)).toBe(12); // placement and submitted both paid
      expect(await balanceOf(p3)).toBe(5); // placement and verified both paid
      expect(await balanceOf(p4)).toBe(2);
      expect(await balanceOf(p2)).toBe(0);
    });

    test('the error lists each failed award', async () => {
      const createSpy = jest.spyOn(PointTransaction, 'create').mockRejectedValue(new Error('db down'));

      const error = await awardGamePoints(makeGame(), p2._id).catch(err => err);
      createSpy.mockRestore();

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.errors).toHaveLength(6);
    });

    test('retrying after a failure completes only the missing awards', async () => {
      const game = makeGame();
      const realCreate = PointTransaction.create.bind(PointTransaction);
      const createSpy = jest.spyOn(PointTransaction, 'create').mockImplementation(async doc => {
        if (doc.user.toString() === p2._id.toString() && doc.type === 'game_placement_2') {
          throw new Error('db down');
        }
        return realCreate(doc);
      });
      await awardGamePoints(game, p3._id).catch(() => {});
      createSpy.mockRestore();

      await awardGamePoints(game, p3._id);

      expect(await balanceOf(p1)).toBe(12);
      expect(await balanceOf(p2)).toBe(7);
      expect(await balanceOf(p3)).toBe(5);
      expect(await balanceOf(p4)).toBe(2);
    });

    test('skips the verifier award when the game has no verifier', async () => {
      await awardGamePoints(makeGame(), undefined);

      expect(await PointTransaction.countDocuments({ type: 'game_verified', user: { $in: playerIds() } })).toBe(0);
      expect(await balanceOf(p1)).toBe(12);
    });

    test('stamps pointsAwardedAt on the game once every award has succeeded', async () => {
      const game = await Game.create({
        submittedBy: p1._id,
        players: [p1, p2, p3, p4].map((p, i) => ({ player: p._id, score: 40000 - i * 5000, position: i + 1 })),
      });

      await awardGamePoints(game, p2._id);

      expect((await Game.findById(game._id)).pointsAwardedAt).toBeInstanceOf(Date);
      await Game.deleteOne({ _id: game._id });
    });

    test('leaves pointsAwardedAt unset when an award fails', async () => {
      const game = await Game.create({
        submittedBy: p1._id,
        players: [p1, p2, p3, p4].map((p, i) => ({ player: p._id, score: 40000 - i * 5000, position: i + 1 })),
      });
      const createSpy = jest.spyOn(PointTransaction, 'create').mockRejectedValueOnce(new Error('db down'));

      await awardGamePoints(game, p2._id).catch(() => {});
      createSpy.mockRestore();

      expect((await Game.findById(game._id)).pointsAwardedAt).toBeUndefined();
      await Game.deleteOne({ _id: game._id });
    });
  });

  describe('player membership requirement', () => {
    const makeOutsider = name =>
      User.create({
        displayName: `test-points-${name}`,
        email: `${name}@example.com`,
        password: 'password123',
        clubAffiliation: 'Charleston',
      });

    test('does not award game_submitted when the submitter is not one of the players', async () => {
      const outsider = await makeOutsider('outsider1');
      const game = {
        _id: new mongoose.Types.ObjectId(),
        players: [
          { player: p1._id, rank: 1 },
          { player: p2._id, rank: 2 },
          { player: p3._id, rank: 3 },
          { player: p4._id, rank: 4 },
        ],
        submittedBy: outsider._id,
      };

      await awardGamePoints(game, p2._id);

      expect(await PointTransaction.countDocuments({ user: outsider._id })).toBe(0);
      expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_placement_1' })).toBe(1);
      expect(await PointTransaction.countDocuments({ user: p2._id, type: 'game_verified' })).toBe(1);
    });

    test('does not award game_verified when the verifier is not one of the players (e.g. an admin)', async () => {
      const admin = await makeOutsider('admin1');
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

      await awardGamePoints(game, admin._id);

      expect(await PointTransaction.countDocuments({ user: admin._id })).toBe(0);
      expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_submitted' })).toBe(1);
    });

    test('awards neither submitted nor verified points when both are outside the game', async () => {
      const outsider = await makeOutsider('outsider2');
      const admin = await makeOutsider('admin2');
      const game = {
        _id: new mongoose.Types.ObjectId(),
        players: [
          { player: p1._id, rank: 1 },
          { player: p2._id, rank: 2 },
          { player: p3._id, rank: 3 },
          { player: p4._id, rank: 4 },
        ],
        submittedBy: outsider._id,
      };

      await awardGamePoints(game, admin._id);

      expect(await PointTransaction.countDocuments({ user: outsider._id })).toBe(0);
      expect(await PointTransaction.countDocuments({ user: admin._id })).toBe(0);
      // placements are unaffected
      expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_placement_1' })).toBe(1);
    });
  });

  describe('caps', () => {
    const HOUR = 60 * 60 * 1000;

    const newGame = (users, submitter) => ({
      _id: new mongoose.Types.ObjectId(),
      players: users.map((u, i) => ({ player: u._id, rank: i + 1 })),
      submittedBy: submitter._id,
    });
    const seedEarning = (target, amount, ageMs, type = 'game_placement_1') =>
      PointTransaction.create({
        user: target._id,
        type,
        amount,
        createdAt: new Date(Date.now() - ageMs),
      });
    const gameRowsFor = (target, game) =>
      PointTransaction.find({ user: target._id, 'metadata.gameId': game._id });
    const balanceOf = async target => (await User.findById(target._id)).pointsBalance;

    let warnSpy;
    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    describe('daily cap', () => {
      test('pays in full when the awards land exactly on the cap', async () => {
        await seedEarning(p1, 48, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const rows = await gameRowsFor(p1, game);
        expect(rows.map(r => r.amount).sort((a, b) => a - b)).toEqual([2, 10]); // placement_1 + submitted
        expect(warnSpy).not.toHaveBeenCalled();
      });

      test('truncates an award that would exceed the cap to the remaining headroom', async () => {
        await seedEarning(p1, 55, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const placement = await PointTransaction.findOne({
          user: p1._id,
          type: 'game_placement_1',
          'metadata.gameId': game._id,
        });
        expect(placement.amount).toBe(5);
        expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_submitted' })).toBe(0);
        expect(await balanceOf(p1)).toBe(5);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({
            userId: p1._id,
            gameId: game._id,
            type: 'game_placement_1',
            requested: 10,
            granted: 5,
            reason: 'daily_cap',
          })
        );
      });

      test('pays nothing and writes no row once the cap is reached', async () => {
        await seedEarning(p1, 60, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(0);
        expect(await balanceOf(p1)).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({ userId: p1._id, granted: 0, reason: 'daily_cap' })
        );
      });

      test('does not count earnings older than 24 hours', async () => {
        await seedEarning(p1, 60, 25 * HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await balanceOf(p1)).toBe(12); // 10 placement + 2 submitted, uncapped
      });

      test("does not let one player's earnings limit another player", async () => {
        await seedEarning(p1, 60, HOUR);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p3._id);

        expect(await balanceOf(p2)).toBe(7);
      });

      test('still pays tournament awards to a player who is at the game cap', async () => {
        await seedEarning(p1, 60, HOUR);
        const tournament = {
          _id: new mongoose.Types.ObjectId(),
          players: [{ player: p1._id, dropped: false }],
          top4: [p1._id],
        };

        await awardTournamentPoints(tournament);

        expect(await balanceOf(p1)).toBe(215); // 15 participation + 200 for 1st
      });

      test('counts game_submitted and game_verified earnings toward the cap', async () => {
        await seedEarning(p1, 30, HOUR, 'game_submitted');
        await seedEarning(p1, 30, HOUR, 'game_verified');
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(0);
      });

      test('does not count non-game earnings toward the cap', async () => {
        await seedEarning(p1, 200, HOUR, 'tournament_placement_1');
        await seedEarning(p1, 10, HOUR, 'ranked_league_qualified');
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await balanceOf(p1)).toBe(12); // 10 placement + 2 submitted, uncapped
      });
    });

    describe('repeat group', () => {
      const DAY = 24 * HOUR;

      // Plays a real game, then backdates its ledger rows. Uses the native driver because
      // Mongoose treats createdAt as immutable and would silently drop the update.
      const playAndAge = async (users, ageMs) => {
        const game = newGame(users, users[0]);
        await awardGamePoints(game, users[1]._id);
        await PointTransaction.collection.updateMany(
          { 'metadata.gameId': game._id },
          { $set: { createdAt: new Date(Date.now() - ageMs) } }
        );
      };
      const playAndAgeMany = async (count, users, ageMs) => {
        for (let i = 0; i < count; i += 1) {
          await playAndAge(users, ageMs);
        }
      };
      const makeUser = (name, extra = {}) =>
        User.create({
          displayName: `test-points-${name}`,
          email: `${name}@example.com`,
          password: 'password123',
          clubAffiliation: 'Charleston',
          ...extra,
        });
      const makeGuests = names =>
        User.create(names.map(name => ({ displayName: `test-points-${name}`, isGuest: true })));

      test('skips the game once the same group has 6 point-earning games in 7 days', async () => {
        await playAndAgeMany(6, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await PointTransaction.countDocuments({ 'metadata.gameId': game._id })).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith(
          'Points award capped',
          expect.objectContaining({ gameId: game._id, reason: 'repeat_group' })
        );
      });

      test('still pays the 6th game for the group', async () => {
        await playAndAgeMany(5, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2); // placement_1 + submitted
      });

      test('does not count games older than 7 days', async () => {
        await playAndAgeMany(6, [p1, p2, p3, p4], 8 * DAY);
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2);
      });

      test('treats a different set of registered players as a separate group', async () => {
        const p5 = await makeUser('p5');
        await playAndAgeMany(6, [p1, p2, p3, p4], 2 * DAY);
        const game = newGame([p1, p2, p3, p5], p1);

        await awardGamePoints(game, p2._id);

        expect(await gameRowsFor(p1, game)).toHaveLength(2);
      });

      test('ignores guests when identifying the group', async () => {
        const [g1, g2, g3, g4] = await makeGuests(['g1', 'g2', 'g3', 'g4']);
        await playAndAgeMany(6, [p1, p2, g1, g2], 2 * DAY);
        const game = newGame([p1, p2, g3, g4], p1);

        await awardGamePoints(game, p2._id);

        expect(await PointTransaction.countDocuments({ 'metadata.gameId': game._id })).toBe(0);
      });

      test('does not apply to games with fewer than 2 registered players', async () => {
        const [g1, g2, g3] = await makeGuests(['g1', 'g2', 'g3']);
        await playAndAgeMany(6, [p1, g1, g2, g3], 2 * DAY);
        const game = newGame([p1, g1, g2, g3], p1);

        await awardGamePoints(game, p2._id);

        const rows = await gameRowsFor(p1, game);
        expect(rows).toHaveLength(2);
        expect(rows.every(r => r.metadata.groupKey === null)).toBe(true);
      });

      test('stores the same group key on every award row of a game', async () => {
        const game = newGame([p1, p2, p3, p4], p1);

        await awardGamePoints(game, p2._id);

        const rows = await PointTransaction.find({ 'metadata.gameId': game._id });
        expect(rows).toHaveLength(6); // 4 placements + submitted + verified
        const expectedKey = [p1, p2, p3, p4].map(u => u._id.toString()).sort().join(':');
        expect(new Set(rows.map(r => r.metadata.groupKey))).toEqual(new Set([expectedKey]));
      });
    });
  });
});

describe('awardTournamentPoints', () => {
  let players;

  beforeEach(async () => {
    players = await User.create([1, 2, 3, 4, 5].map(n => ({
      displayName: `test-points-t${n}`,
      email: `t${n}@example.com`,
      password: 'password123',
      clubAffiliation: 'Charleston',
    })));
  });

  function makeTournament({ dropped = [], top4 = players.slice(0, 4) } = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      players: players.map(p => ({ player: p._id, dropped: dropped.includes(p) })),
      top4: top4.map(p => p._id),
    };
  }

  const balanceOf = async user => (await User.findById(user._id)).pointsBalance;

  test('awards 200/100/70/50 for 1st-4th plus 15 participation', async () => {
    await awardTournamentPoints(makeTournament());

    expect(await balanceOf(players[0])).toBe(215);
    expect(await balanceOf(players[1])).toBe(115);
    expect(await balanceOf(players[2])).toBe(85);
    expect(await balanceOf(players[3])).toBe(65);
    expect(await balanceOf(players[4])).toBe(15);
  });

  test('records the placement type and tournament id on each placement transaction', async () => {
    const tournament = makeTournament();

    await awardTournamentPoints(tournament);

    const tx = await PointTransaction.findOne({ user: players[0]._id, type: 'tournament_placement_1' });
    expect(tx.amount).toBe(200);
    expect(tx.metadata.tournamentId.toString()).toBe(tournament._id.toString());
    expect(tx.metadata.placement).toBe(1);
  });

  test('gives a dropped player neither participation nor placement points', async () => {
    await awardTournamentPoints(makeTournament({ dropped: [players[1]] }));

    expect(await PointTransaction.countDocuments({ user: players[1]._id })).toBe(0);
    expect(await balanceOf(players[1])).toBe(0);
    expect(await balanceOf(players[0])).toBe(215);
  });

  test('does not shift other players up when a placed player has dropped', async () => {
    await awardTournamentPoints(makeTournament({ dropped: [players[0]] }));

    expect(await balanceOf(players[1])).toBe(115); // still 2nd place
    const playerIds = players.map(p => p._id);
    expect(
      await PointTransaction.countDocuments({ user: { $in: playerIds }, type: 'tournament_placement_1' })
    ).toBe(0);
  });

  test('is idempotent when called twice for the same tournament', async () => {
    const tournament = makeTournament();

    await awardTournamentPoints(tournament);
    await awardTournamentPoints(tournament);

    expect(await balanceOf(players[0])).toBe(215);
    expect(await balanceOf(players[4])).toBe(15);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(2);
  });

  test('pays once when the same tournament is completed concurrently', async () => {
    const tournament = makeTournament();

    await Promise.all([awardTournamentPoints(tournament), awardTournamentPoints(tournament)]);

    expect(await balanceOf(players[0])).toBe(215);
    expect(await balanceOf(players[4])).toBe(15);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(2);
  });

  test('resolves guests with a single query for the whole tournament', async () => {
    const findSpy = jest.spyOn(User, 'find');
    const findByIdSpy = jest.spyOn(User, 'findById');

    await awardTournamentPoints(makeTournament());

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(findByIdSpy).not.toHaveBeenCalled();
  });

  test('does not award guest players', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });
    const tournament = makeTournament({ top4: [guest, players[1], players[2], players[3]] });
    tournament.players.push({ player: guest._id, dropped: false });

    await awardTournamentPoints(tournament);

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
  });
});

describe('awardRankedQualificationPoints', () => {
  test('awards 10 points with the league id recorded', async () => {
    const leagueId = new mongoose.Types.ObjectId();

    await awardRankedQualificationPoints(user._id, leagueId);

    const tx = await PointTransaction.findOne({ user: user._id, type: 'ranked_league_qualified' });
    expect(tx.amount).toBe(10);
    expect(tx.metadata.leagueId.toString()).toBe(leagueId.toString());
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });

  test('awards only once per league', async () => {
    const leagueId = new mongoose.Types.ObjectId();

    await awardRankedQualificationPoints(user._id, leagueId);
    await awardRankedQualificationPoints(user._id, leagueId);

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(1);
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });

  test('awards only once when called concurrently for the same league', async () => {
    const leagueId = new mongoose.Types.ObjectId();

    await Promise.all([
      awardRankedQualificationPoints(user._id, leagueId),
      awardRankedQualificationPoints(user._id, leagueId),
    ]);

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(1);
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });

  test('awards again in a different league', async () => {
    await awardRankedQualificationPoints(user._id, new mongoose.Types.ObjectId());
    await awardRankedQualificationPoints(user._id, new mongoose.Types.ObjectId());

    expect((await User.findById(user._id)).pointsBalance).toBe(20);
  });
});

describe('awardRankedSeasonPlacementPoints', () => {
  let players;

  beforeEach(async () => {
    players = await User.create([1, 2, 3, 4, 5].map(n => ({
      displayName: `test-points-season-p${n}`,
      email: `points-season-p${n}@example.com`,
      password: 'password123',
      clubAffiliation: 'Charleston',
    })));
  });

  const standing = (player, rankedPoints, gamesPlayed = 3) => ({
    player: player._id,
    rankedPoints,
    gamesPlayed,
  });
  const makeLeague = (leaguePlayers) => ({
    _id: new mongoose.Types.ObjectId(),
    players: leaguePlayers,
  });
  const balanceOf = async (player) => (await User.findById(player._id)).pointsBalance;

  test('pays the top three qualified players 150/100/50', async () => {
    const league = makeLeague([
      standing(players[0], 480),
      standing(players[1], 560),
      standing(players[2], 520),
      standing(players[3], 510),
    ]);

    await awardRankedSeasonPlacementPoints(league);

    expect(await balanceOf(players[1])).toBe(150);
    expect(await balanceOf(players[2])).toBe(100);
    expect(await balanceOf(players[3])).toBe(50);
    expect(await balanceOf(players[0])).toBe(0);
  });

  test('records the placement type, placement number and league id', async () => {
    const league = makeLeague([standing(players[0], 560), standing(players[1], 520)]);

    await awardRankedSeasonPlacementPoints(league);

    const tx = await PointTransaction.findOne({ user: players[1]._id, type: 'ranked_league_placement_2' });
    expect(tx.amount).toBe(100);
    expect(tx.metadata.placement).toBe(2);
    expect(tx.metadata.leagueId.toString()).toBe(league._id.toString());
  });

  test('ignores players below the qualification threshold', async () => {
    const league = makeLeague([
      standing(players[0], 900, 2),
      standing(players[1], 560),
      standing(players[2], 520),
    ]);

    await awardRankedSeasonPlacementPoints(league);

    expect(await balanceOf(players[0])).toBe(0);
    expect(await balanceOf(players[1])).toBe(150);
    expect(await balanceOf(players[2])).toBe(100);
  });

  test('pays tied players the same placement and skips the shadowed placement', async () => {
    const league = makeLeague([
      standing(players[0], 560),
      standing(players[1], 560),
      standing(players[2], 540),
      standing(players[3], 520),
    ]);

    await awardRankedSeasonPlacementPoints(league);

    expect(await balanceOf(players[0])).toBe(150);
    expect(await balanceOf(players[1])).toBe(150);
    expect(await balanceOf(players[2])).toBe(50);
    expect(await balanceOf(players[3])).toBe(0);
  });

  test('awards only once per league', async () => {
    const league = makeLeague([standing(players[0], 560), standing(players[1], 520)]);

    await awardRankedSeasonPlacementPoints(league);
    await awardRankedSeasonPlacementPoints(league);

    expect(await balanceOf(players[0])).toBe(150);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(1);
  });

  test('does nothing for a league with no qualified players', async () => {
    const league = makeLeague([standing(players[0], 900, 1)]);

    await awardRankedSeasonPlacementPoints(league);

    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(0);
  });
});
