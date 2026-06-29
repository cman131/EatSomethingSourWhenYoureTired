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
    }
  }]
}, {
  timestamps: true
});

rankedLeagueSchema.index({ startDate: -1 });

module.exports = mongoose.model('RankedLeague', rankedLeagueSchema);
