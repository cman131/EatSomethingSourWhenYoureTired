const mongoose = require('mongoose');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const PointTransaction = require('../models/PointTransaction');
const ShopItem = require('../models/ShopItem');
const { replayTournamentPoints } = require('./tournamentPointsReplay');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  const staleUsers = await User.find({ displayName: /^test-treplay/ }).select('_id');
  const staleIds = staleUsers.map(u => u._id);
  await PointTransaction.deleteMany({ user: { $in: staleIds } });
  await ShopItem.deleteMany({ name: /^🏆 test-treplay/ });
  await Tournament.deleteMany({ name: /^test-treplay/ });
  await User.deleteMany({ displayName: /^test-treplay/ });
  await mongoose.connection.close();
});

let players;

beforeEach(async () => {
  // Scoped to this suite's users: Jest runs suites in parallel against the same database
  const staleUsers = await User.find({ displayName: /^test-treplay/ }).select('_id');
  const staleIds = staleUsers.map(u => u._id);
  await PointTransaction.deleteMany({ user: { $in: staleIds } });
  await ShopItem.deleteMany({ name: /^🏆 test-treplay/ });
  await Tournament.deleteMany({ name: /^test-treplay/ });
  await User.deleteMany({ displayName: /^test-treplay/ });

  players = await User.create([1, 2, 3, 4].map(n => ({
    displayName: `test-treplay-p${n}`,
    email: `treplay-p${n}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
  })));
});

function makeTournamentDoc(overrides = {}) {
  return Tournament.create({
    name: 'test-treplay Spring Open',
    date: new Date(),
    isOnline: true,
    onlineLocation: 'https://example.com/table',
    createdBy: players[0]._id,
    status: 'Completed',
    players: players.map(p => ({ player: p._id, dropped: false })),
    top4: players.map(p => p._id),
    ...overrides,
  });
}

const balanceOf = async user => (await User.findById(user._id)).pointsBalance;
const itemsFor = tournamentId => ShopItem.find({ sourceKey: `tournament:${tournamentId}` });

describe('replayTournamentPoints', () => {
  test('awards tournament points and grants the champion title for a completed tournament missing both', async () => {
    const tournament = await makeTournamentDoc();

    const summary = await replayTournamentPoints({ tournamentId: tournament._id });

    expect(summary).toEqual({ examined: 1, replayed: [tournament._id.toString()], failed: [] });
    expect(await balanceOf(players[0])).toBe(215); // 200 placement_1 + 15 participation
    expect(await balanceOf(players[3])).toBe(65); // 50 placement_4 + 15 participation
    const updatedWinner = await User.findById(players[0]._id).populate('purchasedItems.item');
    expect(updatedWinner.purchasedItems[0].item.value).toBe('🏆 test-treplay Spring Open');
  });

  test('replaying an already-awarded tournament is a no-op', async () => {
    const tournament = await makeTournamentDoc();
    await replayTournamentPoints({ tournamentId: tournament._id });

    await replayTournamentPoints({ tournamentId: tournament._id });

    expect(await balanceOf(players[0])).toBe(215);
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(2); // placement_1 + participation
    expect(await itemsFor(tournament._id)).toHaveLength(1);
  });

  test('excludes a dropped top-4 player from placement points and the title', async () => {
    const tournament = await makeTournamentDoc({
      players: [
        { player: players[0]._id, dropped: true },
        ...players.slice(1).map(p => ({ player: p._id, dropped: false })),
      ],
    });

    await replayTournamentPoints({ tournamentId: tournament._id });

    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(0);
    expect((await User.findById(players[0]._id)).purchasedItems).toHaveLength(0);
  });

  test('tournamentId targets exactly one tournament regardless of other Completed tournaments', async () => {
    const target = await makeTournamentDoc();
    const other = await makeTournamentDoc({ name: 'test-treplay Other Open' });

    const summary = await replayTournamentPoints({ tournamentId: target._id });

    expect(summary.examined).toBe(1);
    expect(summary.replayed).toEqual([target._id.toString()]);
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': other._id })).toBe(0);
  });

  test('sweeps every Completed tournament when no tournamentId is given', async () => {
    const first = await makeTournamentDoc();
    const second = await makeTournamentDoc({ name: 'test-treplay Second Open' });

    const summary = await replayTournamentPoints({});

    // Asserts on this suite's own ids rather than the exact total, since the sweep queries every
    // Completed tournament in the shared test database, not just this suite's fixtures.
    expect(summary.replayed).toEqual(
      expect.arrayContaining([first._id.toString(), second._id.toString()])
    );
  });

  test('does not sweep a tournament that is not Completed', async () => {
    const inProgress = await makeTournamentDoc({ status: 'InProgress' });

    const summary = await replayTournamentPoints({});

    expect(summary.replayed).not.toContain(inProgress._id.toString());
  });

  test('dry run makes no writes but reports the tournament as examined', async () => {
    const tournament = await makeTournamentDoc();

    const summary = await replayTournamentPoints({ tournamentId: tournament._id, dryRun: true });

    expect(summary).toEqual({ examined: 1, replayed: [tournament._id.toString()], failed: [] });
    expect(await PointTransaction.countDocuments({ user: players[0]._id })).toBe(0);
    expect(await itemsFor(tournament._id)).toHaveLength(0);
  });

  test('a failing tournament is reported and does not stop the others', async () => {
    const failing = await makeTournamentDoc();
    const passing = await makeTournamentDoc({ name: 'test-treplay Passing Open' });
    const realCreate = PointTransaction.create.bind(PointTransaction);
    const createSpy = jest.spyOn(PointTransaction, 'create').mockImplementation(async doc => {
      if (doc.metadata.tournamentId && doc.metadata.tournamentId.toString() === failing._id.toString()) {
        throw new Error('db down');
      }
      return realCreate(doc);
    });

    const summary = await replayTournamentPoints({});
    createSpy.mockRestore();

    expect(summary.replayed).toContain(passing._id.toString());
    expect(summary.replayed).not.toContain(failing._id.toString());
    expect(summary.failed).toEqual(
      expect.arrayContaining([expect.objectContaining({ tournamentId: failing._id.toString() })])
    );
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': failing._id })).toBe(0);
    expect(await PointTransaction.countDocuments({ 'metadata.tournamentId': passing._id })).toBeGreaterThan(0);
  });
});
