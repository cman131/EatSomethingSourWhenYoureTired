const mongoose = require('mongoose');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const {
  awardPoints,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
} = require('./pointsService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

let user;

beforeEach(async () => {
  // Scoped to this suite's users: Jest runs suites in parallel against the same database
  const staleUsers = await User.find({ displayName: /^test-points/ }).select('_id');
  await PointTransaction.deleteMany({ user: { $in: staleUsers.map(u => u._id) } });
  await User.deleteMany({ displayName: /^test-points/ });
  user = await User.create({
    displayName: 'test-points-user',
    email: 'test-points@example.com',
    password: 'password123',
    clubAffiliation: 'Charleston',
  });
});

describe('awardPoints', () => {
  test('creates a PointTransaction document', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx).not.toBeNull();
    expect(tx.type).toBe('game_played');
    expect(tx.amount).toBe(5);
  });

  test('increments pointsBalance on the user', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(5);
  });

  test('increments totalPointsEarned on the user', async () => {
    await awardPoints(user._id, 'game_played', 5, {});

    const updated = await User.findById(user._id);
    expect(updated.totalPointsEarned).toBe(5);
  });

  test('stores optional metadata', async () => {
    const gameId = new mongoose.Types.ObjectId();
    await awardPoints(user._id, 'game_submitted', 10, { gameId });

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx.metadata.gameId.toString()).toBe(gameId.toString());
  });

  test('accumulates across multiple awards', async () => {
    await awardPoints(user._id, 'game_played', 5, {});
    await awardPoints(user._id, 'game_submitted', 10, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(15);
    expect(updated.totalPointsEarned).toBe(15);
  });

  test('does not award points to guest users', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });

    await awardPoints(guest._id, 'game_placement_1', 10, {});

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
    const updated = await User.findById(guest._id);
    expect(updated.pointsBalance).toBe(0);
    expect(updated.totalPointsEarned).toBe(0);
  });
});

describe('spendPoints', () => {
  test('decrements pointsBalance only (not totalPointsEarned)', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 50, totalPointsEarned: 50 });

    await spendPoints(user._id, 20, {});

    const updated = await User.findById(user._id);
    expect(updated.pointsBalance).toBe(30);
    expect(updated.totalPointsEarned).toBe(50);
  });

  test('creates a negative PointTransaction', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 50, totalPointsEarned: 50 });

    await spendPoints(user._id, 20, {});

    const tx = await PointTransaction.findOne({ user: user._id });
    expect(tx.type).toBe('shop_purchase');
    expect(tx.amount).toBe(-20);
  });

  test('throws when balance is insufficient', async () => {
    await User.findByIdAndUpdate(user._id, { pointsBalance: 10 });

    await expect(spendPoints(user._id, 20, {})).rejects.toThrow('Insufficient points balance');
  });
});

describe('awardGamePoints', () => {
  let p1, p2, p3, p4;

  beforeEach(async () => {
    [p1, p2, p3, p4] = await User.create([
      { displayName: 'test-points-p1', email: 'p1@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p2', email: 'p2@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p3', email: 'p3@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p4', email: 'p4@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    ]);
  });

  test('awards correct placement type and amount to each player', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const cases = [
      { user: p1._id, type: 'game_placement_1', amount: 10 },
      { user: p2._id, type: 'game_placement_2', amount: 7 },
      { user: p3._id, type: 'game_placement_3', amount: 4 },
      { user: p4._id, type: 'game_placement_4', amount: 2 },
    ];

    for (const { user, type, amount } of cases) {
      const tx = await PointTransaction.findOne({ user, type });
      expect(tx).not.toBeNull();
      expect(tx.amount).toBe(amount);
    }
  });

  test('awards game_submitted (+2) to the submitter after rebalance', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p1._id, type: 'game_submitted' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(2);
  });

  test('awards game_verified (+1) to the verifier after rebalance', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p2._id, type: 'game_verified' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(1);
  });

  test('submitter who finishes 1st gets game_placement_1 and game_submitted (total 12)', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const updated = await User.findById(p1._id);
    expect(updated.pointsBalance).toBe(12); // 10 (placement_1) + 2 (submitted)
  });

  test('does not award placement points to guest players', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: guest._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p3._id);

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
    expect(await PointTransaction.countDocuments({ user: p1._id, type: 'game_placement_1' })).toBe(1);
  });
});

