const mongoose = require('mongoose');
const RankedLeague = require('../models/RankedLeague');
const { getCurrentLeague, updateRankedPoints } = require('./rankedLeagueService');

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
