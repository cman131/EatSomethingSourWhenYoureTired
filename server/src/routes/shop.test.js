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
const ShopItem = require('../models/ShopItem');
const { SHOP_CATALOG } = require('../data/shopCatalog');

let app, user, item;

function buildTestApp(authedUser) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    req.user = authedUser;
    next();
  });
  a.use('/api/shop', require('./shop'));
  return a;
}

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-shop-route/ });
  await ShopItem.deleteMany({ name: /^test-shop-route/ });

  user = await User.create({
    displayName: 'test-shop-route-user',
    email: 'test-shop-route@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
    pointsBalance: 500,
    totalPointsEarned: 500,
  });

  item = await ShopItem.create({
    name: 'test-shop-route-jade',
    description: 'Jade green name color',
    category: 'nameColor',
    cost: 200,
    value: 'text-emerald-600',
  });

  app = buildTestApp(user);
});

describe('GET /api/shop', () => {
  test('returns active items grouped by category', async () => {
    const res = await request(app).get('/api/shop');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('nameColor');
    const jade = res.body.data.nameColor.find(i => i.name === 'test-shop-route-jade');
    expect(jade).toBeDefined();
  });

  test('excludes inactive items', async () => {
    await ShopItem.create({
      name: 'test-shop-route-inactive',
      description: 'Inactive item',
      category: 'nameColor',
      cost: 100,
      value: 'text-red-600',
      isActive: false,
    });

    const res = await request(app).get('/api/shop');

    const colors = res.body.data.nameColor || [];
    const inactive = colors.find(i => i.name === 'test-shop-route-inactive');
    expect(inactive).toBeUndefined();
  });
});

describe('POST /api/shop/purchase', () => {
  test('deducts cost from pointsBalance and adds item to purchasedItems', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(300);
    expect(updated.purchasedItems).toHaveLength(1);
  });

  test('returns 400 when user already owns the item', async () => {
    await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already own/i);
  });

  test('returns 400 when balance is insufficient', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });
    const poorUser = await User.findById(user._id);
    app = buildTestApp(poorUser);

    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  test('returns 404 for unknown itemId', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: fakeId.toString() });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/shop/equip', () => {
  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });
  });

  test('sets equippedFlair slot to item value for an owned item', async () => {
    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: item._id.toString(), slot: 'nameColor' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBe(item.value);
  });

  test('unequips a slot when itemId is null', async () => {
    await User.findByIdAndUpdate(user._id, {
      'equippedFlair.nameColor': item.value,
    });

    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: null, slot: 'nameColor' });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBeNull();
  });

  test('returns 400 when equipping an item the user does not own', async () => {
    const otherItem = await ShopItem.create({
      name: 'test-shop-route-other',
      description: 'Not owned',
      category: 'nameColor',
      cost: 200,
      value: 'text-red-600',
    });

    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: otherItem._id.toString(), slot: 'nameColor' });

    expect(res.status).toBe(403);
  });

  test('returns 400 for an invalid slot name', async () => {
    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: item._id.toString(), slot: 'badSlot' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/shop/inventory', () => {
  test('returns purchasedItems and equippedFlair for the current user', async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
      'equippedFlair.nameColor': item.value,
    });

    const res = await request(app).get('/api/shop/inventory');

    expect(res.status).toBe(200);
    expect(res.body.data.purchasedItems).toHaveLength(1);
    expect(res.body.data.equippedFlair.nameColor).toBe(item.value);
  });
});

describe('POST /api/shop/seed', () => {
  // The seed endpoint deactivates every non-catalog ShopItem and upserts the real catalog,
  // so it must only ever run against a dedicated test database.
  const seedAsAdmin = async () => {
    expect(mongoose.connection.name).toMatch(/test/);
    return request(buildTestApp({ _id: user._id, isAdmin: true })).post('/api/shop/seed');
  };

  afterAll(async () => {
    if (/test/.test(mongoose.connection.name)) {
      await ShopItem.deleteMany({ name: { $in: SHOP_CATALOG.map(i => i.name) } });
    }
  });

  test('returns 403 for non-admin users', async () => {
    const res = await request(app).post('/api/shop/seed');

    expect(res.status).toBe(403);
  });

  test('seeds the shared catalog, updating stale rows in place and deactivating removed items', async () => {
    const catalogNames = SHOP_CATALOG.map(i => i.name);
    const catalogJade = SHOP_CATALOG.find(i => i.name === 'Jade Green');
    await ShopItem.deleteMany({ name: { $in: ['Jade Green', 'Hanabi'] } });
    await ShopItem.create({
      name: 'Jade Green',
      description: 'stale',
      category: 'nameColor',
      cost: 250,
      tier: 'entry',
      value: 'stale-value',
    });

    const res = await seedAsAdmin();

    expect(res.status).toBe(200);
    expect(await ShopItem.countDocuments({ name: { $in: catalogNames } })).toBe(SHOP_CATALOG.length);

    const jadeRows = await ShopItem.find({ name: 'Jade Green' });
    expect(jadeRows).toHaveLength(1);
    expect(jadeRows[0].cost).toBe(125);
    expect(jadeRows[0].tier).toBe('mid');
    expect(jadeRows[0].value).toBe('flair-color-emerald');
    expect(jadeRows[0].description).toBe(catalogJade.description);
    expect(jadeRows[0].category).toBe('nameColor');

    const hanabi = await ShopItem.findOne({ name: 'Hanabi' });
    expect(hanabi.tier).toBe('premium');
    expect(hanabi.value).toBe('flair-border-hanabi');

    const removed = await ShopItem.findById(item._id);
    expect(removed.isActive).toBe(false);
  });

  test('seeding twice does not create duplicates', async () => {
    const catalogNames = SHOP_CATALOG.map(i => i.name);

    await seedAsAdmin();
    const res = await seedAsAdmin();

    expect(res.status).toBe(200);
    expect(await ShopItem.countDocuments({ name: { $in: catalogNames } })).toBe(SHOP_CATALOG.length);
  });
});
