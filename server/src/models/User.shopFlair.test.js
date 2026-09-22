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
  const populateFields = () => require('./User').PLAYER_POPULATE_FIELDS.split(/\s+/);

  test.each(['nameColor', 'nameIcon', 'profileBorder', 'title'])(
    'includes equippedFlair.%s so flair renders in game rows and member lists',
    slot => {
      expect(populateFields()).toContain(`equippedFlair.${slot}`);
    }
  );

  test('leaves the profile-only backdrop and showcase out of player payloads', () => {
    expect(populateFields()).not.toContain('equippedFlair');
    expect(populateFields()).not.toContain('equippedFlair.profileBackdrop');
    expect(populateFields()).not.toContain('showcase');
  });

  test('selecting it returns the four inline slots but not the backdrop', async () => {
    const created = await User.create({
      displayName: 'test-flair-populate',
      email: 'test-flair-populate@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
      equippedFlair: { nameColor: 'flair-color-pink', profileBackdrop: 'flair-backdrop-shoji' },
    });

    const found = await User.findById(created._id).select(require('./User').PLAYER_POPULATE_FIELDS);

    expect(found.equippedFlair.nameColor).toBe('flair-color-pink');
    expect(found.equippedFlair.profileBackdrop).toBeUndefined();
  });
});

describe('User.equippedFlair schema', () => {
  test('has exactly one slot per shared flair category', () => {
    const { FLAIR_CATEGORIES } = require('../data/flairCategories');
    const slots = Object.keys(User.schema.paths)
      .filter(p => p.startsWith('equippedFlair.'))
      .map(p => p.replace('equippedFlair.', ''));
    expect(slots.sort()).toEqual([...FLAIR_CATEGORIES].sort());
  });
});

describe('User private mode', () => {
  const buildPrivateUser = privateMode => new User({
    displayName: 'test-flair-private',
    email: 'test-flair-private@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
    privateMode,
    equippedFlair: { nameColor: 'flair-color-pink', profileBackdrop: 'flair-backdrop-shoji' },
    showcase: [{ type: 'favoriteYaku' }],
  });

  test('toJSON hides the backdrop and showcase but keeps inline flair in private mode', () => {
    const json = buildPrivateUser(true).toJSON();
    expect(json.equippedFlair.profileBackdrop).toBeNull();
    expect(json.equippedFlair.nameColor).toBe('flair-color-pink');
    expect(json.showcase).toEqual([]);
  });

  test('toJSON keeps the backdrop and showcase when the profile is public', () => {
    const json = buildPrivateUser(false).toJSON();
    expect(json.equippedFlair.profileBackdrop).toBe('flair-backdrop-shoji');
    expect(json.showcase).toEqual([{ type: 'favoriteYaku' }]);
  });
});

describe('User showcase', () => {
  const buildWithShowcase = showcase => new User({
    displayName: 'test-flair-showcase',
    email: 'test-flair-showcase@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
    showcase,
  });

  test('defaults to an empty list', () => {
    expect(buildWithShowcase(undefined).showcase).toHaveLength(0);
  });

  test('accepts up to three entries', async () => {
    const user = buildWithShowcase([
      { type: 'flair', category: 'title', value: 'Regular' },
      { type: 'stat', key: 'gamesWon' },
      { type: 'favoriteTile' },
    ]);
    await expect(user.validate()).resolves.toBeUndefined();
  });

  test('rejects more than three entries', async () => {
    const user = buildWithShowcase([
      { type: 'favoriteYaku' },
      { type: 'favoriteTile' },
      { type: 'stat', key: 'gamesWon' },
      { type: 'stat', key: 'gamesPlayed' },
    ]);
    await expect(user.validate()).rejects.toThrow(/showcase/);
  });

  test('rejects an unknown entry type', async () => {
    await expect(buildWithShowcase([{ type: 'achievement' }]).validate()).rejects.toThrow();
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

describe('User flairLoadouts', () => {
  test('new user has an empty flairLoadouts array', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-new',
      email: 'test-flair-loadouts-new@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    expect(user.flairLoadouts).toHaveLength(0);
  });

  test('can add a flairLoadout with all four slots', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-add',
      email: 'test-flair-loadouts-add@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({
      name: 'Tournament Look',
      nameColor: 'flair-color-gold',
      nameIcon: '🐉',
      profileBorder: 'flair-border-hanabi',
      title: 'Chicken Farmer',
    });
    await user.save();

    const found = await User.findById(user._id);
    expect(found.flairLoadouts).toHaveLength(1);
    expect(found.flairLoadouts[0].name).toBe('Tournament Look');
    expect(found.flairLoadouts[0].nameColor).toBe('flair-color-gold');
    expect(found.flairLoadouts[0].title).toBe('Chicken Farmer');
  });

  test('a flairLoadout slot defaults to null when omitted', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-partial',
      email: 'test-flair-loadouts-partial@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({ name: 'Just a color', nameColor: 'flair-color-pink' });
    await user.save();

    const found = await User.findById(user._id);
    expect(found.flairLoadouts[0].nameIcon).toBeNull();
    expect(found.flairLoadouts[0].profileBorder).toBeNull();
    expect(found.flairLoadouts[0].title).toBeNull();
  });

  test('rejects a flairLoadout with no name', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-noname',
      email: 'test-flair-loadouts-noname@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({ nameColor: 'flair-color-pink' });
    await expect(user.save()).rejects.toThrow(/name/i);
  });
});
