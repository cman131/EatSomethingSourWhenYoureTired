/**
 * Round Generation Service
 * Generates tournament round pairings using optimization algorithms
 * to minimize duplicate pairings between players.
 */

/**
 * Hardcoded config: roundStrategy enum -> { numberOfFinalsMatches }.
 * Used for finals round count when deciding if finals are complete.
 */
const ROUND_STRATEGY_CONFIG = {
  Scramble: { numberOfFinalsMatches: 2 },
  TieredPointsOnly: { numberOfFinalsMatches: 0 },
  TieredPointsTop4: { numberOfFinalsMatches: 2 }
};

/**
 * Get the number of finals matches for a tournament based on its roundStrategy.
 * @param {Object} tournament - Tournament doc (or { roundStrategy }).
 * @returns {number} numberOfFinalsMatches for the strategy (default 2 for unknown/legacy).
 */
function getFinalsMatchCount(tournament) {
  const strategy = tournament.roundStrategy || 'Scramble';
  const config = ROUND_STRATEGY_CONFIG[strategy];
  return config ? config.numberOfFinalsMatches : 2;
}

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
async function generatePairingsOptimized(activePlayerIds, opponentHistory, iterations = 10000) {
  // Note: activePlayerIds should already be divisible by 4 when this is called
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
 * @returns {Promise<Array>} Array of pairings with tableNumber and players array
 */
async function generatePairingsWheel(activePlayerIds, roundNumber, firstRoundPairings = null) {
  // Note: activePlayerIds should already be divisible by 4 when this is called
  // This check is kept as a safety measure but should not be needed
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
 * Add filler users to a player ID list until its length is divisible by 4.
 * @param {Array<string>} playerIds - Array of player IDs
 * @param {Object} User - User model
 * @param {number} nameOffset - Offset for filler names (e.g. 100 for "Filler 101", "Filler 102")
 * @returns {Promise<Array<string>>} Extended array of player IDs
 */
async function addFillersToPlayerList(playerIds, User, nameOffset = 0) {
  const need = (4 - (playerIds.length % 4)) % 4;
  if (need === 0) return [...playerIds];
  const result = [...playerIds];
  for (let i = 0; i < need; i++) {
    const fillerName = `Filler ${nameOffset + i + 1}`;
    let fillerUser = await User.findOne({ displayName: fillerName, isGuest: true });
    if (!fillerUser) {
      fillerUser = new User({
        displayName: fillerName,
        isGuest: true,
        email: `filler.${nameOffset + i + 1}@guest.local`
      });
      await fillerUser.save();
    }
    result.push(fillerUser._id.toString());
  }
  return result;
}

/**
 * TieredPointsOnly: round 1 = scramble all; round 2 = top/bottom by UMA, scramble per group; round 3+ = numGroups by UMA, scramble per group.
 * Lowest-UMA group may be any size; add fillers to it only so it is pair-able.
 */
async function generateRoundPairingsTieredPointsOnly(tournament, roundNumber, activePlayerIds, completedRounds, User) {
  const { computePlayerUmaMap } = require('../utils/tournamentUma');
  const opponentHistory = buildOpponentHistory(completedRounds);
  const N = activePlayerIds.length;

  if (roundNumber === 1) {
    const pairings = await generatePairingsOptimized(activePlayerIds, opponentHistory);
    return pairings.map(assignSeats);
  }

  // Round 2+: need UMA — populate games then compute
  if (tournament.rounds && tournament.rounds.length > 0) {
    await tournament.populate('rounds.pairings.game');
  }
  const umaMap = computePlayerUmaMap(tournament, false);

  const sortedByUma = [...activePlayerIds].sort((a, b) => (umaMap.get(b) ?? 0) - (umaMap.get(a) ?? 0));

  if (roundNumber === 2) {
    let topSize = Math.floor(N / 2);
    topSize = 4 * Math.floor(topSize / 4);
    if (topSize === 0) topSize = 4;
    const topHalf = sortedByUma.slice(0, topSize);
    const bottomHalf = sortedByUma.slice(topSize);
    let bottomWithFillers = bottomHalf;
    if (bottomHalf.length % 4 !== 0) {
      bottomWithFillers = await addFillersToPlayerList(bottomHalf, User, 100);
    }
    const pairingsA = await generatePairingsOptimized(topHalf, opponentHistory);
    const pairingsB = await generatePairingsOptimized(bottomWithFillers, opponentHistory);
    const tableOffset = pairingsA.length;
    pairingsB.forEach(p => { p.tableNumber += tableOffset; });
    const pairings = [...pairingsA, ...pairingsB];
    return pairings.map(assignSeats);
  }

  // Round 3+
  const maxGroups = Math.floor(N / 8) || 1;
  const numGroups = Math.min(Math.pow(2, roundNumber - 1), maxGroups);
  const numGroupsClamped = Math.max(1, numGroups);

  const sizes = [];
  if (numGroupsClamped === 1) {
    sizes.push(N);
  } else {
    const sizePerNonLast = 4 * Math.floor((N / numGroupsClamped) / 4);
    for (let g = 0; g < numGroupsClamped - 1; g++) {
      sizes.push(sizePerNonLast);
    }
    sizes.push(N - (numGroupsClamped - 1) * sizePerNonLast);
  }

  let playerOffset = 0;
  let tableOffset = 0;
  const allPairings = [];
  for (let g = 0; g < numGroupsClamped; g++) {
    const size = sizes[g];
    let groupIds = sortedByUma.slice(playerOffset, playerOffset + size);
    playerOffset += size;
    const isLastGroup = g === numGroupsClamped - 1;
    if (isLastGroup && groupIds.length % 4 !== 0) {
      groupIds = await addFillersToPlayerList(groupIds, User, 200 + g * 10);
    }
    const subPairings = await generatePairingsOptimized(groupIds, opponentHistory);
    subPairings.forEach(p => { p.tableNumber += tableOffset; });
    tableOffset += subPairings.length;
    allPairings.push(subPairings);
  }

  const pairings = allPairings.flat();
  return pairings.map(assignSeats);
}

/**
 * Main function to generate pairings for a round
 * @param {Object} tournament - Tournament document
 * @param {number} roundNumber - Round number to generate (1-indexed)
 * @returns {Promise<Array>} Array of pairings with tableNumber, players (with seat), and game
 */
async function generateRoundPairings(tournament, roundNumber) {
  const User = require('../models/User');
  
  // Get active (non-dropped) players
  const activePlayers = tournament.players.filter(p => !p.dropped);
  // Handle both ObjectId and string player IDs
  let activePlayerIds = activePlayers.map(p => {
    const playerId = p.player;
    return playerId.toString ? playerId.toString() : playerId;
  });

  // Add filler users until count is divisible by 4
  const incompletePairing = 4 - (activePlayerIds.length % 4);
  if (incompletePairing !== 4) {
    for (let i = 0; i < incompletePairing; i++) {
      const fillerName = `Filler ${i + 1}`;
      // Check if a guest user with this name already exists
      let fillerUser = await User.findOne({ 
        displayName: fillerName,
        isGuest: true 
      });
      
      // If it doesn't exist, create a new guest user with unique dummy email
      if (!fillerUser) {
        fillerUser = new User({
          displayName: fillerName,
          isGuest: true,
          email: `filler.${i + 1}@guest.local` // Unique dummy email for each filler
        });
        await fillerUser.save();
      }
      
      activePlayerIds.push(fillerUser._id.toString());
    }
  }

  // Get completed rounds (rounds before the current one)
  const completedRounds = tournament.rounds
    .filter(r => r.roundNumber < roundNumber && r.pairings && r.pairings.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const strategy = tournament.roundStrategy || 'Scramble';
  if (strategy === 'TieredPointsOnly' || strategy === 'TieredPointsTop4') {
    const pairings = await generateRoundPairingsTieredPointsOnly(tournament, roundNumber, activePlayerIds, completedRounds, User);
    return pairings;
  }

  // Scramble (or legacy)
  const opponentHistory = buildOpponentHistory(completedRounds);
  const numActivePlayers = activePlayerIds.length;
  const threshold = (12 * (roundNumber - 1)) + 4;
  
  let pairings;
  
  if (numActivePlayers > threshold && roundNumber > 1) {
    // Use wheel system for large tournaments
    const firstRound = tournament.rounds.find(r => r.roundNumber === 1);
    const firstRoundPairings = firstRound ? firstRound.pairings : null;
    pairings = await generatePairingsWheel(activePlayerIds, roundNumber, firstRoundPairings);
  } else {
    pairings = await generatePairingsOptimized(activePlayerIds, opponentHistory);
  }

  pairings = pairings.map(assignSeats);
  return pairings;
}

module.exports = {
  ROUND_STRATEGY_CONFIG,
  getFinalsMatchCount,
  generateRoundPairings,
  buildOpponentHistory,
  calculatePairingScore,
  generatePairingsOptimized,
  generatePairingsWheel,
  reconstructWheelLists,
  assignSeats
};
