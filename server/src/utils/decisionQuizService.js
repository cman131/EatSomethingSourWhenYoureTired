const DecisionQuiz = require('../models/DecisionQuiz');
const Tile = require('../models/Tile');

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generates a random number of dora indicators (1-4) with weighted probabilities
 * Each additional dora past 1 is increasingly less likely
 * 
 * @returns {Number} Number of dora indicators (1-4)
 */
function generateNumDora() {
  // Weighted random selection for numDora (increasingly less likely past 1)
  // Weights: 1 dora = 50%, 2 dora = 30%, 3 dora = 15%, 4 dora = 5%
  const doraWeights = [50, 30, 15, 5]; // Weights for 1, 2, 3, 4 dora
  const totalWeight = doraWeights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  let numDora = 1;
  for (let i = 0; i < doraWeights.length; i++) {
    random -= doraWeights[i];
    if (random <= 0) {
      numDora = i + 1;
      break;
    }
  }
  return numDora;
}

/**
 * Calculates 4 player scores that sum to 100000, with random adjustments
 * based on round number and round wind
 * 
 * @param {Number} roundNumber - Round number (1-4)
 * @param {String} roundWind - Round wind ('E' or 'S')
 * @returns {Number[]} Array of 4 scores that sum to 100000
 */
function calculatePlayerScores(roundNumber, roundWind) {
  // Start with equal scores
  const scores = [25000, 25000, 25000, 25000];
  
  // Calculate adjustment factor based on round number and round wind
  // Higher values = larger adjustments
  const roundValue = roundNumber + (roundWind === 'E' ? 0 : 4);
  
  // Determine the maximum adjustment multiple (in hundreds)
  // For roundValue 1: max 0 (0 points)
  // For roundValue 2: max 40 (4000 points)
  // For roundValue 3-4: max 80 (8000 points)
  // For roundValue 5-6: max 120 (12000 points)
  // For roundValue 7-8: max 160 (16000 points)
  let maxAdjustmentMultiple;
  if (roundValue <= 1) {
    maxAdjustmentMultiple = 0;
  } else if (roundValue <= 2) {
    maxAdjustmentMultiple = 40;
  } else if (roundValue <= 4) {
    maxAdjustmentMultiple = 80;
  } else if (roundValue <= 6) {
    maxAdjustmentMultiple = 120;
  } else {
    maxAdjustmentMultiple = 160;
  }
  
  // Randomly adjust each score up or down
  const adjustments = [];
  let totalAdjustment = 0;
  
  for (let i = 0; i < 4; i++) {
    // Random adjustment: -maxAdjustmentMultiple to +maxAdjustmentMultiple (in hundreds)
    const adjustmentMultiple = Math.floor(Math.random() * (maxAdjustmentMultiple * 2 + 1)) - maxAdjustmentMultiple;
    const adjustment = adjustmentMultiple * 100;
    adjustments.push(adjustment);
    totalAdjustment += adjustment;
  }
  
  // Since adjustments must sum to 0 to keep total at 100000, redistribute the difference
  const adjustmentDifference = totalAdjustment;
  if (adjustmentDifference !== 0) {
    // Distribute the difference across all players
    const perPlayerAdjustment = Math.round(adjustmentDifference / 4 / 100) * 100;
    const remainder = adjustmentDifference - (perPlayerAdjustment * 4);
    
    // Apply base adjustment to all
    for (let i = 0; i < 4; i++) {
      adjustments[i] -= perPlayerAdjustment;
    }
    
    // Apply remainder to first player(s)
    if (remainder !== 0) {
      adjustments[0] -= remainder;
    }
  }
  
  // Apply adjustments to scores
  for (let i = 0; i < 4; i++) {
    scores[i] += adjustments[i];
  }
  
  return scores;
}

/**
 * Builds a full mahjong deck (136 tiles total)
 * - 4 of each regular tile (M1-M9, P1-P9, S1-S9, E, S, W, N, w, g, r)
 * - 1 of each red 5 (M5R, P5R, S5R)
 * - 3 of each regular 5 (M5, P5, S5)
 */
