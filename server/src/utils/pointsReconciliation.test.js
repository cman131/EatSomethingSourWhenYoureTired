const mongoose = require('mongoose');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { reconcilePoints, findMismatches, fixBalanceDrift, RECONCILE_ADMIN_REASON } = require('./pointsReconciliation');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

// Pure decision logic: fabricated input, no DB, so these are immune to other suites' data
// running concurrently against the same shared test database.
describe('findMismatches', () => {
  const userId = new mongoose.Types.ObjectId();

  test('reports no mismatch when counters agree with the ledger totals', () => {
    const users = [{ _id: userId, pointsBalance: 6, totalPointsEarned: 10 }];
    const ledgerTotals = new Map([[userId.toString(), { ledgerBalance: 6, ledgerEarned: 10 }]]);

    expect(findMismatches(users, ledgerTotals)).toEqual([]);
  });

  test('detects a pointsBalance mismatch against the ledger sum', () => {
    const users = [{ _id: userId, pointsBalance: 999, totalPointsEarned: 10 }];
    const ledgerTotals = new Map([[userId.toString(), { ledgerBalance: 10, ledgerEarned: 10 }]]);

    expect(findMismatches(users, ledgerTotals)).toEqual([
      expect.objectContaining({ userId, pointsBalance: 999, ledgerBalance: 10, balanceDrift: 989, earnedDrift: 0 }),
    ]);
  });

  test('detects a totalPointsEarned mismatch against the ledger sum', () => {
    const users = [{ _id: userId, pointsBalance: 10, totalPointsEarned: 999 }];
    const ledgerTotals = new Map([[userId.toString(), { ledgerBalance: 10, ledgerEarned: 10 }]]);

    expect(findMismatches(users, ledgerTotals)).toEqual([
      expect.objectContaining({ ledgerEarned: 10, earnedDrift: 989, balanceDrift: 0 }),
    ]);
  });

  test('flags a user with a stored balance but no ledger rows at all', () => {
    const users = [{ _id: userId, pointsBalance: 50, totalPointsEarned: 50 }];

    expect(findMismatches(users, new Map())).toEqual([
      expect.objectContaining({ ledgerBalance: 0, balanceDrift: 50, ledgerEarned: 0, earnedDrift: 50 }),
    ]);
  });

  test('does not flag users the caller did not include', () => {
    const users = [{ _id: userId, pointsBalance: 10, totalPointsEarned: 10 }];
    const ledgerTotals = new Map([[userId.toString(), { ledgerBalance: 10, ledgerEarned: 10 }]]);

    expect(findMismatches(users, ledgerTotals)).toEqual([]);
  });
});

let user;

beforeEach(async () => {
  const staleUsers = await User.find({ displayName: /^test-points-recon/ }).select('_id');
  await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
  await User.deleteMany({ displayName: /^test-points-recon/ });
  user = await User.create({
    displayName: 'test-points-recon-user',
    email: 'test-points-recon@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

describe('fixBalanceDrift', () => {
  test('writes a corrective admin_adjustment that brings pointsBalance to the ledger sum', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 999 });
    const adminId = new mongoose.Types.ObjectId();
    const mismatch = { userId: user._id, balanceDrift: 989 };

    await fixBalanceDrift(mismatch, adminId);

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(10);

    const adjustment = await PointTransaction.findOne({ user: user._id, type: 'admin_adjustment' });
    expect(adjustment.amount).toBe(-989);
    expect(adjustment.metadata.adjustedBy.toString()).toBe(adminId.toString());
    expect(adjustment.metadata.reason).toBe(RECONCILE_ADMIN_REASON);
  });

  test('does not touch totalPointsEarned', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 999, totalPointsEarned: 42 });
    const mismatch = { userId: user._id, balanceDrift: 989 };

    await fixBalanceDrift(mismatch, null);

    const updated = await User.findById(user._id);
    expect(updated.totalPointsEarned).toBe(42);
  });

  test('is a no-op when there is no balance drift', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });

    await fixBalanceDrift({ userId: user._id, balanceDrift: 0 }, null);

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(0);
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });
});

// End-to-end smoke test: scoped to this suite's own user so it stays deterministic even when
// other suites are concurrently mutating unrelated users in the same shared test database.
describe('reconcilePoints', () => {
  function findOwnMismatch(result) {
    return result.mismatches.find(m => m.userId.toString() === user._id.toString());
  }

  test('surfaces this user\'s own mismatch', async () => {
    await PointTransaction.create({ user: user._id, type: 'game_placement_1', amount: 10 });
    await User.findByIdAndUpdate(user._id, { pointsBalance: 999, totalPointsEarned: 10 });

    const result = await reconcilePoints();

    expect(findOwnMismatch(result)).toMatchObject({ ledgerBalance: 10, balanceDrift: 989 });
  });

  test('with fix: true, corrects this user\'s balance drift', async () => {
    await PointTransaction.create({ user: user._id, type: 'game_placement_1', amount: 10 });
    await User.findByIdAndUpdate(user._id, { pointsBalance: 999, totalPointsEarned: 10 });

    await reconcilePoints({ fix: true });

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(10);
  });

  test('does not report this user when its counters already agree with the ledger', async () => {
    await PointTransaction.create({ user: user._id, type: 'game_placement_1', amount: 10 });
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10, totalPointsEarned: 10 });

    const result = await reconcilePoints();

    expect(findOwnMismatch(result)).toBeUndefined();
  });
});
