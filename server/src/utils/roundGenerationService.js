/**
 * Round Generation Service
 * Generates tournament round pairings using optimization algorithms
 * to minimize duplicate pairings between players.
 */

/**
 * Build a map of how many times each pair of players has played together
 * @param {Array} rounds - Array of completed rounds with pairings
 * @returns {Map} Map with key "playerId1:playerId2" (sorted) and value as count
 */
function buildOpponentHistory(rounds) {
  const history = new Map();

  for (const round of rounds) {
    if (!round.pairings || round.pairings.length === 0) continue;

    for (const pairing of round.pairings) {
      if (!pairing.players || pairing.players.length !== 4) continue;

      // Extract player IDs, handling both ObjectId and string formats
      const playerIds = pairing.players.map(p => p.player.toString());
      
      // For each pair of players in this pairing, increment their match count
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const key = [playerIds[i], playerIds[j]].sort().join(':');
          history.set(key, (history.get(key) || 0) + 1);
        }
      }
    }
  }

  return history;
}

/**
 * Calculate the penalty score for a pairing based on duplicate matches
 * @param {Array} playerIds - Array of 4 player IDs
 * @param {Map} opponentHistory - History of previous matches
 * @returns {number} Penalty score (lower is better)
 */
function calculatePairingScore(playerIds, opponentHistory) {
  let score = 0;

  // Check each pair of players in this pairing
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const key = [playerIds[i], playerIds[j]].sort().join(':');
      const timesPlayed = opponentHistory.get(key) || 0;
      
      if (timesPlayed > 0) {
        // Penalty is the square of the number of duplicate times
        // If they've played once before (1 dupe), score = 1^2 = 1
        // If they've played twice before (2 dupes), score = 2^2 = 4
        // etc.
        score += timesPlayed * timesPlayed;
      }
    }
  }

  return score;
}


/**
 * Generate pairings using optimization algorithm
 * Tries multiple random arrangements and picks the one with lowest score
 * @param {Array} activePlayerIds - Array of active (non-dropped) player IDs
 * @param {Map} opponentHistory - History of previous matches
 * @param {number} iterations - Number of random arrangements to try (default: 10000)
 * @returns {Array} Array of pairings, each with tableNumber and players array
 */
function generatePairingsOptimized(activePlayerIds, opponentHistory, iterations = 10000) {
  // Fill empty slots
  const incompletePairing = 4 - (activePlayerIds.length % 4);
  if (incompletePairing !== 4) {
    for (let i = 0; i < incompletePairing; i++) {
      activePlayerIds.push(`Filler ${i}`);
    }
  }

  const numTables = activePlayerIds.length / 4;
  let bestPairings = null;
  let bestScore = Infinity;

  // Try many random arrangements
  for (let iter = 0; iter < iterations; iter++) {
    // Shuffle players
    const shuffled = [...activePlayerIds].sort(() => Math.random() - 0.5);
    const pairings = [];
    let totalScore = 0;

    // Create tables
    for (let table = 0; table < numTables; table++) {
      const tablePlayers = shuffled.slice(table * 4, (table + 1) * 4);
      const score = calculatePairingScore(tablePlayers, opponentHistory);
      totalScore += score;

      pairings.push({
        tableNumber: table + 1,
        players: tablePlayers.map(playerId => ({ 
          player: typeof playerId === 'string' ? playerId : playerId.toString()
        }))
      });
    }

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestPairings = pairings;
    }
  }

  return bestPairings;
}

/**
 * Reconstruct the initial wheel lists from the first round's pairings
 * @param {Array} firstRoundPairings - Pairings from round 1
 * @returns {Array} Array of 4 lists, each containing player IDs
 */
function reconstructWheelLists(firstRoundPairings) {
  const lists = [[], [], [], []];
  
  // Sort pairings by table number to ensure correct order
  const sortedPairings = [...firstRoundPairings].sort((a, b) => a.tableNumber - b.tableNumber);
  
  for (const pairing of sortedPairings) {
    if (pairing.players && pairing.players.length === 4) {
      // Extract player IDs in order (they were assigned to lists 0, 1, 2, 3)
      for (let i = 0; i < 4; i++) {
        const playerId = pairing.players[i].player;
        const playerIdStr = playerId.toString();
        lists[i].push(playerIdStr);
      }
    }
  }
  
  return lists;
}

/**
 * Generate pairings using the wheel system
 * For tournaments with enough players: greater than ((12x(rounds-1))+4)
 * @param {Array} activePlayerIds - Array of active (non-dropped) player IDs
 * @param {number} roundNumber - Current round number (1-indexed)
 * @param {Array} firstRoundPairings - Pairings from round 1 (for reconstructing lists)
 * @returns {Array} Array of pairings with tableNumber and players array
 */
