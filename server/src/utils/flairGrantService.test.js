const mongoose = require('mongoose');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const PointTransaction = require('../models/PointTransaction');
const {
  grantEarnedTitle,
  grantTournamentChampionTitle,
  grantSeasonChampionTitles,
  GRANT_KIND,
} = require('./flairGrantService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  await ShopItem.deleteMany({ sourceKey: /^ranked_season:/ });
  await mongoose.connection.close();
});

let player;
let otherPlayer;

const newRefId = () => new mongoose.Types.ObjectId();
const grantSpring = (userId, refId) =>
  grantEarnedTitle(userId, { kind: GRANT_KIND.Tournament, refId, label: 'test-grant Spring Open' });
const itemsFor = refId => ShopItem.find({ sourceKey: `tournament:${refId}` });

async function createPlayer(name) {
  return User.create({
    displayName: name,
    email: `${name}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
    pointsBalance: 40,
    totalPointsEarned: 40,
  });
}

beforeEach(async () => {
  await ShopItem.init();
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  await ShopItem.deleteMany({ sourceKey: /^ranked_season:/ });
  player = await createPlayer('test-grant-player');
  otherPlayer = await createPlayer('test-grant-other');
});

describe('grantEarnedTitle', () => {
  test('creates an earned prestige title and grants it to the player', async () => {
    const refId = newRefId();

    const item = await grantSpring(player._id, refId);

    expect(item.name).toBe('🏆 test-grant Spring Open');
    expect(item.value).toBe('🏆 test-grant Spring Open');
    expect(item.category).toBe('title');
    expect(item.tier).toBe('prestige');
    expect(item.acquisition).toBe('earned');
    expect(item.cost).toBe(0);
    expect(item.isActive).toBe(true);
    expect(item.sourceKey).toBe(`tournament:${refId}`);

    const updated = await User.findById(player._id);
    expect(updated.purchasedItems).toHaveLength(1);
    expect(updated.purchasedItems[0].item.toString()).toBe(item._id.toString());
    expect(updated.purchasedItems[0].source.kind).toBe('tournament');
    expect(updated.purchasedItems[0].source.refId.toString()).toBe(refId.toString());
    expect(updated.purchasedItems[0].source.label).toBe('test-grant Spring Open');
  });

  test('granting twice for the same event leaves one item and one entry', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(player._id, refId);

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('concurrent grants for the same event converge on one item and one entry', async () => {
    const refId = newRefId();

    await Promise.all(Array.from({ length: 5 }, () => grantSpring(player._id, refId)));

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('two players granted for one event share the single item', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(otherPlayer._id, refId);

    const items = await itemsFor(refId);
    expect(items).toHaveLength(1);
    const first = await User.findById(player._id);
    const second = await User.findById(otherPlayer._id);
    expect(first.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
    expect(second.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
  });

  test('different events give the same player separate items', async () => {
    await grantSpring(player._id, newRefId());
    await grantSpring(player._id, newRefId());

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(2);
  });

  test('does not touch points', async () => {
    await grantSpring(player._id, newRefId());

    const updated = await User.findById(player._id);
    expect(updated.pointsBalance).toBe(40);
    expect(updated.totalPointsEarned).toBe(40);
    expect(await PointTransaction.countDocuments({ user: player._id })).toBe(0);
  });

  // Closes the loop between the grant service and the shop's own purchasability rule (Task 8):
  // an item this function creates must actually be excluded, not just carry fields that look right.
  test('the granted item is excluded from the shop by isPurchasable and purchasableItemsFilter', async () => {
    const { isPurchasable, purchasableItemsFilter } = require('./shopService');
    const refId = newRefId();

    const item = await grantSpring(player._id, refId);

    expect(isPurchasable(item)).toBe(false);
    const listed = await ShopItem.findOne({ _id: item._id, ...purchasableItemsFilter() });
    expect(listed).toBeNull();
  });

  test('does not grant to guest users', async () => {
    const guest = await User.create({ displayName: 'test-grant-guest', isGuest: true });

    await grantSpring(guest._id, newRefId());

    expect((await User.findById(guest._id)).purchasedItems).toHaveLength(0);
  });

  test('does not throw for a user that no longer exists', async () => {
    await expect(grantSpring(new mongoose.Types.ObjectId(), newRefId())).resolves.toBeDefined();
  });
});

describe('grantTournamentChampionTitle', () => {
  const makeTournament = (overrides = {}) => ({
    _id: newRefId(),
    name: 'test-grant Spring Open 2026',
    players: [
      { player: player._id, dropped: false },
      { player: otherPlayer._id, dropped: false },
    ],
    top4: [player._id, otherPlayer._id],
    ...overrides,
  });

  test('grants the winner a title built from winnerTitle', async () => {
    const tournament = makeTournament({ winnerTitle: 'test-grant Champ' });

    await grantTournamentChampionTitle(tournament);

    const updated = await User.findById(player._id).populate('purchasedItems.item');
    expect(updated.purchasedItems).toHaveLength(1);
    expect(updated.purchasedItems[0].item.value).toBe('🏆 test-grant Champ');
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
  });

  test('falls back to the truncated tournament name when winnerTitle is blank', async () => {
    const tournament = makeTournament({ name: 'test-grant Spring Open 2026' });

    await grantTournamentChampionTitle(tournament);

    const updated = await User.findById(player._id).populate('purchasedItems.item');
    expect(updated.purchasedItems[0].item.value).toBe('🏆 test-grant Spring Open 2026');
  });

  test('accepts a top4 entry that is a populated user document', async () => {
    const tournament = makeTournament({ top4: [player, otherPlayer] });

    await grantTournamentChampionTitle(tournament);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('skips a winner who dropped', async () => {
    const tournament = makeTournament({
      players: [
        { player: player._id, dropped: true },
        { player: otherPlayer._id, dropped: false },
      ],
    });

    await grantTournamentChampionTitle(tournament);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(0);
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
  });

  test('does nothing when the tournament has no top4', async () => {
    await expect(grantTournamentChampionTitle(makeTournament({ top4: [] }))).resolves.toBeUndefined();
  });

  test('replaying completion grants nothing new', async () => {
    const tournament = makeTournament({ winnerTitle: 'test-grant Champ' });

    await grantTournamentChampionTitle(tournament);
    await grantTournamentChampionTitle(tournament);

    expect(await itemsFor(tournament._id)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });
});

describe('grantSeasonChampionTitles', () => {
  let third;

  const makeLeague = standings => ({
    _id: newRefId(),
    startDate: new Date(Date.UTC(2026, 0, 15)),
    players: standings,
  });

  beforeEach(async () => {
    third = await createPlayer('test-grant-third');
  });

  test('grants only the top qualified player, labelled by season start', async () => {
    const league = makeLeague([
      { player: player._id, rankedPoints: 560, gamesPlayed: 5 },
      { player: otherPlayer._id, rankedPoints: 530, gamesPlayed: 4 },
      { player: third._id, rankedPoints: 900, gamesPlayed: 2 },
    ]);

    await grantSeasonChampionTitles(league);

    const champion = await User.findById(player._id).populate('purchasedItems.item');
    expect(champion.purchasedItems).toHaveLength(1);
    expect(champion.purchasedItems[0].item.value).toBe('🏆 Season Champion: Jan 2026');
    expect(champion.purchasedItems[0].source.kind).toBe('ranked_season');
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
    expect((await User.findById(third._id)).purchasedItems).toHaveLength(0);
  });

  test('grants every player tied for first', async () => {
    const league = makeLeague([
      { player: player._id, rankedPoints: 560, gamesPlayed: 5 },
      { player: otherPlayer._id, rankedPoints: 560, gamesPlayed: 4 },
      { player: third._id, rankedPoints: 510, gamesPlayed: 3 },
    ]);

    await grantSeasonChampionTitles(league);

    const first = await User.findById(player._id);
    const second = await User.findById(otherPlayer._id);
    expect(first.purchasedItems).toHaveLength(1);
    expect(second.purchasedItems).toHaveLength(1);
    expect(first.purchasedItems[0].item.toString()).toBe(second.purchasedItems[0].item.toString());
    expect((await User.findById(third._id)).purchasedItems).toHaveLength(0);
  });

  test('does nothing when nobody qualified', async () => {
    const league = makeLeague([{ player: player._id, rankedPoints: 600, gamesPlayed: 2 }]);

    await grantSeasonChampionTitles(league);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(0);
  });

  test('replaying the payout grants nothing new', async () => {
    const league = makeLeague([{ player: player._id, rankedPoints: 560, gamesPlayed: 5 }]);

    await grantSeasonChampionTitles(league);
    await grantSeasonChampionTitles(league);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
    expect(await ShopItem.countDocuments({ sourceKey: `ranked_season:${league._id}` })).toBe(1);
  });
});
