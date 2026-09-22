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
const PointTransaction = require('../models/PointTransaction');
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

  test('returns 400 for a malformed itemId and does not charge the user', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: 'not-an-object-id' });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(500);
    expect(updated.purchasedItems).toHaveLength(0);
  });

  test('returns 400 when itemId is missing', async () => {
    const res = await request(app).post('/api/shop/purchase').send({});

    expect(res.status).toBe(400);
  });

  test('returns 400 when itemId is not a string', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: { $gt: '' } });

    expect(res.status).toBe(400);
  });

  test('records a negative shop_purchase ledger row for the item cost', async () => {
    await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    const rows = await PointTransaction.find({ user: user._id, type: 'shop_purchase' });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(-200);
  });

  test('does not record a ledger row when the purchase is rejected', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });

    await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: item._id.toString() });

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(0);
  });

  describe('concurrent purchases', () => {
    const purchase = itemId =>
      request(app).post('/api/shop/purchase').send({ itemId: itemId.toString() });

    test('buying the same item in parallel charges once and grants one copy', async () => {
      const responses = await Promise.all(Array.from({ length: 5 }, () => purchase(item._id)));

      const statuses = responses.map(r => r.status).sort();
      expect(statuses).toEqual([200, 400, 400, 400, 400]);
      responses
        .filter(r => r.status === 400)
        .forEach(r => expect(r.body.message).toMatch(/already own/i));

      const updated = await User.findById(user._id);
      expect(updated.pointsBalance).toBe(300);
      expect(updated.purchasedItems).toHaveLength(1);
      expect(await PointTransaction.countDocuments({ user: user._id, type: 'shop_purchase' })).toBe(1);
    });

    test('buying different items in parallel cannot overspend the balance', async () => {
      await User.findByIdAndUpdate(user._id, { pointsBalance: 300 });
      const otherItems = await ShopItem.create(
        [1, 2, 3, 4].map(n => ({
          name: `test-shop-route-extra-${n}`,
          description: 'Extra item',
          category: 'nameColor',
          cost: 200,
          value: `text-extra-${n}`,
        }))
      );

      const responses = await Promise.all([item, ...otherItems].map(i => purchase(i._id)));

      const succeeded = responses.filter(r => r.status === 200);
      const rejected = responses.filter(r => r.status === 400);
      expect(succeeded).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      rejected.forEach(r => expect(r.body.message).toMatch(/insufficient/i));

      const updated = await User.findById(user._id);
      expect(updated.pointsBalance).toBe(100);
      expect(updated.purchasedItems).toHaveLength(1);
    });
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

  test('returns 400 when the item category does not match the slot and leaves equippedFlair unchanged', async () => {
    await User.findByIdAndUpdate(user._id, { 'equippedFlair.nameColor': item.value });

    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: item._id.toString(), slot: 'title' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/slot/i);

    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.title).toBeNull();
    expect(updated.equippedFlair.nameColor).toBe(item.value);
  });

  test.each(['nameIcon', 'profileBorder', 'title'])(
    'rejects a nameColor item equipped into the %s slot',
    async slot => {
      const res = await request(app)
        .post('/api/shop/equip')
        .send({ itemId: item._id.toString(), slot });

      expect(res.status).toBe(400);

      const updated = await User.findById(user._id);
      expect(updated.equippedFlair[slot]).toBeNull();
    }
  );

  test('lets an owner equip and unequip an item that has been retired', async () => {
    await ShopItem.findByIdAndUpdate(item._id, { isActive: false });

    const equipRes = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: item._id.toString(), slot: 'nameColor' });

    expect(equipRes.status).toBe(200);
    expect((await User.findById(user._id)).equippedFlair.nameColor).toBe(item.value);

    const unequipRes = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: null, slot: 'nameColor' });

    expect(unequipRes.status).toBe(200);
    expect((await User.findById(user._id)).equippedFlair.nameColor).toBeNull();
  });

  test('returns 400 for a malformed itemId', async () => {
    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: 'not-an-object-id', slot: 'nameColor' });

    expect(res.status).toBe(400);
  });

  test('returns 400 when itemId is not a string', async () => {
    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: { $gt: '' }, slot: 'nameColor' });

    expect(res.status).toBe(400);
  });

  test('unequips a slot when itemId is an empty string', async () => {
    await User.findByIdAndUpdate(user._id, { 'equippedFlair.nameColor': item.value });

    const res = await request(app)
      .post('/api/shop/equip')
      .send({ itemId: '', slot: 'nameColor' });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBeNull();
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

  test('returns owned items that have been retired', async () => {
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: item._id } } });
    await ShopItem.findByIdAndUpdate(item._id, { isActive: false });

    const res = await request(app).get('/api/shop/inventory');

    expect(res.status).toBe(200);
    expect(res.body.data.purchasedItems).toHaveLength(1);
    expect(res.body.data.purchasedItems[0].item.name).toBe('test-shop-route-jade');
    expect(res.body.data.purchasedItems[0].item.isActive).toBe(false);
  });

  test('omits purchases whose item no longer exists', async () => {
    const orphan = await ShopItem.create({
      name: 'test-shop-route-orphan',
      description: 'Will be deleted',
      category: 'title',
      cost: 100,
      value: 'flair-title-orphan',
    });
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { $each: [{ item: item._id }, { item: orphan._id }] } },
    });
    await ShopItem.deleteOne({ _id: orphan._id });

    const res = await request(app).get('/api/shop/inventory');

    expect(res.status).toBe(200);
    expect(res.body.data.purchasedItems).toHaveLength(1);
    expect(res.body.data.purchasedItems[0].item.name).toBe('test-shop-route-jade');
  });
});

