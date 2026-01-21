const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Achievement name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Achievement description is required'],
    trim: true
  },
  requirements: [{
    type: {
      type: String,
      enum: ['PlayedGames', 'WonGames', 'WinStreak', 'ScoredPoints', 'Position', 'CompletedQuizzes', 'SubmittedGames', 'VerifiedGames', 'PlayersPlayedWith', 'ConsecutivePlayedGames', 'ConsecutivePlayedDays', 'AccumulatedPoints', 'TimePlayedAt', 'GamesInADay', 'TournamentsPlayed', 'TournamentsWon', 'TournamentsCreated', 'TournamentTop4'],
      required: [true, 'Achievement requirements type is required']
    },
    comparisonType: {
      type: String,
      enum: ['=', '>', '<', '>=', '<='],
      required: [true, 'Achievement comparison type is required'],
      default: '='
    },
    requirementsValue: {
      type: Number,
      required: [true, 'Achievement requirements value is required']
    },
    isGrand: {
      type: Boolean,
      default: false
    }
  }],
  icon: {
    type: String,
    required: [true, 'Achievement icon is required'],
    trim: true
  },
}, {
  timestamps: true
});

// Index for better query performance
achievementSchema.index({ name: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);

