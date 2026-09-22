const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const RankedLeague = require('../models/RankedLeague');
const ShopItem = require('../models/ShopItem');

const toDateLabel = date => date.toISOString().slice(0, 10);

// Ordered by precedence: a transaction is described by the first metadata key it carries.
const CONTEXT_SOURCES = [
  {
    kind: 'shopItem',
    metadataKey: 'itemId',
    load: ids => ShopItem.find({ _id: { $in: ids } }).select('name').lean(),
    toLabel: item => item.name,
  },
  {
    kind: 'game',
    metadataKey: 'gameId',
    load: ids => Game.find({ _id: { $in: ids } }).select('gameDate').lean(),
    toLabel: game => `Game played ${toDateLabel(game.gameDate)}`,
  },
  {
    // A game_points_reversal row references the game via reversedGameId (not gameId) so it doesn't
    // collide with the per-game unique index — see the comment on that field in PointTransaction.js.
    kind: 'game',
    metadataKey: 'reversedGameId',
    load: ids => Game.find({ _id: { $in: ids } }).select('gameDate').lean(),
    toLabel: game => `Game played ${toDateLabel(game.gameDate)}`,
  },
  {
    kind: 'tournament',
    metadataKey: 'tournamentId',
    load: ids => Tournament.find({ _id: { $in: ids } }).select('name').lean(),
    toLabel: tournament => tournament.name,
  },
  {
    kind: 'rankedSeason',
    metadataKey: 'leagueId',
    load: ids => RankedLeague.find({ _id: { $in: ids } }).select('startDate').lean(),
    toLabel: league => `Ranked season starting ${toDateLabel(league.startDate)}`,
  },
];

function findSource(transaction) {
  return CONTEXT_SOURCES.find(source => transaction.metadata?.[source.metadataKey]);
}

async function loadLabels(transactions) {
  const labelsByKind = {};
  await Promise.all(CONTEXT_SOURCES.map(async source => {
    const ids = transactions
      .filter(tx => findSource(tx) === source)
      .map(tx => tx.metadata[source.metadataKey]);
    const labels = new Map();
    if (ids.length > 0) {
      const docs = await source.load(ids);
      docs.forEach(doc => labels.set(doc._id.toString(), source.toLabel(doc)));
    }
    labelsByKind[source.kind] = labels;
  }));
  return labelsByKind;
}

function buildContext(transaction, labelsByKind) {
  // The reason is stored inline on the transaction rather than resolved from another
  // collection, so it skips the id/label batching the other context sources use.
  if (transaction.type === 'admin_adjustment') {
    return { kind: 'adjustment', id: null, label: transaction.metadata?.reason ?? null, missing: false };
  }

  const source = findSource(transaction);
  if (!source) {
    return null;
  }

  const id = transaction.metadata[source.metadataKey].toString();
  const label = labelsByKind[source.kind].get(id) ?? null;
  return { kind: source.kind, id, label, missing: label === null };
}

// Describes what each (lean) transaction was for; `missing` flags references whose document was deleted.
async function attachHistoryContext(transactions) {
  const labelsByKind = await loadLabels(transactions);
  return transactions.map(tx => ({ ...tx, context: buildContext(tx, labelsByKind) }));
}

module.exports = { attachHistoryContext };
