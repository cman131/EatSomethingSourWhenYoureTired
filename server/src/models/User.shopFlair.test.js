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
      'equippedFlair.nameColor': item._id.toString(),
    });

    const found = await User.findById(user._id);
    expect(found.equippedFlair.nameColor).toBe(item._id.toString());
  });
});
