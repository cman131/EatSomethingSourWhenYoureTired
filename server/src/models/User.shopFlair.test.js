const mongoose = require('mongoose');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

let User, ShopItem;

beforeEach(async () => {
  User = require('./User');
  ShopItem = require('./ShopItem');
  await User.deleteMany({ displayName: /^test-flair/ });
  await ShopItem.deleteMany({ name: /^test-flair/ });
});

describe('PLAYER_POPULATE_FIELDS', () => {
  test('includes equippedFlair so flair renders in game rows and member lists', () => {
    const { PLAYER_POPULATE_FIELDS } = require('./User');
    expect(PLAYER_POPULATE_FIELDS).toContain('equippedFlair');
  });
});

describe('User pointsBalance', () => {
  const buildUser = pointsBalance => new User({
    displayName: 'test-flair-balance',
    email: 'test-flair-balance@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
    pointsBalance,
  });

  test('rejects a negative balance', async () => {
    await expect(buildUser(-1).validate()).rejects.toThrow(/pointsBalance/);
  });

  test('accepts a zero balance', async () => {
    await expect(buildUser(0).validate()).resolves.toBeUndefined();
  });
});

describe('User flair fields', () => {
  test('new user has empty purchasedItems and null equippedFlair', async () => {
    const user = await User.create({
      displayName: 'test-flair-new',
      email: 'test-flair-new@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    expect(user.purchasedItems).toHaveLength(0);
    expect(user.equippedFlair.nameColor).toBeNull();
    expect(user.equippedFlair.nameIcon).toBeNull();
    expect(user.equippedFlair.profileBorder).toBeNull();
    expect(user.equippedFlair.title).toBeNull();
  });

  test('can add an item to purchasedItems', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-jade',
      description: 'Jade green',
      category: 'nameColor',
      cost: 200,
      value: 'text-emerald-600',
    });

    const user = await User.create({
      displayName: 'test-flair-buyer',
      email: 'test-flair-buyer@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.purchasedItems.push({ item: item._id });
    await user.save();

    const found = await User.findById(user._id);
    expect(found.purchasedItems).toHaveLength(1);
    expect(found.purchasedItems[0].item.toString()).toBe(item._id.toString());
  });

  test('can set equippedFlair.nameColor', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-color',
      description: 'A color',
      category: 'nameColor',
      cost: 200,
      value: 'text-emerald-600',
    });

    const user = await User.create({
      displayName: 'test-flair-equip',
      email: 'test-flair-equip@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    await User.findByIdAndUpdate(user._id, {
      'equippedFlair.nameColor': item.value,
    });

    const found = await User.findById(user._id);
    expect(found.equippedFlair.nameColor).toBe(item.value);
  });
});

describe('purchasedItems source', () => {
  const buildEarnedUser = (name, purchasedItems) => User.create({
    displayName: name,
    email: `${name}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
    purchasedItems,
  });

  test('records the event an item was earned from', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-earned', description: 'Earned', category: 'title', cost: 0, value: '🏆 test-flair-earned',
    });
    const refId = new mongoose.Types.ObjectId();

    const user = await buildEarnedUser('test-flair-source', [
      { item: item._id, source: { kind: 'tournament', refId, label: 'Spring Open' } },
    ]);

    const found = await User.findById(user._id);
    expect(found.purchasedItems[0].source.kind).toBe('tournament');
    expect(found.purchasedItems[0].source.refId.toString()).toBe(refId.toString());
    expect(found.purchasedItems[0].source.label).toBe('Spring Open');
  });

  test('leaves source empty for a purchase', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-bought', description: 'Bought', category: 'title', cost: 50, value: 'test-flair-bought',
    });

    const user = await buildEarnedUser('test-flair-nosource', [{ item: item._id }]);

    const found = await User.findById(user._id);
    expect(found.purchasedItems[0].source.kind).toBeUndefined();
  });

  test('rejects an unknown source kind', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-badkind', description: 'Bad', category: 'title', cost: 0, value: 'test-flair-badkind',
    });

    await expect(buildEarnedUser('test-flair-badkind-user', [
      { item: item._id, source: { kind: 'raffle', refId: new mongoose.Types.ObjectId(), label: 'x' } },
    ])).rejects.toThrow(/kind/);
  });
});
