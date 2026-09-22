process.env.JWT_SECRET = 'test-secret-auth-lastactive';

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const { authenticateToken, generateToken } = require('./auth');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function buildTestApp() {
  const app = express();
  app.use(authenticateToken);
  app.get('/protected', (req, res) => res.json({ success: true }));
  return app;
}

let user;

beforeEach(async () => {
  await User.deleteMany({ displayName: /^test-auth-lastactive/ });
  user = await User.create({
    displayName: 'test-auth-lastactive-user',
    email: 'test-auth-lastactive@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

describe('authenticateToken lastActiveAt tracking', () => {
  test('sets lastActiveAt on first authenticated request', async () => {
    const token = generateToken(user._id);

    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.lastActiveAt).toBeInstanceOf(Date);
  });

  test('updates lastActiveAt when the stored value is from a previous week', async () => {
    const token = generateToken(user._id);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: twoWeeksAgo } });

    await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    const updated = await User.findById(user._id);
    expect(updated.lastActiveAt.getTime()).toBeGreaterThan(twoWeeksAgo.getTime());
  });

  test('does not write to the database when lastActiveAt is already within the current week', async () => {
    const token = generateToken(user._id);
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } });
    const updateSpy = jest.spyOn(User, 'updateOne');

    await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