describe('POST /api/shop/loadouts', () => {
  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });
  });

  test('creates a loadout using an owned item', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Everyday', nameColor: item.value, nameIcon: null, profileBorder: null, title: null });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Everyday');
    expect(res.body.data.nameColor).toBe(item.value);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(1);
    expect(updated.flairLoadouts[0].name).toBe('Everyday');
  });

  test('returns 400 for an empty name', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: '  ', nameColor: item.value });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('returns 400 for a non-string name', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: ['a', 'b'], nameColor: item.value });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('returns 400 for a slot value the user does not own', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Not owned', nameColor: 'text-some-unowned-color' });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('allows a retired owned item in a loadout', async () => {
    await ShopItem.findByIdAndUpdate(item._id, { isActive: false });

    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Retro', nameColor: item.value });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(item.value);
  });

  test('returns 400 once the user already has MAX_FLAIR_LOADOUTS loadouts', async () => {
    const { MAX_FLAIR_LOADOUTS } = require('../utils/flairLoadoutService');
    for (let i = 0; i < MAX_FLAIR_LOADOUTS; i++) {
      const ok = await request(app)
        .post('/api/shop/loadouts')
        .send({ name: `Look ${i}`, nameColor: item.value });
      expect(ok.status).toBe(200);
    }

    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'One too many', nameColor: item.value });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/loadout/i);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(MAX_FLAIR_LOADOUTS);
  });
});

describe('PUT /api/shop/loadouts/:loadoutId', () => {
  let loadoutId;

  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });
    const created = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Original', nameColor: item.value });
    loadoutId = created.body.data._id;
  });

  test('renames a loadout without changing its slots', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
    expect(res.body.data.nameColor).toBe(item.value);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].name).toBe('Renamed');
  });

  test('replaces a slot value with another owned item', async () => {
    const otherItem = await ShopItem.create({
      name: 'test-shop-route-second-color',
      description: 'Second color',
      category: 'nameColor',
      cost: 100,
      value: 'text-second-color',
    });
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: otherItem._id } } });

    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Original', nameColor: otherItem.value });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(otherItem.value);
  });

  test('returns 400 when replacing a slot with an item the user does not own', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Original', nameColor: 'not-owned-value' });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(item.value);
  });

  test('returns 404 for a loadout id that does not belong to the user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/shop/loadouts/${fakeId}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  test('returns 400 for an empty name', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for a non-string name and leaves the loadout unchanged', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: ['a', 'b'] });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].name).toBe('Original');
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

  test('reactivates a catalog item that was previously retired', async () => {
    await ShopItem.deleteMany({ name: 'Jade Green' });
    await ShopItem.create({
      name: 'Jade Green',
      description: 'retired',
      category: 'nameColor',
      cost: 125,
      tier: 'mid',
      value: 'flair-color-emerald',
      isActive: false,
    });

    const res = await seedAsAdmin();

    expect(res.status).toBe(200);
    const jade = await ShopItem.findOne({ name: 'Jade Green' });
    expect(jade.isActive).toBe(true);
    expect(jade.category).toBe('nameColor');
  });

  test('seeding twice does not create duplicates', async () => {
    const catalogNames = SHOP_CATALOG.map(i => i.name);

    await seedAsAdmin();
    const res = await seedAsAdmin();

    expect(res.status).toBe(200);
    expect(await ShopItem.countDocuments({ name: { $in: catalogNames } })).toBe(SHOP_CATALOG.length);
  });
});
