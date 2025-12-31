const Game = require('../models/Game');
const DiscardQuiz = require('../models/DiscardQuiz');
const User = require('../models/User');

/**
 * Calculate user statistics needed for achievement resolution
 * @param {string|ObjectId} userId - The user ID
 * @returns {Promise<Object>} User statistics object
 */
async function calculateUserStats(userId) {
  const userIdString = userId.toString();
  
  // Get all games where user is involved (submitted or played)
  const allGames = await Game.find({
    $or: [
      { submittedBy: userId },
      { 'players.player': userId }
    ]
  }).sort({ gameDate: 1, createdAt: 1 }); // Sort chronologically

  // Basic counts
  const gamesSubmitted = allGames.filter(g => g.submittedBy.toString() === userIdString).length;
  const gamesPlayed = allGames.filter(g => {
    return g.players.some(p => p.player.toString() === userIdString);
  }).length;

  // Games won (user has highest score)
  let gamesWon = 0;
  const userGameData = [];
  
  allGames.forEach(game => {
    const userPlayer = game.players.find(p => p.player.toString() === userIdString);
    if (userPlayer) {
      const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
      const isWinner = sortedPlayers[0].player.toString() === userIdString;
      if (isWinner) gamesWon++;
      
      userGameData.push({
        gameDate: game.gameDate,
        score: userPlayer.score,
        position: userPlayer.position,
        isWinner,
        game
      });
    }
  });

  // Win streak calculation
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  for (let i = userGameData.length - 1; i >= 0; i--) {
    if (userGameData[i].isWinner) {
      currentWinStreak++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
    }
  }

  // Scores
  const allScores = userGameData.map(g => g.score);
  const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;
  const totalScore = allScores.reduce((sum, score) => sum + score, 0);

  // Position counts
  const positionCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  userGameData.forEach(g => {
    positionCounts[g.position] = (positionCounts[g.position] || 0) + 1;
  });

  // Consecutive games without last place
  let consecutiveNonLastPlace = 0;
  let maxConsecutiveNonLastPlace = 0;
  for (let i = userGameData.length - 1; i >= 0; i--) {
    if (userGameData[i].position <= 3) {
      consecutiveNonLastPlace++;
      maxConsecutiveNonLastPlace = Math.max(maxConsecutiveNonLastPlace, consecutiveNonLastPlace);
    } else {
      consecutiveNonLastPlace = 0;
    }
  }

  // Consecutive days played
  const uniqueDays = new Set();
  userGameData.forEach(g => {
    const day = new Date(g.gameDate).toDateString();
    uniqueDays.add(day);
  });
  
  // Calculate consecutive days (most recent streak)
  const sortedDays = Array.from(uniqueDays)
    .map(day => new Date(day))
    .sort((a, b) => b - a);
  
  let consecutiveDays = 0;
  if (sortedDays.length > 0) {
    consecutiveDays = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedDays.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);
      
      const hasGame = sortedDays.some(day => {
        const dayStr = day.toDateString();
        const checkStr = checkDate.toDateString();
        return dayStr === checkStr;
      });
      
      if (hasGame) {
        consecutiveDays = i + 1;
      } else {
        break;
      }
    }
  }

  // Games in a single day
  const gamesByDay = {};
  userGameData.forEach(g => {
    const day = new Date(g.gameDate).toDateString();
    gamesByDay[day] = (gamesByDay[day] || 0) + 1;
  });
  const maxGamesInADay = Math.max(...Object.values(gamesByDay), 0);

  // Time played at (hour of day)
  const hoursPlayed = userGameData.map(g => {
    const date = new Date(g.gameDate);
    return date.getHours();
  });

  // Games verified
  const gamesVerified = await Game.countDocuments({
    verifiedBy: userId
  });

  // Quizzes completed
  const allQuizzes = await DiscardQuiz.find({});
  let quizzesCompleted = 0;
  for (const quiz of allQuizzes) {
    if (quiz.responses && quiz.responses.size > 0) {
      for (const [, userIds] of quiz.responses.entries()) {
        const hasResponded = userIds.some(id => {
          const idString = id.toString ? id.toString() : id;
          return idString === userIdString;
        });
        if (hasResponded) {
          quizzesCompleted++;
          break;
        }
      }
    }
  }

  // Players played with
  const playersPlayedWith = new Set();
  allGames.forEach(game => {
    game.players.forEach(p => {
      if (p.player.toString() !== userIdString) {
        playersPlayedWith.add(p.player.toString());
      }
    });
  });

  return {
    gamesPlayed,
    gamesWon,
    gamesSubmitted,
    gamesVerified,
    winStreak: maxWinStreak,
    highestScore,
    lowestScore,
    totalScore,
    positionCounts,
    consecutiveNonLastPlace: maxConsecutiveNonLastPlace,
    consecutiveDays,
    maxGamesInADay,
    hoursPlayed,
    quizzesCompleted,
    playersPlayedWithCount: playersPlayedWith.size,
    userGameData // Keep for additional calculations if needed
  };
}