describe('awardTournamentPoints', () => {
  let players;

  beforeEach(async () => {
    players = await User.create([1, 2, 3, 4, 5].map(n => ({
      displayName: `test-points-t${n}`,
      email: `t${n}@example.com`,
      password: 'password123',
      clubAffiliation: 'Charleston',
    })));
  });

  function makeTournament({ dropped = [], top4 = players.slice(0, 4) } = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      players: players.map(p => ({ player: p._id, dropped: dropped.includes(p) })),
      top4: top4.map(p => p._id),
    };
  }

  const balanceOf = async user => (await User.findById(user._id)).pointsBalance;

  test('awards 200/100/70/50 for 1st-4th plus 15 participation', async () => {
    await awardTournamentPoints(makeTournament());

    expect(await balanceOf(players[0])).toBe(215);
    expect(await balanceOf(players[1])).toBe(115);
    expect(await balanceOf(players[2])).toBe(85);
    expect(await balanceOf(players[3])).toBe(65);
    expect(await balanceOf(players[4])).toBe(15);
  });

  test('records the placement type and tournament id on each placement transaction', async () => {
    const tournament = makeTournament();

    await awardTournamentPoints(tournament);

    const tx = await PointTransaction.findOne({ user: players[0]._id, type: 'tournament_placement_1' });
    expect(tx.amount).toBe(200);
    expect(tx.metadata.tournamentId.toString()).toBe(tournament._id.toString());
    expect(tx.metadata.placement).toBe(1);
  });

  test('gives a dropped player neither participation nor placement points', async () => {
    await awardTournamentPoints(makeTournament({ dropped: [players[1]] }));

    expect(await PointTransaction.countDocuments({ user: players[1]._id })).toBe(0);
    expect(await balanceOf(players[1])).toBe(0);
    expect(await balanceOf(players[0])).toBe(215);
  });

  test('does not shift other players up when a placed player has dropped', async () => {
    await awardTournamentPoints(makeTournament({ dropped: [players[0]] }));

    expect(await balanceOf(players[1])).toBe(115); // still 2nd place
    const playerIds = players.map(p => p._id);
    expect(
      await PointTransaction.countDocuments({ user: { $in: playerIds }, type: 'tournament_placement_1' })
    ).toBe(0);
  });

  test('is idempotent when called twice for the same tournament', async () => {
    const tournament = makeTournament();

    await awardTournamentPoints(tournament);
    await awardTournamentPoints(tournament);

    expect(await balanceOf(players[0])).toBe(215);
    expect(await balanceOf(players[4])).toBe(15);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(2);
  });

  test('does not award guest players', async () => {
    const guest = await User.create({ displayName: 'test-points-guest', isGuest: true });
    const tournament = makeTournament({ top4: [guest, players[1], players[2], players[3]] });
    tournament.players.push({ player: guest._id, dropped: false });

    await awardTournamentPoints(tournament);

    expect(await PointTransaction.countDocuments({ user: guest._id })).toBe(0);
  });
});

describe('awardRankedQualificationPoints', () => {
  test('awards 10 points with the league id recorded', async () => {
    const leagueId = new mongoose.Types.ObjectId();

    await awardRankedQualificationPoints(user._id, leagueId);

    const tx = await PointTransaction.findOne({ user: user._id, type: 'ranked_league_qualified' });
    expect(tx.amount).toBe(10);
    expect(tx.metadata.leagueId.toString()).toBe(leagueId.toString());
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });

  test('awards only once per league', async () => {
    const leagueId = new mongoose.Types.ObjectId();

    await awardRankedQualificationPoints(user._id, leagueId);
    await awardRankedQualificationPoints(user._id, leagueId);

    expect(await PointTransaction.countDocuments({ user: user._id })).toBe(1);
    expect((await User.findById(user._id)).pointsBalance).toBe(10);
  });

  test('awards again in a different league', async () => {
    await awardRankedQualificationPoints(user._id, new mongoose.Types.ObjectId());
    await awardRankedQualificationPoints(user._id, new mongoose.Types.ObjectId());

    expect((await User.findById(user._id)).pointsBalance).toBe(20);
  });
});