function generatePairingsWheel(activePlayerIds, roundNumber, firstRoundPairings = null) {
  if (activePlayerIds.length % 4 !== 0) {
    throw new Error('Number of active players must be divisible by 4');
  }

  const numTables = activePlayerIds.length / 4;
  let lists = [[], [], [], []];
  
  if (roundNumber === 1) {
    // First round: shuffle players and distribute into 4 lists
    const shuffled = [...activePlayerIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      lists[i % 4].push(shuffled[i]);
    }
  } else {
    // Subsequent rounds: reconstruct lists from first round
    if (!firstRoundPairings || firstRoundPairings.length === 0) {
      throw new Error('First round pairings required for wheel system');
    }
    
    lists = reconstructWheelLists(firstRoundPairings);
    
    // Apply wheel rotations based on round number
    // Round 2: list 0 moves up 1, list 1 moves up 2, list 2 moves up 3, list 3 moves up 4
    // Round 3: list 0 moves up 2, list 1 moves up 4, list 2 moves up 6, list 3 moves up 8
    // etc.
    // Total moves for round N: list i moves (N-1) * (i+1) positions
    for (let listIndex = 0; listIndex < 4; listIndex++) {
      const moves = (roundNumber - 1) * (listIndex + 1);
      for (let move = 0; move < moves; move++) {
        lists[listIndex].push(lists[listIndex].shift());
      }
    }
  }

  // Create pairings from the lists
  const pairings = [];
  for (let table = 0; table < numTables; table++) {
    const tablePlayers = [
      lists[0][table],
      lists[1][table],
      lists[2][table],
      lists[3][table]
    ].filter(Boolean); // Remove undefined if lists are uneven

    if (tablePlayers.length === 4) {
      pairings.push({
        tableNumber: table + 1,
        players: tablePlayers.map(playerId => ({ 
          player: typeof playerId === 'string' ? playerId : playerId.toString()
        }))
      });
    }
  }

  return pairings;
}

/**
 * Assign seats (East, South, West, North) to players in a pairing
 * @param {Array} pairing - Pairing object with players array
 * @returns {Array} Pairing with seat assignments
 */
function assignSeats(pairing) {
  const seats = ['East', 'South', 'West', 'North'];
  
  // Shuffle seats for fairness (or use a deterministic method)
  const shuffledSeats = [...seats].sort(() => Math.random() - 0.5);
  
  return {
    ...pairing,
    players: pairing.players.map((playerEntry, index) => ({
      ...playerEntry,
      seat: shuffledSeats[index]
    }))
  };
}

/**
 * Main function to generate pairings for a round
 * @param {Object} tournament - Tournament document
 * @param {number} roundNumber - Round number to generate (1-indexed)
 * @returns {Array} Array of pairings with tableNumber, players (with seat), and game
 */
function generateRoundPairings(tournament, roundNumber) {
  // Get active (non-dropped) players
  const activePlayers = tournament.players.filter(p => !p.dropped);
  // Handle both ObjectId and string player IDs
  const activePlayerIds = activePlayers.map(p => {
    const playerId = p.player;
    return playerId.toString ? playerId.toString() : playerId;
  });

  if (activePlayerIds.length % 4 !== 0) {
    throw new Error(`Cannot generate pairings: ${activePlayerIds.length} active players is not divisible by 4`);
  }

  // Get completed rounds (rounds before the current one)
  const completedRounds = tournament.rounds
    .filter(r => r.roundNumber < roundNumber && r.pairings && r.pairings.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  // Build opponent history
  const opponentHistory = buildOpponentHistory(completedRounds);

  // Determine which method to use
  const numActivePlayers = activePlayerIds.length;
  const threshold = (12 * (roundNumber - 1)) + 4;
  
  let pairings;
  
  if (numActivePlayers > threshold && roundNumber > 1) {
    // Use wheel system for large tournaments
    // Get first round pairings to reconstruct lists
    const firstRound = tournament.rounds.find(r => r.roundNumber === 1);
    const firstRoundPairings = firstRound ? firstRound.pairings : null;
    pairings = generatePairingsWheel(activePlayerIds, roundNumber, firstRoundPairings);
  } else {
    // Use optimization algorithm
    pairings = generatePairingsOptimized(activePlayerIds, opponentHistory);
  }

  // Assign seats to each pairing
  pairings = pairings.map(assignSeats);

  return pairings;
}

module.exports = {
  generateRoundPairings,
  buildOpponentHistory,
  calculatePairingScore,
  generatePairingsOptimized,
  generatePairingsWheel,
  reconstructWheelLists,
  assignSeats
};
