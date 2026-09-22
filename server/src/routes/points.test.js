const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

const User = require('../models/User');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const RankedLeague = require('../models/RankedLeague');
const ShopItem = require('../models/ShopItem');
const PointTransaction = require('../models/PointTransaction');

let app, user;

function buildTestApp(authedUser) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    req.user = authedUser;
    next();
  });
  a.use('/api/points', require('./points'));
  return a;
}

// Referenced documents are only read for their label fields, so insert them raw and skip
// the models' unrelated required-field validation and save hooks.
const insertedDocs = [];

async function createUnvalidated(Model, fields) {
  const _id = new mongoose.Types.ObjectId();
  await Model.collection.insertOne({ _id, ...fields });
  insertedDocs.push({ Model, _id });
  return { _id };
}

async function createTransactions(count) {
  const docs = Array.from({ length: count }, (_, i) => ({
    user: user._id,
    type: 'game_submitted',
    amount: 2,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
  }));
  await PointTransaction.insertMany(docs);
}

beforeEach(async () => {
  const staleUsers = await User.find({ displayName: /^test-points-route/ }).select('_id');
  await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
  await User.deleteMany({ displayName: /^test-points-route/ });

  user = await User.create({
    displayName: 'test-points-route-user',
    email: 'test-points-route@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });

  app = buildTestApp(user);
});

afterEach(async () => {
  while (insertedDocs.length > 0) {
    const { Model, _id } = insertedDocs.pop();
    await Model.collection.deleteOne({ _id });
  }
});

describe('PointTransaction metadata', () => {
  test('persists itemId for shop purchases', async () => {
    const item = await createUnvalidated(ShopItem, { name: 'test-points-route-jade' });

    const tx = await PointTransaction.create({
      user: user._id,
      type: 'shop_purchase',
      amount: -200,
      metadata: { itemId: item._id },
    });

    const stored = await PointTransaction.findById(tx._id).lean();
    expect(stored.metadata.itemId.toString()).toBe(item._id.toString());
  });
});

describe('GET /api/points/me/history paging', () => {
  test('defaults to page 1 with 20 items', async () => {
    await createTransactions(25);

    const res = await request(app).get('/api/points/me/history');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(20);
    expect(res.body.data).toMatchObject({ page: 1, limit: 20, total: 25, totalPages: 2 });
  });

  test('returns the second page of results', async () => {
    await createTransactions(25);

    const res = await request(app).get('/api/points/me/history?page=2');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(5);
    expect(res.body.data.page).toBe(2);
  });

  test.each([['-5'], ['0'], ['abc']])('treats page=%s as page 1', async page => {
    await createTransactions(3);

    const res = await request(app).get(`/api/points/me/history?page=${page}`);

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.items).toHaveLength(3);
  });

  test('clamps limit to a maximum of 100', async () => {
    await createTransactions(101);

    const res = await request(app).get('/api/points/me/history?limit=1000000');

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(100);
    expect(res.body.data.items).toHaveLength(100);
    expect(res.body.data.totalPages).toBe(2);
  });

  test('clamps a negative limit to a minimum of 1', async () => {
    await createTransactions(3);

    const res = await request(app).get('/api/points/me/history?limit=-10');

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(1);
    expect(res.body.data.items).toHaveLength(1);
  });

  test.each([['0'], ['abc']])('falls back to the default limit for limit=%s', async limit => {
    const res = await request(app).get(`/api/points/me/history?limit=${limit}`);

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(20);
  });
});

describe('GET /api/points/me/history context', () => {
  async function getOnlyItem() {
    const res = await request(app).get('/api/points/me/history');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    return res.body.data.items[0];
  }

  test('labels a shop purchase with the item name', async () => {
    const item = await createUnvalidated(ShopItem, { name: 'test-points-route-jade' });
    await PointTransaction.create({
      user: user._id, type: 'shop_purchase', amount: -200, metadata: { itemId: item._id },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'shopItem', id: item._id.toString(), label: 'test-points-route-jade', missing: false,
    });
  });

  test('labels a tournament award with the tournament name', async () => {
    const tournament = await createUnvalidated(Tournament, { name: 'test-points-route-open' });
    await PointTransaction.create({
      user: user._id, type: 'tournament_placement_1', amount: 20, metadata: { tournamentId: tournament._id },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'tournament', id: tournament._id.toString(), label: 'test-points-route-open', missing: false,
    });
  });

  test('labels a game award with the game date', async () => {
    const game = await createUnvalidated(Game, { gameDate: new Date('2026-03-04T12:00:00Z') });
    await PointTransaction.create({
      user: user._id, type: 'game_placement_1', amount: 10, metadata: { gameId: game._id },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'game', id: game._id.toString(), label: 'Game played 2026-03-04', missing: false,
    });
  });

  test('labels a game points reversal with the game date, via reversedGameId', async () => {
    const game = await createUnvalidated(Game, { gameDate: new Date('2026-03-04T12:00:00Z') });
    await PointTransaction.create({
      user: user._id, type: 'game_points_reversal', amount: -10, metadata: { reversedGameId: game._id },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'game', id: game._id.toString(), label: 'Game played 2026-03-04', missing: false,
    });
  });

  test('labels a ranked season award with the season start date', async () => {
    const league = await createUnvalidated(RankedLeague, { startDate: new Date('2026-01-15T00:00:00Z') });
    await PointTransaction.create({
      user: user._id, type: 'ranked_league_placement_1', amount: 20, metadata: { leagueId: league._id },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'rankedSeason', id: league._id.toString(), label: 'Ranked season starting 2026-01-15', missing: false,
    });
  });

  test('marks context as missing when the referenced document was deleted', async () => {
    const deletedTournamentId = new mongoose.Types.ObjectId();
    await PointTransaction.create({
      user: user._id, type: 'tournament_participated', amount: 5, metadata: { tournamentId: deletedTournamentId },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({
      kind: 'tournament', id: deletedTournamentId.toString(), label: null, missing: true,
    });
  });

  test('returns null context when the transaction references nothing', async () => {
    await PointTransaction.create({ user: user._id, type: 'game_played', amount: 1 });

    const tx = await getOnlyItem();

    expect(tx.context).toBeNull();
  });

  test('surfaces the reason as context for an admin adjustment', async () => {
    await PointTransaction.create({
      user: user._id,
      type: 'admin_adjustment',
      amount: 25,
      metadata: { adjustedBy: user._id, reason: 'missed award' },
    });

    const tx = await getOnlyItem();

    expect(tx.context).toEqual({ kind: 'adjustment', id: null, label: 'missed award', missing: false });
  });
});

describe('POST /api/points/admin/adjust', () => {
  let admin, target;

  beforeEach(async () => {
    admin = await User.create({
      displayName: 'test-points-route-admin',
      email: 'test-points-route-admin@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
      isAdmin: true,
    });
    target = user;
  });

  test('rejects a non-admin caller', async () => {
    const res = await request(app)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 10, reason: 'test' });

    expect(res.status).toBe(403);
    expect(await PointTransaction.countDocuments({ user: target._id })).toBe(0);
  });

  test('applies a positive adjustment for an admin caller', async () => {
    const adminApp = buildTestApp(admin);

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 25, reason: 'missed award' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updated = await User.findById(target._id);
    expect(updated.pointsBalance).toBe(25);
    expect(updated.totalPointsEarned).toBe(0);
  });

  test('applies a negative adjustment for an admin caller', async () => {
    await User.findByIdAndUpdate(target._id, { pointsBalance: 50 });
    const adminApp = buildTestApp(admin);

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: -20, reason: 'correcting overpay' });

    expect(res.status).toBe(200);
    const updated = await User.findById(target._id);
    expect(updated.pointsBalance).toBe(30);
  });

  test('rejects a negative adjustment that would drop the balance below zero', async () => {
    await User.findByIdAndUpdate(target._id, { pointsBalance: 5 });
    const adminApp = buildTestApp(admin);

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: -20, reason: 'penalty' });

    expect(res.status).toBe(400);
    const updated = await User.findById(target._id);
    expect(updated.pointsBalance).toBe(5);
  });

  test('rejects an unknown userId', async () => {
    const adminApp = buildTestApp(admin);
    const missingUserId = new mongoose.Types.ObjectId().toString();

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: missingUserId, amount: 10, reason: 'test' });

    expect(res.status).toBe(404);
  });

  test('rejects a zero amount', async () => {
    const adminApp = buildTestApp(admin);

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 0, reason: 'test' });

    expect(res.status).toBe(400);
  });

  test('rejects a missing reason', async () => {
    const adminApp = buildTestApp(admin);

    const res = await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 10 });

    expect(res.status).toBe(400);
    expect(await PointTransaction.countDocuments({ user: target._id })).toBe(0);
  });

  test('records adjustedBy and reason on the ledger row', async () => {
    const adminApp = buildTestApp(admin);

    await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 15, reason: 'missed award' });

    const tx = await PointTransaction.findOne({ user: target._id });
    expect(tx.type).toBe('admin_adjustment');
    expect(tx.metadata.adjustedBy.toString()).toBe(admin._id.toString());
    expect(tx.metadata.reason).toBe('missed award');
  });

  test('the adjustment appears in the affected player\'s own history with its reason', async () => {
    const adminApp = buildTestApp(admin);
    await request(adminApp)
      .post('/api/points/admin/adjust')
      .send({ userId: target._id.toString(), amount: 15, reason: 'missed award' });

    const res = await request(app).get('/api/points/me/history');

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].context).toEqual({
      kind: 'adjustment', id: null, label: 'missed award', missing: false,
    });
  });
});

describe('GET /api/points/config', () => {
  test('returns every award amount', async () => {
    const res = await request(app).get('/api/points/config');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      gamePlacementAmounts: { 1: 10, 2: 7, 3: 4, 4: 2 },
      gameSubmittedAmount: 2,
      gameVerifiedAmount: 1,
      gameDailyCap: 60,
      gameDailyWindowHours: 24,
      repeatGroupMaxGames: 6,
      repeatGroupWindowDays: 7,
      tournamentParticipationAmount: 15,
      tournamentPlacementAmounts: [200, 100, 70, 50],
      rankedQualificationAmount: 10,
      rankedPlacementAmounts: [150, 100, 50],
      quizCompletionAmount: 1,
      quizWeeklyCapCount: 5,
      weeklyStreakAmounts: [2, 3, 4, 5],
    });
  });
});
