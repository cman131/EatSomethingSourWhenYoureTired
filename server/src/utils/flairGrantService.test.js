const mongoose = require('mongoose');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const PointTransaction = require('../models/PointTransaction');
const { grantEarnedTitle, GRANT_KIND } = require('./flairGrantService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  await mongoose.connection.close();
});

let player;
let otherPlayer;

const newRefId = () => new mongoose.Types.ObjectId();
const grantSpring = (userId, refId) =>
  grantEarnedTitle(userId, { kind: GRANT_KIND.Tournament, refId, label: 'test-grant Spring Open' });
const itemsFor = refId => ShopItem.find({ sourceKey: `tournament:${refId}` });

async function createPlayer(name) {
  return User.create({
    displayName: name,
    email: `${name}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
    pointsBalance: 40,
    totalPointsEarned: 40,
  });
}

beforeEach(async () => {
  await ShopItem.init();
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  player = await createPlayer('test-grant-player');
  otherPlayer = await createPlayer('test-grant-other');
});

describe('grantEarnedTitle', () => {
  test('creates an earned prestige title and grants it to the player', async () => {
    const refId = newRefId();

    const item = await grantSpring(player._id, refId);

    expect(item.name).toBe('🏆 test-grant Spring Open');
    expect(item.value).toBe('🏆 test-grant Spring Open');
    expect(item.category).toBe('title');
    expect(item.tier).toBe('prestige');
    expect(item.acquisition).toBe('earned');
    expect(item.cost).toBe(0);
    expect(item.isActive).toBe(true);
    expect(item.sourceKey).toBe(`tournament:${refId}`);

    const updated = await User.findById(player._id);
    expect(updated.purchasedItems).toHaveLength(1);
    expect(updated.purchasedItems[0].item.toString()).toBe(item._id.toString());
    expect(updated.purchasedItems[0].source.kind).toBe('tournament');
    expect(updated.purchasedItems[0].source.refId.toString()).toBe(refId.toString());
    expect(updated.purchasedItems[0].source.label).toBe('test-grant Spring Open');
  });

  test('granting twice for the same event leaves one item and one entry', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(player._id, refId);

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('concurrent grants for the same event converge on one item and one entry', async () => {
    const refId = newRefId();

    await Promise.all(Array.from({ length: 5 }, () => grantSpring(player._id, refId)));

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('two players granted for one event share the single item', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(otherPlayer._id, refId);

    const items = await itemsFor(refId);
    expect(items).toHaveLength(1);
    const first = await User.findById(player._id);
    const second = await User.findById(otherPlayer._id);
    expect(first.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
    expect(second.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
  });

  test('different events give the same player separate items', async () => {
    await grantSpring(player._id, newRefId());
    await grantSpring(player._id, newRefId());

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(2);
  });

  test('does not touch points', async () => {
    await grantSpring(player._id, newRefId());

    const updated = await User.findById(player._id);
    expect(updated.pointsBalance).toBe(40);
    expect(updated.totalPointsEarned).toBe(40);
    expect(await PointTransaction.countDocuments({ user: player._id })).toBe(0);
  });

  test('does not grant to guest users', async () => {
    const guest = await User.create({ displayName: 'test-grant-guest', isGuest: true });

    await grantSpring(guest._id, newRefId());

    expect((await User.findById(guest._id)).purchasedItems).toHaveLength(0);
  });

  test('does not throw for a user that no longer exists', async () => {
    await expect(grantSpring(new mongoose.Types.ObjectId(), newRefId())).resolves.toBeDefined();
  });
});