/**
 * Get leaderboard value for a specific metric type
 * @param {string} requirementType - The type of requirement
 * @param {string} comparisonType - The comparison type (for determining min vs max)
 * @returns {Promise<Object>} Object with userId as key and value as value
 */
async function getLeaderboardValues(requirementType, comparisonType = '>=') {
  const allUsers = await User.find({}).select('_id');
  const leaderboard = {};

  for (const user of allUsers) {
    const stats = await calculateUserStats(user._id);
    let value = 0;

    switch (requirementType) {
      case 'PlayedGames':
        value = stats.gamesPlayed;
        break;
      case 'WonGames':
        value = stats.gamesWon;
        break;
      case 'WinStreak':
        value = stats.winStreak;
        break;
      case 'ScoredPoints':
        // For grand achievements, determine if we want highest or lowest
        // If comparison is <= or <, we're looking for lowest (e.g., "Grand Turtle")
        // Otherwise, we're looking for highest (e.g., "Grand Scorer")
        if (comparisonType === '<=' || comparisonType === '<') {
          value = stats.lowestScore || 0;
        } else {
          value = stats.highestScore;
        }
        break;
      case 'AccumulatedPoints':
        value = stats.totalScore;
        break;
      case 'CompletedQuizzes':
        value = stats.quizzesCompleted;
        break;
      case 'SubmittedGames':
        value = stats.gamesSubmitted;
        break;
      case 'VerifiedGames':
        value = stats.gamesVerified;
        break;
      case 'ConsecutivePlayedGames':
        value = stats.consecutiveNonLastPlace;
        break;
      case 'ConsecutivePlayedDays':
        value = stats.consecutiveDays;
        break;
      case 'GamesInADay':
        value = stats.maxGamesInADay;
        break;
      default:
        value = 0;
    }

    leaderboard[user._id.toString()] = value;
  }

  return leaderboard;
}

/**
 * Evaluate a single requirement against user stats
 * @param {Object} requirement - The requirement object
 * @param {Object} userStats - User statistics
 * @param {Object} leaderboard - Leaderboard values (for grand achievements)
 * @param {string} userId - User ID (for grand achievements)
 * @param {Array} allRequirements - All requirements for context (for combined checks)
 * @returns {boolean} Whether the requirement is met
 */
