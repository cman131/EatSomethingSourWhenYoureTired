const mongoose = require('mongoose');
const crypto = require('crypto');

const discardQuizSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'DiscardQuiz ID is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  hand: {
    type: [String],
    required: [true, 'Hand is required'],
    validate: {
      validator: function(tiles) {
        return tiles.length === 14;
      },
      message: 'Hand must contain exactly 14 tiles'
    }
  },
  doraIndicator: {
    type: String,
    required: [true, 'Dora indicator is required'],
    trim: true
  },
  seat: {
    type: String,
    required: [true, 'Seat wind is required'],
    enum: ['E', 'S', 'W', 'N'],
    trim: true
  },
  roundWind: {
    type: String,
    required: [true, 'Round wind is required'],
    enum: ['E', 'S'],
    trim: true
  },
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => new Map()
  }
}, {
  timestamps: true
});

// Index for better query performance
discardQuizSchema.index({ id: 1 });

// Validation: ensure tile counts are valid (max 4 of any tile, max 1 of red 5s)
discardQuizSchema.pre('validate', function(next) {
  const tileCounts = {};
  const red5Tiles = ['M5R', 'P5R', 'S5R'];
  
  // Count tiles in hand
  for (const tile of this.hand) {
    tileCounts[tile] = (tileCounts[tile] || 0) + 1;
  }
  
  // Check max counts
  for (const [tile, count] of Object.entries(tileCounts)) {
    if (red5Tiles.includes(tile)) {
      if (count > 1) {
        return next(new Error(`Red 5 tile ${tile} can only appear once in hand`));
      }
    } else {
      if (count > 4) {
        return next(new Error(`Tile ${tile} cannot appear more than 4 times in hand`));
      }
    }
  }
  
  // Validate that all response tileIds are in the hand
  if (this.responses && this.responses.size > 0) {
    const handSet = new Set(this.hand);
    for (const tileId of this.responses.keys()) {
      if (!handSet.has(tileId)) {
        return next(new Error(`Response tileId ${tileId} is not part of the hand`));
      }
    }
  }
  
  next();
});

// Generate deterministic ID from hand, dora indicator, seat, and round wind
discardQuizSchema.statics.generateId = function(hand, doraIndicator, seat, roundWind) {
  // Sort hand tiles to ensure deterministic ordering
  const sortedHand = [...hand].sort();
  
  // Create a canonical representation: sorted tiles joined, then dora, seat, and round wind
  // Format: "1m,1m,2m,3m,...|dora:5p|seat:E|round:S"
  const handString = sortedHand.join(',');
  const idString = `${handString}|dora:${doraIndicator}|seat:${seat}|round:${roundWind}`;
  
  // Use hash for shorter, deterministic ID
  const hash = crypto.createHash('sha256').update(idString).digest('hex').substring(0, 16);
  
  return hash;
};

// Alternative: create readable ID (for debugging)
discardQuizSchema.statics.generateReadableId = function(hand, doraIndicator, seat, roundWind) {
  // Count tiles in hand
  const tileCounts = {};
  for (const tile of hand) {
    tileCounts[tile] = (tileCounts[tile] || 0) + 1;
  }
  
  // Sort tiles by ID
  const sortedTiles = Object.keys(tileCounts).sort();
  
  // Create representation: "1m:2,2m:1,5mr:1|dora:5p|seat:E|round:S"
  const handParts = sortedTiles.map(tile => {
    const count = tileCounts[tile];
    return count > 1 ? `${tile}:${count}` : tile;
  });
  
  return `${handParts.join(',')}|dora:${doraIndicator}|seat:${seat}|round:${roundWind}`;
};

// Auto-generate ID before saving if not provided
discardQuizSchema.pre('save', function(next) {
  if (!this.id && this.hand && this.doraIndicator && this.seat && this.roundWind) {
    this.id = this.constructor.generateId(this.hand, this.doraIndicator, this.seat, this.roundWind);
  }
  next();
});

module.exports = mongoose.model('DiscardQuiz', discardQuizSchema);

