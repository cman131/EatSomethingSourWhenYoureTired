const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  players: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    position: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4],
      // 1: East, 2: South, 3: West, 4: North
    },
    rank: {
      type: Number,
      min: 1,
      max: 4
      // 1: 1st place (highest score), 2: 2nd place, 3: 3rd place, 4: 4th place (lowest score)
    },
  }],
  gameDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: 500
  },
  pointsLeftOnTable: {
    type: Number,
    default: 0
  },
  isEastOnly: {
    type: Boolean,
    default: false
  },
  isInPerson: {
    type: Boolean,
    default: true
  },
  ranOutOfTime: {
    type: Boolean,
    default: false
  },
  comments: [{
    comment: {
      type: String,
      maxlength: 500
    },
    commenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
gameSchema.index({ submittedBy: 1 });
gameSchema.index({ 'players.player': 1 });
gameSchema.index({ gameDate: -1 });
gameSchema.index({ createdAt: -1 });

// Validation: ensure exactly 4 players
gameSchema.pre('save', function(next) {
  if (this.players.length !== 4) {
    return next(new Error('A mahjong game must have exactly 4 players'));
  }
  
  // Ensure positions are 1-4 (East, South, West, North) and unique
  const positions = this.players.map(p => p.position).sort();
  const expectedPositions = [1, 2, 3, 4]; // East, South, West, North
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    return next(new Error('Player positions must be 1 (East), 2 (South), 3 (West), and 4 (North)'));
  }
  
  // Ensure all players are unique
  const playerIds = this.players.map(p => p.player.toString());
  if (new Set(playerIds).size !== 4) {
    return next(new Error('All players must be unique'));
  }

  // Calculate ranks based on scores (higher score = better rank)
  // Sort players by score descending, then assign ranks
  const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
  sortedPlayers.forEach((sortedPlayer, index) => {
    const rank = index + 1; // 1st, 2nd, 3rd, 4th
    const player = this.players.find(p => p.player.toString() === sortedPlayer.player.toString());
    if (player) {
      player.rank = rank;
    }
  });
  this.markModified('players');

  next();
});

// Ensure populated User fields go through their toJSON method
gameSchema.methods.toJSON = function() {
  const gameObject = this.toObject();
  
  // Apply toJSON to populated submittedBy if it exists and is populated
  if (this.submittedBy && this.submittedBy.toJSON && typeof this.submittedBy.toJSON === 'function') {
    gameObject.submittedBy = this.submittedBy.toJSON();
  }
  
  // Apply toJSON to populated verifiedBy if it exists and is populated
  if (this.verifiedBy && this.verifiedBy.toJSON && typeof this.verifiedBy.toJSON === 'function') {
    gameObject.verifiedBy = this.verifiedBy.toJSON();
  }
  
  // Handle players array - check if player fields are populated
  if (this.players && Array.isArray(this.players)) {
    gameObject.players = this.players.map((player, index) => {
      const playerObj = gameObject.players[index];
      if (player.player && player.player.toJSON && typeof player.player.toJSON === 'function') {
        return {
          ...playerObj,
          player: player.player.toJSON()
        };
      }
      return playerObj;
    });
  }
  
  // Handle comments array - check if commenter fields are populated
  if (this.comments && Array.isArray(this.comments)) {
    gameObject.comments = this.comments.map((comment, index) => {
      const commentObj = gameObject.comments[index];
      if (comment.commenter && comment.commenter.toJSON && typeof comment.commenter.toJSON === 'function') {
        return {
          ...commentObj,
          commenter: comment.commenter.toJSON()
        };
      }
      return commentObj;
    });
  }
  
  return gameObject;
};

module.exports = mongoose.model('Game', gameSchema);