function evaluateRequirement(requirement, userStats, leaderboard, userId, allRequirements = []) {
  const { type, comparisonType, requirementsValue, isGrand } = requirement;
  const userIdString = userId.toString();
  
  // Check if this is part of a combined requirement (e.g., WonGames + ScoredPoints)
  const hasWonGamesRequirement = allRequirements.some(req => req.type === 'WonGames' && req !== requirement);

  // Handle grand achievements (compare against all users)
  if (isGrand) {
    if (!leaderboard) {
      return false; // Can't evaluate grand without leaderboard
    }

    const userValue = leaderboard[userIdString] || 0;
    const allValues = Object.values(leaderboard).filter(v => v > 0); // Filter out zeros for meaningful comparison
    
    if (allValues.length === 0) {
      return false; // No users have this metric
    }
    
    // For <= or < comparisons, we want the minimum (e.g., lowest score for "Grand Turtle")
    // For >= or > comparisons, we want the maximum (e.g., highest score for "Grand Scorer")
    let targetValue;
    if (comparisonType === '<=' || comparisonType === '<') {
      targetValue = Math.min(...allValues);
    } else {
      targetValue = Math.max(...allValues);
    }
    
    // User must have the target value (min or max) and meet the threshold requirement
    if (comparisonType === '<=' || comparisonType === '<') {
      return userValue === targetValue && userValue <= requirementsValue;
    } else {
      return userValue === targetValue && userValue >= requirementsValue;
    }
  }

  // Regular achievements - get user's value for this requirement type
  let userValue = 0;

  switch (type) {
    case 'PlayedGames':
      userValue = userStats.gamesPlayed;
      break;
    case 'WonGames':
      userValue = userStats.gamesWon;
      break;
    case 'WinStreak':
      userValue = userStats.winStreak;
      break;
    case 'ScoredPoints':
      // If combined with WonGames requirement and using < comparison, 
      // check if user has won any game with score < requirementsValue
      if (hasWonGamesRequirement && comparisonType === '<') {
        // Check if user has won any game with score < requirementsValue
        const wonGameScores = userStats.userGameData
          .filter(g => g.isWinner)
          .map(g => g.score);
        // Return 1 if any won game has score < requirementsValue, 0 otherwise
        userValue = wonGameScores.some(score => score < requirementsValue) ? 1 : 0;
      } else if (hasWonGamesRequirement && comparisonType === '<=') {
        // Similar for <= comparison
        const wonGameScores = userStats.userGameData
          .filter(g => g.isWinner)
          .map(g => g.score);
        userValue = wonGameScores.some(score => score <= requirementsValue) ? 1 : 0;
      } else {
        // Otherwise, check highest score overall
        userValue = userStats.highestScore;
      }
      break;
    case 'AccumulatedPoints':
      userValue = userStats.totalScore;
      break;
    case 'CompletedQuizzes':
      userValue = userStats.quizzesCompleted;
      break;
    case 'SubmittedGames':
      userValue = userStats.gamesSubmitted;
      break;
    case 'VerifiedGames':
      userValue = userStats.gamesVerified;
      break;
    case 'PlayersPlayedWith':
      userValue = userStats.playersPlayedWithCount;
      break;
    case 'ConsecutivePlayedGames':
      userValue = userStats.consecutiveNonLastPlace;
      break;
    case 'ConsecutivePlayedDays':
      userValue = userStats.consecutiveDays;
      break;
    case 'GamesInADay':
      userValue = userStats.maxGamesInADay;
      break;
    case 'Position':
      // Position requirements need special handling - check if user has games with this position
      // For <= 2, check if user has enough games in positions 1 or 2
      if (comparisonType === '<=') {
        // Count games where user finished in position <= requirementsValue
        let count = 0;
        userStats.userGameData.forEach(g => {
          if (g.position <= requirementsValue) count++;
        });
        userValue = count;
      } else if (comparisonType === '=') {
        // Count games in specific position (usually 4 for last place)
        userValue = userStats.positionCounts[requirementsValue] || 0;
      } else {
        userValue = 0;
      }
      break;
    case 'TimePlayedAt':
      // Check if user has played at this time
      if (comparisonType === '<') {
        // Before this hour (e.g., before 9 AM)
        return userStats.hoursPlayed.some(h => h > 6 && h < requirementsValue) ? 1 : 0;
      } else if (comparisonType === '>=') {
        // At or after this hour (e.g., after 11 PM)
        return userStats.hoursPlayed.some(h => h >= requirementsValue || h < 5) ? 1 : 0;
      } else {
        userValue = 0;
      }
      break;
    default:
      userValue = 0;
  }

  // Apply comparison
  // Special handling for ScoredPoints when combined with WonGames (boolean check)
  if (type === 'ScoredPoints' && hasWonGamesRequirement && (comparisonType === '<' || comparisonType === '<=')) {
    // This is a boolean check - did user win a game with score meeting the criteria?
    return userValue >= 1; // userValue is 1 if condition met, 0 otherwise
  }
  
  switch (comparisonType) {
    case '>=':
      return userValue >= requirementsValue;
    case '<=':
      return userValue <= requirementsValue;
    case '>':
      return userValue > requirementsValue;
    case '<':
      return userValue < requirementsValue;
    case '=':
      return userValue === requirementsValue;
    default:
      return false;
  }
}

/**
 * Resolve whether a user has earned a specific achievement
 * @param {string|ObjectId} userId - The user ID
 * @param {Object} achievement - The achievement object (from database)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeLeaderboard - Whether to calculate leaderboard for grand achievements (default: true)
 * @returns {Promise<Object>} Resolution result with earned status and details
 */
async function resolveAchievement(userId, achievement, options = {}) {
  const { includeLeaderboard = true } = options;

  try {
    // Calculate user statistics
    const userStats = await calculateUserStats(userId);

    // Check if achievement has grand requirements
    const hasGrandRequirement = achievement.requirements.some(req => req.isGrand);

    // Get leaderboard if needed for grand achievements
    let leaderboard = null;
    if (hasGrandRequirement && includeLeaderboard) {
      // For grand achievements, we need to determine which requirement type to compare
      const grandRequirement = achievement.requirements.find(req => req.isGrand);
      if (grandRequirement) {
        leaderboard = await getLeaderboardValues(grandRequirement.type, grandRequirement.comparisonType);
      }
    }

    // Evaluate all requirements (all must be met)
    const requirementResults = achievement.requirements.map(requirement => {
      const met = evaluateRequirement(requirement, userStats, leaderboard, userId, achievement.requirements);
      return {
        requirement,
        met
      };
    });

    const allRequirementsMet = requirementResults.every(result => result.met);

    return {
      earned: allRequirementsMet,
      achievement: {
        _id: achievement._id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        requirements: achievement.requirements
      },
      requirementResults,
      userStats: {
        gamesPlayed: userStats.gamesPlayed,
        gamesWon: userStats.gamesWon,
        winStreak: userStats.winStreak,
        highestScore: userStats.highestScore,
        totalScore: userStats.totalScore,
        quizzesCompleted: userStats.quizzesCompleted,
        gamesSubmitted: userStats.gamesSubmitted,
        gamesVerified: userStats.gamesVerified
      }
    };
  } catch (error) {
    console.error('Error resolving achievement:', error);
    throw error;
  }
}

