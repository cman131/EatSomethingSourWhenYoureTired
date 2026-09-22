const mongoose = require('mongoose');

const rankedLeagueSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true
  },
  players: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rankedPoints: {
      type: Number,
      default: 500
    },
    gamesPlayed: {
      type: Number,
      default: 0
    }
  }],
  // Set once season-end placement points have been paid; unset means payout is still owed once a newer league exists.
  rewardsAwardedAt: {
    type: Date,
    default: null
  },
  // Lease taken while a request is paying out, so concurrent requests skip it; a stale lease is retaken.
  rewardsClaimedAt: {
    type: Date,
    default: null
  },
  // Games already applied to this league; written in the same save as the points so a replay cannot double-apply
  appliedGames: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  }]
}, {
  timestamps: true
});

rankedLeagueSchema.index({ startDate: -1 });
rankedLeagueSchema.index({ rewardsAwardedAt: 1, startDate: 1 });

module.exports = mongoose.model('RankedLeague', rankedLeagueSchema);
