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
require('../models/Tile'); // registers the model GET /:id populates favoriteTile from

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

describe('GET /api/users/:id owner-only field visibility', () => {
  let owner, viewer, admin;

  beforeEach(async () => {
    await User.deleteMany({ displayName: /^test_visibility/ });

    owner = await User.create({
      displayName: 'test_visibility_owner',
      email: 'visibility-owner@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
      pointsBalance: 42,
      totalPointsEarned: 100,
    });

    viewer = await User.create({
      displayName: 'test_visibility_viewer',
      email: 'visibility-viewer@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    admin = await User.create({
      displayName: 'test_visibility_admin',
      email: 'visibility-admin@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
      isAdmin: true,
    });
  });

  test('hides balance, purchases, email and notification settings from another member', async () => {
    const app = buildTestApp(viewer);

    const res = await request(app).get(`/api/users/${owner._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.pointsBalance).toBeUndefined();
    expect(res.body.data.user.purchasedItems).toBeUndefined();
    expect(res.body.data.user.email).toBeUndefined();
    expect(res.body.data.user.notifications).toBeUndefined();
    expect(res.body.data.user.notificationPreferences).toBeUndefined();
  });

  test('still shows lifetime points earned to another member', async () => {
    const app = buildTestApp(viewer);

    const res = await request(app).get(`/api/users/${owner._id}`);

    expect(res.body.data.user.totalPointsEarned).toBe(100);
  });

  test('shows owner-only fields when the profile owner views their own profile via :id', async () => {
    const app = buildTestApp(owner);

    const res = await request(app).get(`/api/users/${owner._id}`);

    expect(res.body.data.user.pointsBalance).toBe(42);
    expect(res.body.data.user.email).toBe('visibility-owner@example.com');
  });

  test('shows owner-only fields to an admin viewing another member', async () => {
    const app = buildTestApp(admin);

    const res = await request(app).get(`/api/users/${owner._id}`);

    expect(res.body.data.user.pointsBalance).toBe(42);
    expect(res.body.data.user.email).toBe('visibility-owner@example.com');
  });
});
