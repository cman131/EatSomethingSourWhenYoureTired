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

describe('ShopItem acquisition fields', () => {
  test('defaults to a shop item with no availability window and no sourceKey', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-acq-defaults',
      description: 'Defaults',
      category: 'title',
      cost: 50,
      value: 'test-shop-acq-defaults',
    });

    expect(item.acquisition).toBe('shop');
    expect(item.availableFrom).toBeNull();
    expect(item.availableUntil).toBeNull();
    expect(item.sourceKey).toBeUndefined();
  });

  test('accepts the prestige tier and the earned acquisition type', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-acq-earned',
      description: 'Earned',
      category: 'title',
      cost: 0,
      value: '🏆 test-shop-acq-earned',
      tier: 'prestige',
      acquisition: 'earned',
      sourceKey: 'test-shop-src:earned',
    });

    expect(item.tier).toBe('prestige');
    expect(item.acquisition).toBe('earned');
  });

  test('rejects an unknown acquisition type', async () => {
    await expect(ShopItem.create({
      name: 'test-shop-acq-bad',
      description: 'Bad',
      category: 'title',
      cost: 0,
      value: 'test-shop-acq-bad',
      acquisition: 'gifted',
    })).rejects.toThrow(/acquisition/);
  });

  test('enforces a unique sourceKey but allows many items without one', async () => {
    await ShopItem.init();
    const base = { description: 'Dup', category: 'title', cost: 0, tier: 'prestige', acquisition: 'earned' };
    await ShopItem.create({ ...base, name: 'test-shop-acq-dup-a', value: 'test-shop-acq-dup-a', sourceKey: 'test-shop-src:dup' });

    await expect(ShopItem.create({
      ...base, name: 'test-shop-acq-dup-b', value: 'test-shop-acq-dup-b', sourceKey: 'test-shop-src:dup',
    })).rejects.toMatchObject({ code: 11000 });

    await ShopItem.create({ ...base, name: 'test-shop-acq-none-a', value: 'test-shop-acq-none-a' });
    await ShopItem.create({ ...base, name: 'test-shop-acq-none-b', value: 'test-shop-acq-none-b' });
  });
});
