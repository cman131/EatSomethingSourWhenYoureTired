const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const PointTransaction = require('../models/PointTransaction');
const RankedLeague = require('../models/RankedLeague');
const { replayGamePoints } = require('./gamePointsReplay');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await User.deleteMany({ displayName: /^test-replay/ });
  await mongoose.connection.close();
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

let players;

beforeEach(async () => {
  // Scoped to this suite's users: Jest runs suites in parallel against the same database
  const staleUsers = await User.find({ displayName: /^test-replay/ }).select('_id');
  const staleIds = staleUsers.map(u => u._id);
  await PointTransaction.deleteMany({ user: { $in: staleIds } });
  await Game.deleteMany({ submittedBy: { $in: staleIds } });
  await User.deleteMany({ displayName: /^test-replay/ });

  players = await User.create([1, 2, 3, 4].map(n => ({
    displayName: `test-replay-p${n}`,
    email: `replay-p${n}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
  })));
});

async function createVerifiedGame({ verifiedAgo = HOUR, isRanked = false, pointsAwardedAt } = {}) {
  return Game.create({
    submittedBy: players[0]._id,
    players: players.map((p, i) => ({ player: p._id, score: 40000 - i * 5000, position: i + 1 })),
    isRanked,
    verified: true,
    verifiedBy: players[1]._id,
    verifiedAt: new Date(Date.now() - verifiedAgo),
    pointsAwardedAt,
  });
}

const since = () => new Date(Date.now() - 24 * HOUR);
const balanceOf = async user => (await User.findById(user._id)).pointsBalance;
const transactionCount = () =>
  PointTransaction.countDocuments({ user: { $in: players.map(p => p._id) } });

describe('replayGamePoints', () => {
  test('requires a game id or a since date', async () => {
    await expect(replayGamePoints({})).rejects.toThrow(/gameId or since/);
  });

  test('awards a verified game that is missing its marker and stamps it', async () => {
    const game = await createVerifiedGame();

    const summary = await replayGamePoints({ since: since() });

    expect(summary.replayed).toEqual([game._id.toString()]);
    expect(summary.failed).toEqual([]);
    expect(await balanceOf(players[0])).toBe(12);
    expect((await Game.findById(game._id)).pointsAwardedAt).toBeInstanceOf(Date);
  });

  test('does not pay players that were already paid', async () => {
    const game = await createVerifiedGame();
    await PointTransaction.create({
      user: players[0]._id,
      type: 'game_placement_1',
      amount: 10,
      metadata: { gameId: game._id },
    });
    await User.findByIdAndUpdate(players[0]._id, { $inc: { pointsBalance: 10 } });

    await replayGamePoints({ since: since() });

    expect(await balanceOf(players[0])).toBe(12); // 10 already paid + 2 submitted, not 22
  });

  test('skips games that already carry the marker', async () => {
    await createVerifiedGame({ pointsAwardedAt: new Date() });

    const summary = await replayGamePoints({ since: since() });

    expect(summary.replayed).toEqual([]);
    expect(await transactionCount()).toBe(0);
  });

  test('skips games verified before the since date', async () => {
    await createVerifiedGame({ verifiedAgo: 48 * HOUR });

    const summary = await replayGamePoints({ since: since() });

    expect(summary.replayed).toEqual([]);
    expect(await transactionCount()).toBe(0);
  });

  test('skips games verified within the grace window', async () => {
    await createVerifiedGame({ verifiedAgo: MINUTE });

    const summary = await replayGamePoints({ since: since() });

    expect(summary.replayed).toEqual([]);
    expect(await transactionCount()).toBe(0);
  });

  test('skips unverified games', async () => {
    await Game.create({
      submittedBy: players[0]._id,
      players: players.map((p, i) => ({ player: p._id, score: 40000 - i * 5000, position: i + 1 })),
    });

    const summary = await replayGamePoints({ since: since() });

    expect(summary.replayed).toEqual([]);
  });

  test('dry run reports the games without awarding anything', async () => {
    const game = await createVerifiedGame();

    const summary = await replayGamePoints({ since: since(), dryRun: true });

    expect(summary.replayed).toEqual([game._id.toString()]);
    expect(await transactionCount()).toBe(0);
    expect((await Game.findById(game._id)).pointsAwardedAt).toBeUndefined();
  });

  test('a game id targets that game even when it carries the marker, without double paying', async () => {
    const game = await createVerifiedGame({ pointsAwardedAt: new Date() });

    await replayGamePoints({ gameId: game._id });
    await replayGamePoints({ gameId: game._id });

    expect(await balanceOf(players[0])).toBe(12);
    expect(await transactionCount()).toBe(6);
  });

  test('a game id that does not match a verified game replays nothing', async () => {
    const summary = await replayGamePoints({ gameId: new mongoose.Types.ObjectId() });

    expect(summary.replayed).toEqual([]);
    expect(summary.examined).toBe(0);
  });

  test('a failing game is reported and does not stop the others', async () => {
    const failing = await createVerifiedGame();
    const passing = await createVerifiedGame({ verifiedAgo: 2 * HOUR });
    const realCreate = PointTransaction.create.bind(PointTransaction);
    const createSpy = jest.spyOn(PointTransaction, 'create').mockImplementation(async doc => {
      if (doc.metadata.gameId.toString() === failing._id.toString()) {
        throw new Error('db down');
      }
      return realCreate(doc);
    });

    const summary = await replayGamePoints({ since: since() });
    createSpy.mockRestore();

    expect(summary.replayed).toEqual([passing._id.toString()]);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].gameId).toBe(failing._id.toString());
    expect((await Game.findById(failing._id)).pointsAwardedAt).toBeUndefined();
    expect((await Game.findById(passing._id)).pointsAwardedAt).toBeInstanceOf(Date);
  });

  describe('ranked games', () => {
    beforeEach(async () => {
      await RankedLeague.deleteMany({});
      await RankedLeague.create({
        startDate: new Date(Date.now() - 2 * HOUR * 24),
        players: players.map(p => ({ player: p._id, rankedPoints: 500, gamesPlayed: 0 })),
      });
    });

    afterAll(async () => {
      await RankedLeague.deleteMany({});
    });

    const currentLeague = () => RankedLeague.findOne().sort({ startDate: -1 });

    test('applies the ranked update once even when replayed repeatedly', async () => {
      const game = await createVerifiedGame({ isRanked: true });

      await replayGamePoints({ gameId: game._id });
      await replayGamePoints({ gameId: game._id });

      const league = await currentLeague();
      expect(league.players[0].gamesPlayed).toBe(1);
      expect(league.players[0].rankedPoints).toBe(540);
    });

    test('does not apply a game verified before the current league started', async () => {
      const game = await createVerifiedGame({ isRanked: true, verifiedAgo: 5 * 24 * HOUR });

      await replayGamePoints({ gameId: game._id });

      const league = await currentLeague();
      expect(league.players[0].gamesPlayed).toBe(0);
    });

    test('does not touch the league for unranked games', async () => {
      const game = await createVerifiedGame({ isRanked: false });

      await replayGamePoints({ gameId: game._id });

      const league = await currentLeague();
      expect(league.players[0].gamesPlayed).toBe(0);
    });
  });
});
