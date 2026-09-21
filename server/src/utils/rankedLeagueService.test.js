const mongoose = require('mongoose');
const RankedLeague = require('../models/RankedLeague');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { getCurrentLeague, updateRankedPoints, RANKED_GAMES_THRESHOLD } = require('./rankedLeagueService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('getCurrentLeague', () => {
  beforeEach(async () => {
    await RankedLeague.deleteMany({});
  });

  test('creates a new league when none exists', async () => {
    const league = await getCurrentLeague();
    expect(league).toBeDefined();
    expect(league.startDate).toBeDefined();
    expect(league.players).toHaveLength(0);
    const count = await RankedLeague.countDocuments();
    expect(count).toBe(1);
  });

  test('returns existing active league (within 90 days)', async () => {
    const existing = await RankedLeague.create({ startDate: new Date(), players: [] });
    const league = await getCurrentLeague();
    expect(league._id.toString()).toBe(existing._id.toString());
    const count = await RankedLeague.countDocuments();
    expect(count).toBe(1);
  });

  test('creates new league when existing is older than 90 days', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 91);
    await RankedLeague.create({ startDate: oldDate, players: [] });

    const league = await getCurrentLeague();

    const daysSinceStart = (Date.now() - league.startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysSinceStart).toBeLessThan(1);

    const count = await RankedLeague.countDocuments();
    expect(count).toBe(2);
  });
});

describe('updateRankedPoints', () => {
  const p1Id = new mongoose.Types.ObjectId();
  const p2Id = new mongoose.Types.ObjectId();
  const p3Id = new mongoose.Types.ObjectId();
  const p4Id = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    await RankedLeague.deleteMany({});
    await RankedLeague.create({
      startDate: new Date(),
      players: [
        { player: p1Id, rankedPoints: 500, gamesPlayed: 0 },
        { player: p2Id, rankedPoints: 500, gamesPlayed: 0 },
        { player: p3Id, rankedPoints: 500, gamesPlayed: 0 },
        { player: p4Id, rankedPoints: 500, gamesPlayed: 0 },
      ]
    });
  });

  test('updates rankedPoints by UMA for each player', async () => {
    // p1: 1st, 40000 pts → UMA = (40000-30000)/1000 + 30 = 40
    // p2: 2nd, 32000 pts → UMA = (32000-30000)/1000 + 10 = 12
    // p3: 3rd, 25000 pts → UMA = (25000-30000)/1000 - 10 = -15
    // p4: 4th, 23000 pts → UMA = (23000-30000)/1000 - 30 = -37
    const mockGame = {
      players: [
        { player: p1Id, score: 40000, rank: 1 },
        { player: p2Id, score: 32000, rank: 2 },
        { player: p3Id, score: 25000, rank: 3 },
        { player: p4Id, score: 23000, rank: 4 },
      ]
    };

    await updateRankedPoints(mockGame);

    const league = await RankedLeague.findOne().sort({ startDate: -1 });
    const find = (id) => league.players.find(p => p.player.toString() === id.toString());

    expect(find(p1Id).rankedPoints).toBe(540);
    expect(find(p2Id).rankedPoints).toBe(512);
    expect(find(p3Id).rankedPoints).toBe(485);
    expect(find(p4Id).rankedPoints).toBe(463);
  });

  test('increments gamesPlayed by 1 for each player', async () => {
    const mockGame = {
      players: [
        { player: p1Id, score: 40000, rank: 1 },
        { player: p2Id, score: 32000, rank: 2 },
        { player: p3Id, score: 25000, rank: 3 },
        { player: p4Id, score: 23000, rank: 4 },
      ]
    };

    await updateRankedPoints(mockGame);

    const league = await RankedLeague.findOne().sort({ startDate: -1 });
    for (const lp of league.players) {
      expect(lp.gamesPlayed).toBe(1);
    }
  });

  test('skips players not in the league without throwing', async () => {
    const outsiderId = new mongoose.Types.ObjectId();
    const mockGame = {
      players: [
        { player: outsiderId, score: 40000, rank: 1 },
        { player: p2Id, score: 32000, rank: 2 },
        { player: p3Id, score: 25000, rank: 3 },
        { player: p4Id, score: 23000, rank: 4 },
      ]
    };

    await expect(updateRankedPoints(mockGame)).resolves.not.toThrow();

    const league = await RankedLeague.findOne().sort({ startDate: -1 });
    const find = (id) => league.players.find(p => p.player.toString() === id.toString());
    expect(find(p2Id).gamesPlayed).toBe(1);
    expect(find(outsiderId)).toBeUndefined(); // outsider was never added to the league
  });

  describe('idempotency', () => {
    const makeGame = () => ({
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1Id, score: 40000, rank: 1 },
        { player: p2Id, score: 32000, rank: 2 },
        { player: p3Id, score: 25000, rank: 3 },
        { player: p4Id, score: 23000, rank: 4 },
      ],
    });

    const currentLeague = () => RankedLeague.findOne().sort({ startDate: -1 });
    const find = (league, id) => league.players.find(p => p.player.toString() === id.toString());

    test('applying the same game twice changes rankedPoints and gamesPlayed once', async () => {
      const game = makeGame();

      await updateRankedPoints(game);
      await updateRankedPoints(game);

      const league = await currentLeague();
      expect(find(league, p1Id).rankedPoints).toBe(540);
      expect(find(league, p1Id).gamesPlayed).toBe(1);
    });

    test('records the applied game id on the league', async () => {
      const game = makeGame();

      await updateRankedPoints(game);

      const league = await currentLeague();
      expect(league.appliedGames.map(String)).toEqual([game._id.toString()]);
    });

    test('a different game is still applied', async () => {
      await updateRankedPoints(makeGame());
      await updateRankedPoints(makeGame());

      const league = await currentLeague();
      expect(find(league, p1Id).gamesPlayed).toBe(2);
    });

    test('games without an id are always applied', async () => {
      const { _id, ...noIdGame } = makeGame();

      await updateRankedPoints(noIdGame);
      await updateRankedPoints(noIdGame);

      const league = await currentLeague();
      expect(find(league, p1Id).gamesPlayed).toBe(2);
    });
  });
});