function buildDeck(tiles) {
  const deck = [];
  const regular5Tiles = ['M5', 'P5', 'S5'];
  const red5Tiles = ['M5R', 'P5R', 'S5R'];
  
  for (const tile of tiles) {
    if (red5Tiles.includes(tile.id)) {
      // Red 5s: 1 copy
      deck.push(tile.id);
    } else if (regular5Tiles.includes(tile.id)) {
      // Regular 5s: 3 copies
      for (let i = 0; i < 3; i++) {
        deck.push(tile.id);
      }
    } else {
      // All other tiles: 4 copies
      for (let i = 0; i < 4; i++) {
        deck.push(tile.id);
      }
    }
  }
  
  return deck;
}

/**
 * Generates a new DecisionQuiz from shuffled tiles
 * 
 * @param {Object} options - Optional configuration
 * @param {String} options.userSeat - Seat for user player ('E', 'S', 'W', or 'N'), defaults to random
 * @param {String} options.roundWind - Round wind ('E' or 'S'), defaults to 'E'
 * @param {Number} options.roundNumber - Round number (1-4), defaults to random 1-4
 * @param {Number} options.numDora - Number of dora indicators (1-4), defaults to 1
 * @param {Number} options.numMelds - Target number of melds per player (0-4), defaults to random 0-2
 * @returns {Promise<DecisionQuiz>} The generated DecisionQuiz
 */
async function generateDecisionQuiz(options = {}) {
  // Generate random options
  const userSeat = ['E', 'S', 'W', 'N'][Math.floor(Math.random() * 4)];
  const roundWind = ['E', 'S'][Math.floor(Math.random() * 2)];
  const roundNumber = Math.floor(Math.random() * 4) + 1; // 1-4
  const numDora = generateNumDora();

  // Get all tiles from database
  const tiles = await Tile.find().sort({ id: 1 });
  if (tiles.length === 0) {
    throw new Error('No tiles found in database. Please seed the tile collection first.');
  }

  // Build and shuffle deck
  let deck = buildDeck(tiles);
  deck = shuffleArray(deck);

  // Initialize players
  const seats = ['E', 'S', 'W', 'N'];
  const players = seats.map(seat => ({
    hand: [],
    discard: [],
    melds: [],
    seat,
    isUser: seat === userSeat,
    score: 25000, // Will be adjusted later
    riichiTile: null
  }));

  // Deal initial hands (13 tiles each, user gets 14)
  let deckIndex = 0;
  for (const player of players) {
    for (let i = 0; i < 13; i++) {
        player.hand.push(deck[deckIndex++]);
    }
  }
  // User gets one more tile
  const userPlayer = players.find(p => p.isUser);
  if (userPlayer) {
    userPlayer.hand.push(deck[deckIndex++]);
  }

  // Sort hands for easier meld detection
  for (const player of players) {
    player.hand.sort();
  }

  // TODO: Create some melds (simplified - you may want to enhance this)
  // For now, we'll create a simple game state without melds to keep it valid
  // You can enhance this later to create actual valid melds

  // Distribute discards based on turn order
  // Start from East, go clockwise
  const userIndex = seats.indexOf(userSeat);
  const baseDiscardCount = Math.floor(Math.random() * 15) + 1; // Base number of discards
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const seatIndex = seats.indexOf(player.seat);
    
    // Calculate discard count based on turn order
    let discardCount = baseDiscardCount;
    if (seatIndex < userIndex) {
      discardCount += 1; // Players before user have 1 more discard
    }
    
    // Add discards from deck
    for (let j = 0; j < discardCount && deckIndex < deck.length; j++) {
      player.discard.push(deck[deckIndex++]);
    }
  }

  // Set dora indicators from remaining deck
  const doraIndicators = [];
  for (let i = 0; i < numDora && deckIndex < deck.length; i++) {
    doraIndicators.push(deck[deckIndex++]);
  }

  // Calculate and assign scores to players
  const scores = calculatePlayerScores(roundNumber, roundWind);
  players.forEach((player, index) => {
    player.score = scores[index];
  });

  // Calculate remaining tiles (rest of deck that hasn't been used)
  const remainingTileCount = deck.length - deckIndex - (14 - numDora);

  // Generate ID before creating quiz
  const id = DecisionQuiz.generateId(players, doraIndicators, roundWind, roundNumber);

  // Create the quiz
  const quiz = new DecisionQuiz({
    id,
    players,
    doraIndicators,
    roundWind,
    roundNumber,
    remainingTileCount,
    responses: new Map()
  });

  // Save and return
  await quiz.save();
  return quiz;
}

module.exports = {
  generateDecisionQuiz
};

