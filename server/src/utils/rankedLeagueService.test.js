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

  function playGame() {
    return updateRankedPoints({
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
});