describe('ranked league qualification points', () => {
  let players;
  let league;

  beforeEach(async () => {
    // Scoped to this suite's users: Jest runs suites in parallel against the same database
    const staleUsers = await User.find({ displayName: /^test-ranked/ }).select('_id');
    await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
    await RankedLeague.deleteMany({});
    await User.deleteMany({ displayName: /^test-ranked/ });

    players = await User.create([1, 2, 3, 4].map(n => ({
      displayName: `test-ranked-p${n}`,
      email: `ranked-p${n}@example.com`,
      password: 'password123',
      clubAffiliation: 'Charleston',
    })));

    league = await RankedLeague.create({
      startDate: new Date(),
      players: players.map(p => ({ player: p._id, rankedPoints: 500, gamesPlayed: 0 })),
    });
  });

  afterAll(async () => {
    await User.deleteMany({ displayName: /^test-ranked/ });
  });

  function playGame(gameId) {
    return updateRankedPoints({
      _id: gameId,
      players: players.map((p, index) => ({ player: p._id, score: 25000, rank: index + 1 })),
    });
  }

  const qualificationTransactions = user =>
    PointTransaction.find({ user: user._id, type: 'ranked_league_qualified' });

  test('the qualification threshold is 3 games', () => {
    expect(RANKED_GAMES_THRESHOLD).toBe(3);
  });

  test('awards nothing before a player reaches the threshold', async () => {
    await playGame();
    await playGame();

    const playerIds = players.map(p => p._id);
    expect(
      await PointTransaction.countDocuments({ user: { $in: playerIds }, type: 'ranked_league_qualified' })
    ).toBe(0);
  });

  test('awards 10 points to each player when they reach the threshold', async () => {
    await playGame();
    await playGame();
    await playGame();

    for (const player of players) {
      const transactions = await qualificationTransactions(player);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(10);
      expect(transactions[0].metadata.leagueId.toString()).toBe(league._id.toString());
      expect((await User.findById(player._id)).pointsBalance).toBe(10);
    }
  });

  test('does not award again on games after the threshold', async () => {
    for (let i = 0; i < RANKED_GAMES_THRESHOLD + 2; i++) {
      await playGame();
    }

    for (const player of players) {
      expect(await qualificationTransactions(player)).toHaveLength(1);
    }
  });

  test('awards only the players who cross the threshold in that game', async () => {
    league.players[0].gamesPlayed = RANKED_GAMES_THRESHOLD - 1;
    await league.save();

    await playGame();

    expect(await qualificationTransactions(players[0])).toHaveLength(1);
    expect(await qualificationTransactions(players[1])).toHaveLength(0);
  });

  test('still records ranked points when the qualification award fails', async () => {
    league.players[0].gamesPlayed = RANKED_GAMES_THRESHOLD - 1;
    await league.save();
    const createSpy = jest.spyOn(PointTransaction, 'create').mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(playGame()).resolves.not.toThrow();

    const saved = await RankedLeague.findById(league._id);
    expect(saved.players[0].gamesPlayed).toBe(RANKED_GAMES_THRESHOLD);
    createSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('replaying an already-applied game retries a failed qualification award without re-applying points', async () => {
    league.players[0].gamesPlayed = RANKED_GAMES_THRESHOLD - 1;
    await league.save();
    const gameId = new mongoose.Types.ObjectId();
    const createSpy = jest.spyOn(PointTransaction, 'create').mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await playGame(gameId);
    createSpy.mockRestore();
    errorSpy.mockRestore();
    expect(await qualificationTransactions(players[0])).toHaveLength(0);

    await playGame(gameId);

    expect(await qualificationTransactions(players[0])).toHaveLength(1);
    const saved = await RankedLeague.findById(league._id);
    expect(saved.players[0].gamesPlayed).toBe(RANKED_GAMES_THRESHOLD);
  });
});

describe('ranked season-end placement rewards', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  let players;

  beforeEach(async () => {
    // Scoped to this suite's users: Jest runs suites in parallel against the same database
    const staleUsers = await User.find({ displayName: /^test-ranked/ }).select('_id');
    await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
    await RankedLeague.deleteMany({});
    await User.deleteMany({ displayName: /^test-ranked/ });

    players = await User.create([1, 2, 3, 4].map(n => ({
      displayName: `test-ranked-season-p${n}`,
      email: `ranked-season-p${n}@example.com`,
      password: 'password123',
      clubAffiliation: 'Charleston',
    })));
  });

  afterAll(async () => {
    await User.deleteMany({ displayName: /^test-ranked/ });
  });

  const daysAgo = days => new Date(Date.now() - days * DAY_MS);
  const balanceOf = async player => (await User.findById(player._id)).pointsBalance;
  const placementTransactions = () =>
    PointTransaction.find({
      user: { $in: players.map(p => p._id) },
      type: /^ranked_league_placement_/,
    });

  // players[0] wins, players[1] second, players[2] third, players[3] is unqualified
  function createExpiredLeague(overrides = {}) {
    return RankedLeague.create({
      startDate: daysAgo(91),
      players: [
        { player: players[0]._id, rankedPoints: 560, gamesPlayed: 5 },
        { player: players[1]._id, rankedPoints: 530, gamesPlayed: 4 },
        { player: players[2]._id, rankedPoints: 510, gamesPlayed: 3 },
        { player: players[3]._id, rankedPoints: 700, gamesPlayed: 2 },
      ],
      ...overrides,
    });
  }

  test('pays the ended season when the next season is created', async () => {
    const ended = await createExpiredLeague();

    await getCurrentLeague();

    expect(await balanceOf(players[0])).toBe(150);
    expect(await balanceOf(players[1])).toBe(100);
    expect(await balanceOf(players[2])).toBe(50);
    expect(await balanceOf(players[3])).toBe(0);
    const transactions = await placementTransactions();
    expect(transactions.every(t => t.metadata.leagueId.toString() === ended._id.toString())).toBe(true);
  });

  test('marks the ended season as rewarded', async () => {
    const ended = await createExpiredLeague();

    await getCurrentLeague();

    expect((await RankedLeague.findById(ended._id)).rewardsAwardedAt).toBeInstanceOf(Date);
  });

  test('pays the ended season exactly once across repeated calls', async () => {
    await createExpiredLeague();

    await getCurrentLeague();
    await getCurrentLeague();
    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(3);
    expect(await balanceOf(players[0])).toBe(150);
  });

  test('does not pay the season that is still in progress', async () => {
    await createExpiredLeague({ startDate: daysAgo(10) });

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(0);
  });

  test('pays an earlier season left unpaid after a crash between rollover and payout', async () => {
    await createExpiredLeague();
    await RankedLeague.create({ startDate: daysAgo(1), players: [] });

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(3);
  });

  test('retries a failed payout on the next call without double paying', async () => {
    const ended = await createExpiredLeague();
    const createSpy = jest.spyOn(PointTransaction, 'create').mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const current = await getCurrentLeague();

    expect(current.startDate.getTime()).toBeGreaterThan(ended.startDate.getTime());
    expect((await RankedLeague.findById(ended._id)).rewardsAwardedAt).toBeNull();
    createSpy.mockRestore();
    errorSpy.mockRestore();

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(3);
    expect(await balanceOf(players[0])).toBe(150);
    expect(await balanceOf(players[1])).toBe(100);
    expect(await balanceOf(players[2])).toBe(50);
  });

  test('skips a season another request is currently paying out', async () => {
    await createExpiredLeague({ rewardsClaimedAt: new Date() });

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(0);
  });

  test('takes over a payout whose claim went stale', async () => {
    await createExpiredLeague({ rewardsClaimedAt: new Date(Date.now() - 60 * 60 * 1000) });

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(3);
  });

  test('pays each of two leagues created by a rollover race', async () => {
    const first = await createExpiredLeague();
    const raceDuplicate = await RankedLeague.create({ startDate: new Date(first.startDate.getTime() + 5), players: [] });
    await RankedLeague.create({ startDate: daysAgo(1), players: [] });

    await getCurrentLeague();

    expect(await placementTransactions()).toHaveLength(3);
    expect((await RankedLeague.findById(raceDuplicate._id)).rewardsAwardedAt).toBeInstanceOf(Date);
  });
});
