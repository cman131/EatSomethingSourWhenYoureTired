const mongoose = require('mongoose');
const crypto = require('crypto');

const decisionQuizSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'DecisionQuiz ID is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  players: {
    type: [{
      hand: {
        type: [String],
        required: [true, 'Hand is required']
      },
      discard: {
        type: [String],
        required: [true, 'Discard is required'],
        default: []
      },
      melds: {
        type: [{
          tiles: {
            type: [String],
            required: [true, 'Meld tiles are required']
          },
          stolenTileIndex: {
            type: Number,
            required: false,
            default: null,
            validate: {
              validator: function(value) {
                if (value === null || value === undefined) {
                  return true; // null is valid for closed quads
                }
                return Number.isInteger(value) && value >= 0 && value < 4;
              },
              message: 'stolenTileIndex must be null or an integer between 0 and 3'
            }
          },
          stolenFromSeat: {
            type: String,
            required: false,
            default: null,
            enum: [null, 'E', 'S', 'W', 'N'],
            validate: {
              validator: function(value) {
                // Can be null for closed quads
                return value === null || ['E', 'S', 'W', 'N'].includes(value);
              },
              message: 'stolenFromSeat must be null or one of E, S, W, N'
            }
          }
        }],
        required: [true, 'Melds are required'],
        default: []
      },
      seat: {
        type: String,
        required: [true, 'Seat wind is required'],
        enum: ['E', 'S', 'W', 'N'],
        trim: true
      },
      isUser: {
        type: Boolean,
        required: [true, 'isUser is required'],
        default: false
      },
      score: {
        type: Number,
        required: [true, 'Score is required']
      },
      riichiTile: {
        type: Number,
        required: false,
        default: null,
        validate: {
          validator: function(value) {
            // If null, it's valid (optional)
            if (value === null || value === undefined) {
              return true;
            }
            // If not null, must be a valid index in discard array
            // Note: This validation happens at the document level, so we check in pre-validate
            return Number.isInteger(value) && value >= 0;
          },
          message: 'riichiTile must be null or a non-negative integer'
        }
      }
    }],
    required: [true, 'Players are required'],
    validate: {
      validator: function(players) {
        return players.length === 4;
      },
      message: 'Must have exactly 4 players'
    }
  },
  doraIndicators: {
    type: [String],
    required: [true, 'Dora indicators are required'],
    validate: {
      validator: function(indicators) {
        return indicators.length >= 1 && indicators.length <= 4;
      },
      message: 'Must have 1 to 4 dora indicators'
    }
  },
  roundWind: {
    type: String,
    required: [true, 'Round wind is required'],
    enum: ['E', 'S'],
    trim: true
  },
  roundNumber: {
    type: Number,
    required: [true, 'Round number is required'],
    min: [1, 'Round number must be between 1 and 4'],
    max: [4, 'Round number must be between 1 and 4'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value) && value >= 1 && value <= 4;
      },
      message: 'Round number must be an integer between 1 and 4'
    }
  },
  remainingTileCount: {
    type: Number,
    required: [true, 'Remaining tile count is required'],
    default: 0
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
decisionQuizSchema.index({ id: 1 });

// Helper function to parse tile suit and number
function parseTile(tile) {
  // Numbered tiles: M1-M9, P1-P9, S1-S9, or M5R, P5R, S5R
  const numberedMatch = tile.match(/^([MPS])(\d+)(R)?$/);
  if (numberedMatch) {
    return {
      suit: numberedMatch[1],
      number: parseInt(numberedMatch[2], 10),
      isRed: !!numberedMatch[3],
      type: 'numbered'
    };
  }
  
  // Winds: E, S, W, N
  if (['E', 'S', 'W', 'N'].includes(tile)) {
    return {
      suit: null,
      number: null,
      isRed: false,
      type: 'wind',
      value: tile
    };
  }
  
  // Dragons: w, g, r
  if (['w', 'g', 'r'].includes(tile)) {
    return {
      suit: null,
      number: null,
      isRed: false,
      type: 'dragon',
      value: tile
    };
  }
  
  return null;
}

// Helper function to validate a meld
function validateMeld(meld, playerIndex, meldIndex, playerSeat) {
  // Check that meld has tiles array
  if (!meld.tiles || !Array.isArray(meld.tiles)) {
    return `Player ${playerIndex}, meld ${meldIndex}: must have a tiles array`;
  }
  
  // Check length
  if (meld.tiles.length !== 3 && meld.tiles.length !== 4) {
    return `Player ${playerIndex}, meld ${meldIndex}: must contain exactly 3 or 4 tiles, got ${meld.tiles.length}`;
  }
  
  // Parse all tiles
  const parsedTiles = meld.tiles.map(tile => parseTile(tile));
  
  // Check all tiles are valid
  for (let i = 0; i < parsedTiles.length; i++) {
    if (!parsedTiles[i]) {
      return `Player ${playerIndex}, meld ${meldIndex}: invalid tile "${meld[i]}"`;
    }
  }
  
  // Check all tiles are same suit (for numbered tiles) or same type (for winds/dragons)
  const firstTile = parsedTiles[0];
  
  if (firstTile.type === 'numbered') {
    // All must be numbered tiles with same suit
    for (let i = 1; i < parsedTiles.length; i++) {
      if (parsedTiles[i].type !== 'numbered' || parsedTiles[i].suit !== firstTile.suit) {
        return `Player ${playerIndex}, meld ${meldIndex}: all tiles must be the same suit`;
      }
    }
    
    // Check if identical tiles or sequence
    const allIdentical = parsedTiles.every(t => 
      t.number === firstTile.number
    );
    
    if (allIdentical) {
      // Valid triplet or quad
      return null;
    }
    
    // Check if sequence (only valid for 3 tiles)
    if (meld.tiles.length === 3) {
      // Extract numbers, handling red 5s
      const numbers = parsedTiles.map(t => {
        if (t.isRed) return 5; // Red 5 is treated as 5
        return t.number;
      }).sort((a, b) => a - b);
      
      // Check for duplicate numbers (e.g., M4, M5, M5R would be [4, 5, 5])
      const uniqueNumbers = [...new Set(numbers)];
      if (uniqueNumbers.length !== 3) {
        return `Player ${playerIndex}, meld ${meldIndex}: sequence cannot have duplicate numbers`;
      }
      
      // Check if consecutive
      if (numbers[0] + 1 === numbers[1] && numbers[1] + 1 === numbers[2]) {
        // Valid sequence
        return null;
      }
    }
    
    return `Player ${playerIndex}, meld ${meldIndex}: must be either identical tiles or a 3-tile sequence`;
  } else {
    // Winds or dragons - must all be identical
    const allIdentical = parsedTiles.every(t => t.value === firstTile.value);
    if (!allIdentical) {
      return `Player ${playerIndex}, meld ${meldIndex}: all tiles must be identical for winds/dragons`;
    }
    // Valid triplet or quad of winds/dragons
    return null;
  }
}

// Validation: ensure tile counts are valid (max 4 of any tile, max 1 of red 5s)
decisionQuizSchema.pre('validate', function(next) {
  const tileCounts = {};
  const regular5Tiles = ['M5', 'P5', 'S5'];
  const red5Tiles = ['M5R', 'P5R', 'S5R'];
  
  // Count tiles across all players' hands, discards, and melds
  for (const player of this.players) {
    // Count hand tiles
    for (const tile of player.hand) {
      tileCounts[tile] = (tileCounts[tile] || 0) + 1;
    }
    
    // Count discard tiles
    for (const tile of player.discard) {
      tileCounts[tile] = (tileCounts[tile] || 0) + 1;
    }
    
    // Count meld tiles
    for (const meld of player.melds) {
      for (const tile of meld.tiles) {
        tileCounts[tile] = (tileCounts[tile] || 0) + 1;
      }
    }
  }
  
  // Check max counts
  for (const [tile, count] of Object.entries(tileCounts)) {
    if (red5Tiles.includes(tile)) {
      if (count > 1) {
        return next(new Error(`Red 5 tile ${tile} can only appear once across all players`));
      }
    } else if (regular5Tiles.includes(tile)) {
      if (count > 3) {
        return next(new Error(`Regular 5 tile ${tile} can only appear 3 times across all players`));
      }
    } else {
      if (count > 4) {
        return next(new Error(`Tile ${tile} cannot appear more than 4 times across all players`));
      }
    }
  }
  
  // Validate that exactly one player is marked as the user
  if (this.players.length === 4) {
    const userCount = this.players.filter(p => p.isUser).length;
    if (userCount !== 1) {
      return next(new Error('Exactly one player must be marked as the user (isUser: true)'));
    }
  }
  
  // Validate that all response tileIds are in the user's hand
  if (this.responses && this.responses.size > 0 && this.players.length > 0) {
    const userPlayer = this.players.find(p => p.isUser);
    if (userPlayer) {
      const userHandSet = new Set(userPlayer.hand);
      for (const tileId of this.responses.keys()) {
        if (!userHandSet.has(tileId)) {
          return next(new Error(`Response tileId ${tileId} is not part of the user's hand`));
        }
      }
    }
  }
  
  // Validate that all 4 seat winds are unique
  if (this.players.length === 4) {
    const seatWinds = this.players.map(p => p.seat);
    const uniqueSeats = new Set(seatWinds);
    if (uniqueSeats.size !== 4) {
      return next(new Error('All 4 players must have unique seat winds'));
    }
  }
  
  // Validate hand + meld tile counts (quads count as 3 tiles)
  for (let i = 0; i < this.players.length; i++) {
    const player = this.players[i];
    const handCount = player.hand.length;
    
    // Count meld tiles: quads (4 tiles) count as 3, triplets (3 tiles) count as 3
    const meldCount = player.melds.length * 3;
    
    const totalTiles = handCount + meldCount;
    const expectedTiles = player.isUser ? 14 : 13;
    
    if (totalTiles !== expectedTiles) {
      return next(new Error(`Player ${i} (${player.isUser ? 'user' : 'non-user'}): hand (${handCount}) + melds (${meldCount}) = ${totalTiles}, expected ${expectedTiles}`));
    }
  }
  
  // Validate stolen tile information for melds
  const seatOrder = { 'E': 0, 'S': 1, 'W': 2, 'N': 3 };
  const seatArray = ['E', 'S', 'W', 'N'];
  
  for (let i = 0; i < this.players.length; i++) {
    const player = this.players[i];
    const playerSeatIndex = seatOrder[player.seat];
    
    for (let j = 0; j < player.melds.length; j++) {
      const meld = player.melds[j];
      
      // Determine if meld is a sequence (only for 3-tile numbered tiles)
      let isSequence = false;
      if (meld.tiles.length === 3) {
        const parsedTiles = meld.tiles.map(t => parseTile(t));
        if (parsedTiles[0] && parsedTiles[0].type === 'numbered') {
          // Check if all are numbered tiles with same suit
          const allNumberedSameSuit = parsedTiles.every(t => 
            t && t.type === 'numbered' && t.suit === parsedTiles[0].suit
          );
          if (allNumberedSameSuit) {
            // Extract numbers, handling red 5s
            const numbers = parsedTiles.map(t => {
              if (t.isRed) return 5;
              return t.number;
            }).sort((a, b) => a - b);
            
            // Check if consecutive (sequence)
            if (numbers[0] + 1 === numbers[1] && numbers[1] + 1 === numbers[2]) {
              // Check no duplicates
              const uniqueNumbers = [...new Set(numbers)];
              if (uniqueNumbers.length === 3) {
                isSequence = true;
              }
            }
          }
        }
      }
      
      // For 3-tile melds, must have stolen tile info
      if (meld.tiles.length === 3) {
        if (meld.stolenTileIndex === null || meld.stolenTileIndex === undefined) {
          return next(new Error(`Player ${i}, meld ${j}: 3-tile meld must have stolenTileIndex`));
        }
        if (meld.stolenFromSeat === null || meld.stolenFromSeat === undefined) {
          return next(new Error(`Player ${i}, meld ${j}: 3-tile meld must have stolenFromSeat`));
        }
        
        // Validate stolenTileIndex is within bounds
        if (meld.stolenTileIndex < 0 || meld.stolenTileIndex >= meld.tiles.length) {
          return next(new Error(`Player ${i}, meld ${j}: stolenTileIndex ${meld.stolenTileIndex} is out of bounds`));
        }
        
        // For sequences, must be stolen from previous player
        if (isSequence) {
          const previousSeatIndex = (playerSeatIndex + 3) % 4; // Previous in E->S->W->N->E cycle
          const expectedSeat = seatArray[previousSeatIndex];
          if (meld.stolenFromSeat !== expectedSeat) {
            return next(new Error(`Player ${i}, meld ${j}: sequence meld must be stolen from previous player (${expectedSeat}), got ${meld.stolenFromSeat}`));
          }
        } else {
          // For triplets, can be from any other player (not self)
          if (meld.stolenFromSeat === player.seat) {
            return next(new Error(`Player ${i}, meld ${j}: triplet meld cannot be stolen from self`));
          }
        }
      } else {
        // For 4-tile melds (quads), stolen info is optional (can be closed)
        if (meld.stolenTileIndex !== null && meld.stolenTileIndex !== undefined) {
          // If stolenTileIndex is set, stolenFromSeat must also be set
          if (meld.stolenFromSeat === null || meld.stolenFromSeat === undefined) {
            return next(new Error(`Player ${i}, meld ${j}: if stolenTileIndex is set, stolenFromSeat must also be set`));
          }
          
          // Validate stolenTileIndex is within bounds
          if (meld.stolenTileIndex < 0 || meld.stolenTileIndex >= meld.tiles.length) {
            return next(new Error(`Player ${i}, meld ${j}: stolenTileIndex ${meld.stolenTileIndex} is out of bounds`));
          }
          
          // Can be from any other player
          if (meld.stolenFromSeat === player.seat) {
            return next(new Error(`Player ${i}, meld ${j}: quad meld cannot be stolen from self`));
          }
        }
        // If both are null, it's a closed quad (valid)
      }
    }
  }
  
  // Validate discard counts based on turn order and melds
  if (this.players.length === 4) {
    const userPlayer = this.players.find(p => p.isUser);
    if (!userPlayer) {
      return next(new Error('User player not found'));
    }
    
    const userSeat = userPlayer.seat;
    const seatOrder = { 'E': 0, 'S': 1, 'W': 2, 'N': 3 };
    const seatArray = ['E', 'S', 'W', 'N'];
    
    // Start with actual discard counts and work backwards to get base counts
    const baseDiscards = {};
    for (const player of this.players) {
      baseDiscards[player.seat] = player.discard.length;
    }
    
    // Add back adjustments from melds (reverse the meld effects)
    for (const player of this.players) {
      for (const meld of player.melds) {
        // Skip closed quads (no discard changes)
        if (meld.tiles.length === 4 && 
            meld.stolenTileIndex === null && 
            meld.stolenFromSeat === null) {
          continue;
        }
        
        // If meld has stolen tile info, reverse the discard adjustments
        if (meld.stolenFromSeat !== null && meld.stolenFromSeat !== undefined) {
          const meldOwnerSeat = player.seat;
          const stolenFromSeat = meld.stolenFromSeat;
          
          // The stolen-from player had 1 discard removed (add it back)
          baseDiscards[stolenFromSeat] += 1;
          
          // Players between meld owner and stolen-from player (in turn order) skipped their turn
          const ownerIndex = seatOrder[meldOwnerSeat];
          const stolenFromIndex = seatOrder[stolenFromSeat];
          
          // Find players between owner and stolen-from (clockwise)
          let currentIndex = (stolenFromIndex + 1) % 4;
          while (currentIndex !== ownerIndex) {
            const betweenSeat = seatArray[currentIndex];
            baseDiscards[betweenSeat] += 1; // Add back skipped turn
            currentIndex = (currentIndex + 1) % 4;
          }
        }
      }
    }
    
    // Now validate base discard counts based on user's seat and turn order
    // Start at userSeat and add 1 to each seat in turn order until we reach East
    let currentSeatIndex = seatOrder[userSeat];
    
    // Move clockwise (E->S->W->N->E) from userSeat until we reach East
    while (seatArray[currentSeatIndex] !== 'E') {
      baseDiscards[seatArray[currentSeatIndex]] += 1;
      currentSeatIndex = (currentSeatIndex + 1) % 4;
    }
    
    // After adjustments, all seats should have the same discard count
    const expectedCount = baseDiscards[seatArray[seatOrder[userSeat]]];
    for (const player of this.players) {
      if (baseDiscards[player.seat] !== expectedCount) {
        return next(new Error(`Player ${player.seat}: adjusted base discard count is ${baseDiscards[player.seat]}, expected ${expectedCount} (all should be equal after turn order adjustments)`));
      }
    }
  }
  
  // Validate that all scores are multiples of 100
  for (let i = 0; i < this.players.length; i++) {
    const player = this.players[i];
    if (player.score % 100 !== 0) {
      return next(new Error(`Player ${i} (${player.seat}): score ${player.score} is not a multiple of 100`));
    }
  }
  
  // Validate that total score equals 100000
  if (this.players.length === 4) {
    const totalScore = this.players.reduce((sum, player) => sum + (player.score || 0), 0);
    if (totalScore !== 100000) {
      return next(new Error(`Total score must equal 100000, but got ${totalScore}`));
    }
  }
  
  // Validate that riichiTile is either null or a valid index in discard array
  for (let i = 0; i < this.players.length; i++) {
    const player = this.players[i];
    if (player.riichiTile !== null && player.riichiTile !== undefined) {
      if (!Number.isInteger(player.riichiTile) || player.riichiTile < 0 || player.riichiTile >= player.discard.length) {
        return next(new Error(`Player ${i}: riichiTile index ${player.riichiTile} is out of bounds for discard array of length ${player.discard.length}`));
      }
      if (player.melds.length > 0) {
        return next(new Error(`Player ${i}: riichiTile cannot be set if melds are present`));
      }
    }
  }
  
  // Validate all melds
  for (let i = 0; i < this.players.length; i++) {
    const player = this.players[i];
    for (let j = 0; j < player.melds.length; j++) {
      const meld = player.melds[j];
      const error = validateMeld(meld, i, j, player.seat);
      if (error) {
        return next(new Error(error));
      }
    }
  }
  
  next();
});

// Generate deterministic ID from all player data, dora indicators, round wind, and round number
// ID is based on where every tile is (position matters, not just counts)
decisionQuizSchema.statics.generateId = function(players, doraIndicators, roundWind, roundNumber) {
  // Create a canonical representation preserving order
  // Format: "p0:hand|discard|melds|seat|p1:...|dora:ind1,ind2,...|round:E"
  
  // Sort players by seat (E, S, W, N)
  const seatOrder = { 'E': 0, 'S': 1, 'W': 2, 'N': 3 };
  const sortedPlayers = [...players].sort((a, b) => seatOrder[a.seat] - seatOrder[b.seat]);
  
  const playerParts = sortedPlayers.map((player, index) => {
    // Sort hand tiles
    const sortedHand = [...player.hand].sort();
    const handStr = sortedHand.join(',');
    
    // Sort discard tiles
    const sortedDiscard = [...player.discard].sort();
    const discardStr = sortedDiscard.join(',');
    
    // Sort melds: sort tiles within each meld, then sort melds by their canonical representation
    const sortedMelds = player.melds.map(meld => ({
      ...meld,
      tiles: [...meld.tiles].sort()
    })).sort((a, b) => {
      const aStr = a.tiles.join(',');
      const bStr = b.tiles.join(',');
      return aStr.localeCompare(bStr);
    });
    const meldsStr = sortedMelds.map(meld => {
      const tilesStr = meld.tiles.join(',');
      const stolenInfo = meld.stolenTileIndex !== null && meld.stolenFromSeat !== null
        ? `|stolen:${meld.stolenTileIndex}:${meld.stolenFromSeat}`
        : meld.stolenTileIndex === null && meld.stolenFromSeat === null
        ? '|closed'
        : '';
      return `${tilesStr}${stolenInfo}`;
    }).join(';');
    
    // Include score in ID
    return `p${index}:h[${handStr}]d[${discardStr}]m[${meldsStr}]s[${player.seat}]sc[${player.score}]`;
  });
  
  // Dora indicators sorted for determinism (but order might matter, so preserve if needed)
  const doraStr = [...doraIndicators].sort().join(',');
  
  const idString = `${playerParts.join('|')}|dora:[${doraStr}]|round:${roundWind}|roundNum:${roundNumber}`;
  
  // Use hash for shorter, deterministic ID
  const hash = crypto.createHash('sha256').update(idString).digest('hex').substring(0, 16);
  
  return hash;
};

// Alternative: create readable ID (for debugging)
decisionQuizSchema.statics.generateReadableId = function(players, doraIndicators, roundWind, roundNumber) {
  // Sort players by seat (E, S, W, N)
  const seatOrder = { 'E': 0, 'S': 1, 'W': 2, 'N': 3 };
  const sortedPlayers = [...players].sort((a, b) => seatOrder[a.seat] - seatOrder[b.seat]);
  
  const playerParts = sortedPlayers.map((player, index) => {
    // Sort hand tiles
    const sortedHand = [...player.hand].sort();
    const handStr = sortedHand.join(',');
    
    // Sort discard tiles
    const sortedDiscard = [...player.discard].sort();
    const discardStr = sortedDiscard.join(',');
    
    // Sort melds: sort tiles within each meld, then sort melds by their canonical representation
    const sortedMelds = player.melds.map(meld => ({
      ...meld,
      tiles: [...meld.tiles].sort()
    })).sort((a, b) => {
      const aStr = a.tiles.join(',');
      const bStr = b.tiles.join(',');
      return aStr.localeCompare(bStr);
    });
    const meldsStr = sortedMelds.map(meld => {
      const tilesStr = meld.tiles.join(',');
      const stolenInfo = meld.stolenTileIndex !== null && meld.stolenFromSeat !== null
        ? `|stolen:${meld.stolenTileIndex}:${meld.stolenFromSeat}`
        : meld.stolenTileIndex === null && meld.stolenFromSeat === null
        ? '|closed'
        : '';
      return `${tilesStr}${stolenInfo}`;
    }).join(';');
    
    // Include score in ID
    return `p${index}:h[${handStr}]d[${discardStr}]m[${meldsStr}]s[${player.seat}]sc[${player.score}]`;
  });
  
  const doraStr = doraIndicators.join(',');
  return `${playerParts.join('|')}|dora:[${doraStr}]|round:${roundWind}|roundNum:${roundNumber}`;
};

// Auto-generate ID before saving if not provided
decisionQuizSchema.pre('save', function(next) {
  if (!this.id && this.players && this.players.length === 4 && 
      this.doraIndicators && this.roundWind && this.roundNumber) {
    this.id = this.constructor.generateId(this.players, this.doraIndicators, this.roundWind, this.roundNumber);
  }
  next();
});

module.exports = mongoose.model('DecisionQuiz', decisionQuizSchema);

