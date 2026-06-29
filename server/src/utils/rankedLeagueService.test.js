const mongoose = require('mongoose');
const RankedLeague = require('../models/RankedLeague');
const { getCurrentLeague } = require('./rankedLeagueService');

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
