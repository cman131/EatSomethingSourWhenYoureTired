const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    maxlength: [100, 'Tournament name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Tournament date is required']
  },
  isEastOnly: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['NotStarted', 'InProgress', 'Completed', 'Cancelled'],
    default: 'NotStarted'
  },
  players: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uma: {
      type: Number,
      default: 0
    },
    dropped: {
      type: Boolean,
      default: false
    }
  }],
  rounds: [{
    roundNumber: {
      type: Number,
      required: true,
      min: 1
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    pairings: [{
      tableNumber: {
        type: Number,
        required: true,
        min: 1
      },
      players: [{
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        seat: {
          type: String,
          enum: ['East', 'South', 'West', 'North'],
          required: true
        }
      }],
      game: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
      }
    }]
  }],
}, {
  timestamps: true
});

tournamentSchema.virtual('maxRounds').get(function() {
  return Math.ceil(((this.players.filter(p => !p.dropped).length - 4) / 12 ) + 1);
});

// Indexes for better query performance
tournamentSchema.index({ date: -1 });
tournamentSchema.index({ 'players.player': 1 });

// Validation: ensure exactly 4 players in each pairing
tournamentSchema.pre('save', function(next) {
  // Validate each pairing has exactly 4 unique players
  for (const round of this.rounds) {
    const roundPlayers = [];
    const tableNumbers = [];
    
    for (const pairing of round.pairings) {
      // Validate table number is present and unique within round
      if (pairing.tableNumber) {
        if (tableNumbers.includes(pairing.tableNumber)) {
          return next(new Error(`Table number ${pairing.tableNumber} is duplicated in round ${round.roundNumber}`));
        }
        tableNumbers.push(pairing.tableNumber);
      }
      
      // Validate pairing has exactly 4 players
      if (!pairing.players || pairing.players.length !== 4) {
        return next(new Error('Each pairing must have exactly 4 players'));
      }
      
      // Validate all players and seats are present and unique
      const playerIds = [];
      const seats = [];
      
      for (const playerEntry of pairing.players) {
        if (!playerEntry.player) {
          return next(new Error('Each player entry must have a player ID'));
        }
        if (!playerEntry.seat) {
          return next(new Error('Each player entry must have a seat assignment'));
        }
        
        playerIds.push(playerEntry.player.toString());
        seats.push(playerEntry.seat);
      }
      
      if (new Set(playerIds).size !== 4) {
        return next(new Error('All players in a pairing must be unique'));
      }
      
      if (new Set(seats).size !== 4) {
        return next(new Error('All seats in a pairing must be unique'));
      }
      
      // Collect all players from this pairing for round-level validation
      roundPlayers.push(...playerIds);
    }
    
    // Validate no player appears in more than one pairing within a round
    if (new Set(roundPlayers).size !== roundPlayers.length) {
      return next(new Error('No player can appear in more than one pairing within a round'));
    }
  }
  
  // Ensure all players in tournament are unique
  const playerIds = this.players.map(p => p.player?.toString()).filter(Boolean);
  if (new Set(playerIds).size !== playerIds.length) {
    return next(new Error('All players in tournament must be unique'));
  }
  
  next();
});

module.exports = mongoose.model('Tournament', tournamentSchema);

