const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const tournamentRoutes = require('./tournaments');

process.env.JWT_SECRET = 'test-secret-signup-route';

const app = express();
app.use(express.json());
app.use('/api/tournaments', tournamentRoutes);
app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: err.message });
});

let testUser;
let authToken;

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);

  testUser = await User.create({
    email: `signup-test-${Date.now()}@example.com`,
    displayName: `SignupTestUser${Date.now()}`,
    password: 'testpassword123'
  });

  authToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  if (testUser) {
    await User.deleteOne({ _id: testUser._id });
  }
  await mongoose.connection.close();
});

describe('POST /api/tournaments/:id/signup', () => {
  test('returns 404 when tournament does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/tournaments/${nonExistentId}/signup`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Tournament not found');
  });
});