/**
 * Resolve all achievements for a user
 * @param {string|ObjectId} userId - The user ID
 * @param {Object} options - Optional configuration
 * @returns {Promise<Array>} Array of resolution results for all achievements
 */
async function resolveAllAchievements(userId, options = {}) {
  const Achievement = require('../models/Achievement');
  const achievements = await Achievement.find({});
  
  const results = await Promise.all(
    achievements.map(achievement => resolveAchievement(userId, achievement, options))
  );

  return results;
}

/**
 * Get the user(s) who currently hold a given Grand achievement
 * @param {Object|string} achievement - The achievement object or achievement name/ID
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Object with users array and achievement info
 */
async function getGrandAchievementHolder(achievement, options = {}) {
  const Achievement = require('../models/Achievement');
  
  try {
    // If achievement is a string, try to find it by name or ID
    let achievementDoc;
    if (typeof achievement === 'string') {
      achievementDoc = await Achievement.findOne({
        $or: [
          { name: achievement },
          { _id: achievement }
        ]
      });
    } else {
      achievementDoc = achievement;
    }

    if (!achievementDoc) {
      throw new Error('Achievement not found');
    }

    // Check if this is a grand achievement
    const grandRequirement = achievementDoc.requirements.find(req => req.isGrand);
    if (!grandRequirement) {
      return {
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon
        },
        isGrand: false,
        users: [],
        message: 'This is not a Grand achievement'
      };
    }

    // Get leaderboard for the grand requirement type
    const leaderboard = await getLeaderboardValues(
      grandRequirement.type,
      grandRequirement.comparisonType
    );

    const allValues = Object.values(leaderboard).filter(v => v > 0);
    
    if (allValues.length === 0) {
      return {
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon
        },
        isGrand: true,
        users: [],
        message: 'No users meet the minimum requirements for this achievement'
      };
    }

    // Determine target value (min or max depending on comparison type)
    let targetValue;
    if (grandRequirement.comparisonType === '<=' || grandRequirement.comparisonType === '<') {
      targetValue = Math.min(...allValues);
    } else {
      targetValue = Math.max(...allValues);
    }

    // Find all users with the target value who also meet the threshold
    const holderUserIds = Object.keys(leaderboard).filter(userId => {
      const userValue = leaderboard[userId] || 0;
      const meetsThreshold = grandRequirement.comparisonType === '<=' || grandRequirement.comparisonType === '<'
        ? userValue <= grandRequirement.requirementsValue
        : userValue >= grandRequirement.requirementsValue;
      
      return userValue === targetValue && meetsThreshold;
    });

    // Get user details and their stats
    const users = await Promise.all(
      holderUserIds.map(async (userId) => {
        const user = await User.findById(userId).select('displayName email avatar _id');
        const stats = await calculateUserStats(userId);
        
        return {
          user: {
                _id: user._id,
                displayName: user.displayName,
                email: user.email,
                avatar: user.avatar
          },
          value: leaderboard[userId],
          stats: {
            gamesPlayed: stats.gamesPlayed,
            gamesWon: stats.gamesWon,
            winStreak: stats.winStreak,
            highestScore: stats.highestScore,
            totalScore: stats.totalScore,
            quizzesCompleted: stats.quizzesCompleted,
            gamesSubmitted: stats.gamesSubmitted,
            gamesVerified: stats.gamesVerified
          }
        };
      })
    );

    return {
      achievement: {
        _id: achievementDoc._id,
        name: achievementDoc.name,
        description: achievementDoc.description,
        icon: achievementDoc.icon
      },
      isGrand: true,
      users,
      targetValue,
      requirementType: grandRequirement.type,
      count: users.length
    };
  } catch (error) {
    console.error('Error getting grand achievement holder:', error);
    throw error;
  }
}

module.exports = {
  resolveAchievement,
  resolveAllAchievements,
  getGrandAchievementHolder,
  calculateUserStats,
  getLeaderboardValues,
  evaluateRequirement
};

