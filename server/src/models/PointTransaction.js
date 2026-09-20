const mongoose = require('mongoose');

const POINT_TRANSACTION_TYPES = [
  'game_played',
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
  'ranked_league_placement_4',
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
  metadata: {
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', default: null },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'RankedLeague', default: null },
    placement: { type: Number, default: null },
  },
}, {
  timestamps: true,
});

pointTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);
module.exports.POINT_TRANSACTION_TYPES = POINT_TRANSACTION_TYPES;
