const mongoose = require('mongoose');

const POINT_TRANSACTION_TYPES = [
  'game_played',       // retirement pending — run a one-time migration to confirm no active user holds this type before removing
  'game_placement_1',
  'game_placement_2',
  'game_placement_3',
  'game_placement_4',
  'game_submitted',
  'game_verified',
  'tournament_participated',
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
  'ranked_league_qualified',
  'ranked_league_placement_1',
  'ranked_league_placement_2',
  'ranked_league_placement_3',
  'shop_purchase',
];

const pointTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: POINT_TRANSACTION_TYPES,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  // Mongoose strict mode silently drops undeclared keys, so any new metadata key must be declared here.
  metadata: {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem', default: null },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', default: null },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'RankedLeague', default: null },
    placement: { type: Number, default: null },
  },
}, {
  timestamps: true,
});

pointTransactionSchema.index({ user: 1, createdAt: -1 });

// Backs the once-per-source awards: a repeated or concurrent trigger hits a duplicate-key error instead of paying twice.
// Partial because these ids default to null on every other transaction.
pointTransactionSchema.index(
  { user: 1, type: 1, 'metadata.tournamentId': 1 },
  { unique: true, partialFilterExpression: { 'metadata.tournamentId': { $type: 'objectId' } } }
);
pointTransactionSchema.index(
  { user: 1, type: 1, 'metadata.leagueId': 1 },
  { unique: true, partialFilterExpression: { 'metadata.leagueId': { $type: 'objectId' } } }
);

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);
module.exports.POINT_TRANSACTION_TYPES = POINT_TRANSACTION_TYPES;
