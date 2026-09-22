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
require('../models/Tile'); // registers the model the profile routes populate favoriteTile from

let app, user, ownedTitle, unownedTitle, ownedBackdrop;

function buildTestApp(authedUser) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    req.user = authedUser;
    next();
  });
  a.use('/api/users', require('./users'));
  return a;
}

const putProfile = body => request(app).put('/api/users/profile').send(body);

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test_showcase/ });
  await ShopItem.deleteMany({ name: /^test-showcase/ });

  ownedTitle = await ShopItem.create({
    name: 'test-showcase-title-owned',
    description: 'Owned title',
    category: 'title',
    cost: 50,
    value: 'test-showcase-owned',
  });
  unownedTitle = await ShopItem.create({
    name: 'test-showcase-title-unowned',
    description: 'Unowned title',
    category: 'title',
    cost: 50,
    value: 'test-showcase-unowned',
  });
  ownedBackdrop = await ShopItem.create({
    name: 'test-showcase-backdrop',
    description: 'Owned backdrop',
    category: 'profileBackdrop',
    cost: 50,
    value: 'flair-backdrop-test',
  });

  user = await User.create({
    displayName: 'test_showcase_user',
    email: 'test-showcase@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
    purchasedItems: [{ item: ownedTitle._id }, { item: ownedBackdrop._id }],
  });

  app = buildTestApp(user);
});

describe('PUT /api/users/profile showcase', () => {
  test('saves an owned flair entry and a stat, and returns them', async () => {
    const showcase = [
      { type: 'flair', category: 'title', value: ownedTitle.value },
      { type: 'stat', key: 'gamesWon' },
    ];

    const res = await putProfile({ showcase });

    expect(res.status).toBe(200);
    expect(res.body.data.user.showcase).toEqual(showcase);
    expect((await User.findById(user._id)).toObject().showcase).toEqual(showcase);
  });

  test('rejects pinning flair the user does not own and leaves the showcase unchanged', async () => {
    await User.findByIdAndUpdate(user._id, { showcase: [{ type: 'stat', key: 'gamesWon' }] });

    const res = await putProfile({
      showcase: [{ type: 'flair', category: 'title', value: unownedTitle.value }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not own/i);
    expect((await User.findById(user._id)).showcase).toHaveLength(1);
    expect((await User.findById(user._id)).showcase[0].key).toBe('gamesWon');
  });

  test('rejects more than three entries', async () => {
    const res = await putProfile({
      showcase: [
        { type: 'stat', key: 'gamesWon' },
        { type: 'stat', key: 'gamesPlayed' },
        { type: 'stat', key: 'highestScore' },
        { type: 'stat', key: 'averageScore' },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 3/i);
  });

  test('rejects a favorite the user has not set', async () => {
    const res = await putProfile({ showcase: [{ type: 'favoriteYaku' }] });

    expect(res.status).toBe(400);
  });

  test('rejects a showcase that is not a list', async () => {
    const res = await putProfile({ showcase: 'everything' });

    expect(res.status).toBe(400);
  });

  test('clears the showcase when given an empty list', async () => {
    await User.findByIdAndUpdate(user._id, { showcase: [{ type: 'stat', key: 'gamesWon' }] });

    const res = await putProfile({ showcase: [] });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).showcase).toHaveLength(0);
  });

  test('accepts a favorite pin when the same request sets that favorite', async () => {
    const res = await putProfile({ favoriteYaku: 'Riichi', showcase: [{ type: 'favoriteYaku' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.user.showcase).toEqual([{ type: 'favoriteYaku' }]);
  });

  test('drops a favorite pin when the favorite is cleared without resending the showcase', async () => {
    await User.findByIdAndUpdate(user._id, {
      favoriteYaku: 'Riichi',
      showcase: [{ type: 'favoriteYaku' }, { type: 'stat', key: 'gamesWon' }],
    });

    const res = await putProfile({ favoriteYaku: null });

    expect(res.status).toBe(200);
    expect(res.body.data.user.showcase).toEqual([{ type: 'stat', key: 'gamesWon' }]);
  });

  test('does not populate purchasedItems in the response', async () => {
    const res = await putProfile({ showcase: [] });

    expect(res.body.data.user.purchasedItems[0].item).toBe(ownedTitle._id.toString());
  });

  test('leaves the showcase alone when the request does not mention it', async () => {
    await User.findByIdAndUpdate(user._id, { showcase: [{ type: 'stat', key: 'gamesWon' }] });

    const res = await putProfile({ clubAffiliation: 'Charlotte' });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).showcase).toHaveLength(1);
  });
});

describe('GET /api/users/:id profile-only flair', () => {
  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      'equippedFlair.profileBackdrop': ownedBackdrop.value,
      showcase: [{ type: 'stat', key: 'gamesWon' }],
    });
  });

  test('serves the backdrop and showcase on a public profile', async () => {
    const res = await request(app).get(`/api/users/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.equippedFlair.profileBackdrop).toBe(ownedBackdrop.value);
    expect(res.body.data.user.showcase).toEqual([{ type: 'stat', key: 'gamesWon' }]);
  });

  test('withholds the backdrop and showcase when the profile is private', async () => {
    await User.findByIdAndUpdate(user._id, { privateMode: true });

    const res = await request(app).get(`/api/users/${user._id}`);

    expect(res.body.data.user.equippedFlair.profileBackdrop).toBeNull();
    expect(res.body.data.user.showcase).toEqual([]);
  });

  test('the member list does not carry the backdrop or showcase', async () => {
    const res = await request(app).get('/api/users?limit=100');

    const member = res.body.data.items.find(u => u._id === user._id.toString());
    expect(member).toBeDefined();
    expect(member.equippedFlair.profileBackdrop).toBeUndefined();
    expect(member.showcase).toBeUndefined();
  });
});
