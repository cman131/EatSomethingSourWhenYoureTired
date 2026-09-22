const mongoose = require('mongoose');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

let ShopItem;

beforeEach(async () => {
  ShopItem = require('./ShopItem');
  await ShopItem.deleteMany({ name: /^test-shop/ });
});

describe('ShopItem model', () => {
  test('creates a valid item with required fields', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-jade',
      description: 'A jade green name color',
      category: 'nameColor',
      cost: 200,
      value: 'text-emerald-600',
    });

    expect(item._id).toBeDefined();
    expect(item.name).toBe('test-shop-jade');
    expect(item.isActive).toBe(true);
    expect(item.sortOrder).toBe(0);
  });

  test('rejects an item with invalid category', async () => {
    await expect(ShopItem.create({
      name: 'test-shop-bad',
      description: 'Bad category',
      category: 'badCategory',
      cost: 100,
      value: 'something',
    })).rejects.toThrow();
  });

  test('rejects an item missing required fields', async () => {
    await expect(ShopItem.create({
      name: 'test-shop-missing',
    })).rejects.toThrow();
  });

  test('accepts all valid categories', async () => {
    const categories = ['nameColor', 'nameIcon', 'profileBorder', 'profileBackdrop', 'title'];
    for (const category of categories) {
      const item = await ShopItem.create({
        name: `test-shop-${category}`,
        description: `A ${category} item`,
        category,
        cost: 100,
        value: 'some-value',
      });
      expect(item.category).toBe(category);
    }
  });

  test('stores optional previewCss', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-preview',
      description: 'Has preview',
      category: 'profileBorder',
      cost: 300,
      value: 'ring-2 ring-yellow-400',
      previewCss: 'ring: 2px solid gold',
    });

    expect(item.previewCss).toBe('ring: 2px solid gold');
  });
});
