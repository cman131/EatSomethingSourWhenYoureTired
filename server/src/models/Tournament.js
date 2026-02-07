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
    maxlength: [5000, 'Description cannot be more than 5000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Tournament date is required']
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  location: {
    streetAddress: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot be more than 200 characters']
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [100, 'Address line 2 cannot be more than 100 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot be more than 100 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [2, 'State must be a 2-letter abbreviation'],
      uppercase: true
    },
    zipCode: {
      type: String,
      trim: true,
      match: [/^\d{5}(-\d{4})?$/, 'Zip code must be in format 12345 or 12345-6789']
    }
  },
  onlineLocation: {
    type: String,
    trim: true,
    maxlength: [500, 'Online location cannot be more than 500 characters']
  },
  isEastOnly: {
    type: Boolean,
    default: false
  },
  ruleset: {
    type: String,
    enum: ['WRC2025', 'MahjongSoul'],
    required: [true, 'Ruleset is required'],
    default: 'WRC2025'
  },
  modifications: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each modification cannot be more than 500 characters']
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tournament creator is required']
  },
  status: {
    type: String,
    enum: ['NotStarted', 'InProgress', 'Completed', 'Cancelled'],
    default: 'NotStarted'
  },
  maxPlayers: {
    type: Number,
    default: null,
    validate: {
      validator: function(value) {
        // Allow null/undefined (optional field)
        if (value == null) {
          return true;
        }
        // If a value is provided, it must be at least 8
        return value >= 8;
      },
      message: 'Max players must be at least 8'
    }
  },
  roundDurationMinutes: {
    type: Number,
    default: null,
    validate: {
      validator: function(value) {
        // For in-person tournaments (isOnline is false), roundDurationMinutes is required
        if (this.isOnline === false) {
          // Must be provided and must be a positive number
          return value != null && value > 0;
        }
        // For online tournaments, it's optional (can be null)
        return true;
      },
      message: 'Round duration is required for in-person tournaments and must be a positive number'
    }
  },
  startingPointValue: {
    type: Number,
    enum: [25000, 30000],
    default: 30000,
    required: [true, 'Starting point value is required']
  },
  numberOfFinalsMatches: {
    type: Number,
    default: 2,
    min: 1,
    max: 2
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
  waitlist: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
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
  top4: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  // Validate location based on isOnline flag
  if (this.isOnline) {
    // If online, onlineLocation is required and location should not be set
    if (!this.onlineLocation || this.onlineLocation.trim() === '') {
      return next(new Error('Online location is required when tournament is online'));
    }
    if (this.location && (this.location.streetAddress || this.location.city || this.location.state || this.location.zipCode)) {
      return next(new Error('Physical location should not be set when tournament is online'));
    }
  } else {
    // If not online, location is required with all required fields
    if (!this.location) {
      return next(new Error('Physical location is required when tournament is not online'));
    }
    if (!this.location.streetAddress || this.location.streetAddress.trim() === '') {
      return next(new Error('Street address is required for physical location'));
    }
    if (!this.location.city || this.location.city.trim() === '') {
      return next(new Error('City is required for physical location'));
    }
    if (!this.location.state || this.location.state.trim() === '') {
      return next(new Error('State is required for physical location'));
    }
    if (!this.location.zipCode || this.location.zipCode.trim() === '') {
      return next(new Error('Zip code is required for physical location'));
    }
    if (this.onlineLocation && this.onlineLocation.trim() !== '') {
      return next(new Error('Online location should not be set when tournament is not online'));
    }
  }
  
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
        console.log('All players in a pairing must be unique', playerIds);
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
  
  // Ensure all waitlist players are unique
  const waitlistPlayerIds = this.waitlist.map(w => w.player?.toString()).filter(Boolean);
  if (new Set(waitlistPlayerIds).size !== waitlistPlayerIds.length) {
    return next(new Error('All players in waitlist must be unique'));
  }
  
  // Ensure no player is both in players and waitlist
  const allPlayerIds = [...playerIds, ...waitlistPlayerIds];
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    return next(new Error('A player cannot be both registered and on the waitlist'));
  }
  
  next();
});

// Ensure populated User fields go through their toJSON method
tournamentSchema.methods.toJSON = function() {
  const tournamentObject = this.toObject();
  
  // Handle players array - check if player fields are populated
  if (this.players && Array.isArray(this.players)) {
    tournamentObject.players = this.players.map((player, index) => {
      const playerObj = tournamentObject.players[index];
      if (player.player && player.player.toJSON && typeof player.player.toJSON === 'function') {
        return {
          ...playerObj,
          player: player.player.toJSON()
        };
      }
      return playerObj;
    });
  }
  
  // Handle waitlist array - check if player fields are populated
  if (this.waitlist && Array.isArray(this.waitlist)) {
    tournamentObject.waitlist = this.waitlist.map((waitlistEntry, index) => {
      const waitlistObj = tournamentObject.waitlist[index];
      if (waitlistEntry.player && waitlistEntry.player.toJSON && typeof waitlistEntry.player.toJSON === 'function') {
        return {
          ...waitlistObj,
          player: waitlistEntry.player.toJSON()
        };
      }
      return waitlistObj;
    });
  }
  
  // Handle rounds array - check if player fields are populated
  if (this.rounds && Array.isArray(this.rounds)) {
    tournamentObject.rounds = this.rounds.map((round, roundIndex) => {
      const roundObj = tournamentObject.rounds[roundIndex];
      if (round.pairings && Array.isArray(round.pairings)) {
        roundObj.pairings = round.pairings.map((pairing, pairingIndex) => {
          const pairingObj = roundObj.pairings[pairingIndex];
          if (pairing.players && Array.isArray(pairing.players)) {
            pairingObj.players = pairing.players.map((playerEntry, playerIndex) => {
              const playerEntryObj = pairingObj.players[playerIndex];
              if (playerEntry.player && playerEntry.player.toJSON && typeof playerEntry.player.toJSON === 'function') {
                return {
                  ...playerEntryObj,
                  player: playerEntry.player.toJSON()
                };
              }
              return playerEntryObj;
            });
          }
          
          // Also handle populated game if it exists
          if (pairing.game && pairing.game.toJSON && typeof pairing.game.toJSON === 'function') {
            pairingObj.game = pairing.game.toJSON();
          }
          
          return pairingObj;
        });
      }
      return roundObj;
    });
  }
  
  return tournamentObject;
};

module.exports = mongoose.model('Tournament', tournamentSchema);

