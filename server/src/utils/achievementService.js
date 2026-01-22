const Game = require('../models/Game');
const DiscardQuiz = require('../models/DiscardQuiz');
const User = require('../models/User');
const Tournament = require('../models/Tournament');

/**
 * Calculate user statistics needed for achievement resolution
 * @param {string|ObjectId} userId - The user ID
 * @returns {Promise<Object>} User statistics object
 */
async function calculateUserStats(userId) {
  const userIdString = userId.toString();
  
  // Get all verified games where user is involved (submitted or played)
  const allGames = await Game.find({
    verified: true,
    $or: [
      { submittedBy: userId },
      { 'players.player': userId }
    ]
  }).sort({ gameDate: 1 }); // Sort chronologically

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
        rank: userPlayer.rank,
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

  // Rank counts
  const rankCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  userGameData.forEach(g => {
    rankCounts[g.rank] = (rankCounts[g.rank] || 0) + 1;
  });

  // Consecutive games without last place
  let consecutiveNonLastPlace = 0;
  let maxConsecutiveNonLastPlace = 0;
  for (let i = userGameData.length - 1; i >= 0; i--) {
    if (userGameData[i].rank <= 3) {
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

  // Consecutive days played
  let currentDaysPlayed = 0;
  let consecutiveDays = 0;
  previousDay = null;
  for (let i = 0; i < sortedDays.length; i++) {
    previousDay = previousDay ? previousDay.setDate(previousDay.getDate() + 1) : null;
    if (previousDay && sortedDays[i].getDate() == previousDay.getDate()) {
      currentDaysPlayed++;
      consecutiveDays = Math.max(consecutiveDays, currentDaysPlayed);
    } else {
      currentDaysPlayed = 0;
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
    verified: true,
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

  // Tournament statistics
  // Count tournaments where user is a player and hasn't dropped
  const allTournaments = await Tournament.find({
    'players.player': userId,
    status: 'Completed'
  }).select('players');
  
  let tournamentsPlayed = 0;
  allTournaments.forEach(tournament => {
    const userPlayer = tournament.players.find(
      p => p.player.toString() === userIdString && !p.dropped
    );
    if (userPlayer) {
      tournamentsPlayed++;
    }
  });

  // Count tournaments won (user is first in top4 array)
  const completedTournaments = await Tournament.find({
    status: 'Completed',
    top4: { $exists: true, $ne: [] }
  }).select('top4');
  
  let tournamentsWon = 0;
  completedTournaments.forEach(tournament => {
    if (tournament.top4 && tournament.top4.length > 0) {
      const winnerId = tournament.top4[0].toString();
      if (winnerId === userIdString) {
        tournamentsWon++;
      }
    }
  });

  const tournamentsCreated = await Tournament.countDocuments({
    createdBy: userId
  });

  const tournamentTop4 = await Tournament.countDocuments({
    status: 'Completed',
    top4: userId
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
    rankCounts,
    consecutiveNonLastPlace: maxConsecutiveNonLastPlace,
    consecutiveDays,
    maxGamesInADay,
    hoursPlayed,
    quizzesCompleted,
    playersPlayedWithCount: playersPlayedWith.size,
    tournamentsPlayed,
    tournamentsWon,
    tournamentsCreated,
    tournamentTop4,
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
      case 'TournamentsPlayed':
        value = stats.tournamentsPlayed;
        break;
      case 'TournamentsWon':
        value = stats.tournamentsWon;
        break;
      case 'TournamentsCreated':
        value = stats.tournamentsCreated;
        break;
      case 'TournamentTop4':
        value = stats.tournamentTop4;
        break;
      case 'Position':
        // For Rank leaderboard (used by Grand Caboose), count last place finishes (rank 4)
        value = stats.rankCounts[4] || 0;
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
    case 'TournamentsPlayed':
      userValue = userStats.tournamentsPlayed;
      break;
    case 'TournamentsWon':
      userValue = userStats.tournamentsWon;
      break;
    case 'TournamentsCreated':
      userValue = userStats.tournamentsCreated;
      break;
    case 'TournamentTop4':
      userValue = userStats.tournamentTop4;
      break;
    case 'Position':
      // Rank requirements need special handling - check if user has games with this rank
      // For <= 2, check if user has enough games in ranks 1 or 2
      if (comparisonType === '<=') {
        // Count games where user finished in rank <= requirementsValue
        userValue = 0;
        userStats.userGameData.forEach(g => {
          if (g.rank <= requirementsValue) userValue++;
        });
      } else if (comparisonType === '=') {
        // Count games in specific rank (usually 4 for last place)
        userValue = userStats.rankCounts[requirementsValue] || 0;
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
 * Categorize an achievement based on its requirements or explicit category
 * @param {Object} achievement - The achievement object
 * @returns {string} The category name
 */
function getAchievementCategory(achievement) {
  // If achievement has explicit category, use it
  if (achievement.category) {
    return achievement.category;
  }

  // Otherwise infer from requirements (backward compatibility)
  if (!achievement.requirements || achievement.requirements.length === 0) {
    return 'Other';
  }

  // Get the primary requirement type (first requirement, or grand requirement if present)
  const grandRequirement = achievement.requirements.find(req => req.isGrand);
  const primaryRequirement = grandRequirement || achievement.requirements[0];
  const requirementType = primaryRequirement.type;

  // Map requirement types to categories
  const categoryMap = {
    'PlayedGames': 'GamesPlayed',
    'WonGames': 'Victories',
    'WinStreak': 'WinStreaks',
    'ScoredPoints': 'Scores',
    'AccumulatedPoints': 'AccumulatedScores',
    'Position': 'Positions',
    'CompletedQuizzes': 'Quizzes',
    'SubmittedGames': 'Submissions',
    'VerifiedGames': 'Verifications',
    'PlayersPlayedWith': 'Social',
    'ConsecutivePlayedGames': 'Consistency',
    'ConsecutivePlayedDays': 'Consistency',
    'TimePlayedAt': 'TimeBased',
    'GamesInADay': 'TimeBased',
    'TournamentsPlayed': 'Tournaments',
    'TournamentsWon': 'Tournaments',
    'TournamentsCreated': 'Tournaments',
    'TournamentTop4': 'Tournaments'
  };

  return categoryMap[requirementType] || 'Other';
}

/**
 * Group achievements by category
 * @param {Array} achievements - Array of achievement objects
 * @returns {Object} Object with category names as keys and arrays of achievements as values
 */
function groupAchievementsByCategory(achievements) {
  const grouped = {};

  achievements.forEach(achievement => {
    const category = getAchievementCategory(achievement);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(achievement);
  });

  return grouped;
}

/**
 * Filter achievements by category
 * @param {Array} achievements - Array of achievement objects
 * @param {string|Array<string>} categories - Category name(s) to filter by
 * @returns {Array} Filtered achievements
 */
function filterAchievementsByCategory(achievements, categories) {
  const categoryArray = Array.isArray(categories) ? categories : [categories];
  const categorySet = new Set(categoryArray);

  return achievements.filter(achievement => {
    const category = getAchievementCategory(achievement);
    return categorySet.has(category);
  });
}

/**
 * Evaluate a special achievement by name (for complex cases)
 * @param {string} achievementName - The achievement name
 * @param {Object} userStats - User statistics
 * @param {Object} leaderboard - Leaderboard values (for grand achievements)
 * @param {string} userId - User ID
 * @param {Object} achievement - Full achievement object
 * @returns {Object|null} Evaluation result or null if not a special case
 */
function evaluateSpecialAchievement(achievementName, userStats, leaderboard, userId, achievement) {
  const userIdString = userId.toString();

  switch (achievementName) {
    case 'Close Call':
      // Won a game with less than 30,000 points
      const wonGameScores = userStats.userGameData
        .filter(g => g.isWinner)
        .map(g => g.score);
      const hasLowScoreWin = wonGameScores.some(score => score < 30000);
      return {
        earned: hasLowScoreWin,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: userStats.gamesWon >= 1,
            userValue: userStats.gamesWon,
            targetValue: 1,
            progress: Math.min(userStats.gamesWon / 1, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: hasLowScoreWin,
            userValue: hasLowScoreWin ? 1 : 0,
            targetValue: 30000,
            progress: hasLowScoreWin ? 1 : 0
          }
        ]
      };

    case 'Top Performer':
      // Finished in 1st or 2nd place 20 times
      const top2Count = userStats.userGameData.filter(g => g.rank <= 2).length;
      return {
        earned: top2Count >= 20,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: userStats.gamesPlayed >= 20,
            userValue: userStats.gamesPlayed,
            targetValue: 20,
            progress: Math.min(userStats.gamesPlayed / 20, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: top2Count >= 20,
            userValue: top2Count,
            targetValue: 20,
            progress: Math.min(top2Count / 20, 1)
          }
        ]
      };

    case 'Consistent':
      // Finished in 1st or 2nd place 50 times
      const top2Count50 = userStats.userGameData.filter(g => g.rank <= 2).length;
      return {
        earned: top2Count50 >= 50,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: userStats.gamesPlayed >= 50,
            userValue: userStats.gamesPlayed,
            targetValue: 50,
            progress: Math.min(userStats.gamesPlayed / 50, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: top2Count50 >= 50,
            userValue: top2Count50,
            targetValue: 50,
            progress: Math.min(top2Count50 / 50, 1)
          }
        ]
      };

    case 'Never Last':
      // Avoided last place for 20 consecutive games
      const consecutiveNonLast = userStats.consecutiveNonLastPlace;
      return {
        earned: consecutiveNonLast >= 20,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: consecutiveNonLast >= 20,
            userValue: consecutiveNonLast,
            targetValue: 20,
            progress: Math.min(consecutiveNonLast / 20, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: true, // rank <= 3 is inherent in consecutiveNonLastPlace calculation
            userValue: 1,
            targetValue: 3,
            progress: 1
          }
        ]
      };

    case 'Grand Wall':
      // Avoided last place for the most consecutive games (grand)
      if (!leaderboard) return null;
      const userConsecutive = userStats.consecutiveNonLastPlace;
      const allConsecutive = Object.values(leaderboard).filter(v => v > 0);
      if (allConsecutive.length === 0) {
        return { earned: false, requirementResults: [] };
      }
      const maxConsecutive = Math.max(...allConsecutive);
      const isLeader = userConsecutive === maxConsecutive && userConsecutive >= 3;

      return {
        earned: isLeader,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: isLeader,
            userValue: userConsecutive,
            targetValue: maxConsecutive,
            progress: isLeader ? 1 : Math.min(userConsecutive / maxConsecutive, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: true,
            userValue: 1,
            targetValue: 3,
            progress: 1
          }
        ]
      };

    case 'Grand Caboose':
      // Finished last place the most times (grand)
      if (!leaderboard) return null;
      const lastPlaceCount = userStats.rankCounts[4] || 0;
      const allLastPlace = Object.values(leaderboard).filter(v => v > 0);
      if (allLastPlace.length === 0) {
        return { earned: false, requirementResults: [] };
      }
      const maxLastPlace = Math.max(...allLastPlace);
      const isLastPlaceLeader = lastPlaceCount === maxLastPlace && lastPlaceCount >= 1 && userStats.gamesPlayed >= 8;
      return {
        earned: isLastPlaceLeader,
        requirementResults: [
          {
            requirement: achievement.requirements[0],
            met: userStats.gamesPlayed >= 8,
            userValue: userStats.gamesPlayed,
            targetValue: 8,
            progress: Math.min(userStats.gamesPlayed / 8, 1)
          },
          {
            requirement: achievement.requirements[1],
            met: isLastPlaceLeader,
            userValue: lastPlaceCount,
            targetValue: maxLastPlace,
            progress: isLastPlaceLeader ? 1 : Math.min(lastPlaceCount / maxLastPlace, 1)
          }
        ]
      };

    default:
      return null; // Not a special case
  }
}

/**
 * Evaluate a single requirement individually
 * @param {Object} requirement - The requirement object
 * @param {Object} userStats - User statistics
 * @param {Object} leaderboard - Leaderboard values (for grand achievements)
 * @param {string} userId - User ID (for grand achievements)
 * @param {Array} allRequirements - All requirements for context (for combined checks)
 * @returns {Object} Evaluation result with met status and details
 */
function evaluateRequirementIndividually(requirement, userStats, leaderboard, userId, allRequirements = []) {
  const met = evaluateRequirement(requirement, userStats, leaderboard, userId, allRequirements);
  
  // Get the user's value for this requirement
  let userValue = 0;
  const { type, comparisonType, requirementsValue } = requirement;
  const userIdString = userId.toString();

  // Handle grand achievements
  if (requirement.isGrand && leaderboard) {
    userValue = leaderboard[userIdString] || 0;
  } else {
    // Regular achievements - get user's value
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
        const hasWonGamesRequirement = allRequirements.some(req => req.type === 'WonGames' && req !== requirement);
        if (hasWonGamesRequirement && (comparisonType === '<' || comparisonType === '<=')) {
          const wonGameScores = userStats.userGameData
            .filter(g => g.isWinner)
            .map(g => g.score);
          userValue = wonGameScores.some(score => 
            comparisonType === '<' ? score < requirementsValue : score <= requirementsValue
          ) ? 1 : 0;
        } else {
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
      case 'TournamentsPlayed':
        userValue = userStats.tournamentsPlayed;
        break;
      case 'TournamentsWon':
        userValue = userStats.tournamentsWon;
        break;
      case 'TournamentsCreated':
        userValue = userStats.tournamentsCreated;
        break;
      case 'TournamentTop4':
        userValue = userStats.tournamentTop4;
        break;
      case 'Position':
        if (comparisonType === '<=') {
          userValue = 0;
          userStats.userGameData.forEach(g => {
            if (g.rank <= requirementsValue) userValue++;
          });
        } else if (comparisonType === '=') {
          userValue = userStats.rankCounts[requirementsValue] || 0;
        }
        break;
      case 'TimePlayedAt':
        if (comparisonType === '<') {
          userValue = userStats.hoursPlayed.some(h => h > 6 && h < requirementsValue) ? 1 : 0;
        } else if (comparisonType === '>=') {
          userValue = userStats.hoursPlayed.some(h => h >= requirementsValue || h < 5) ? 1 : 0;
        }
        break;
      default:
        userValue = 0;
    }
  }

  return {
    requirement,
    met,
    userValue,
    targetValue: requirementsValue,
    progress: comparisonType === '>=' || comparisonType === '>' 
      ? Math.min(userValue / requirementsValue, 1) 
      : (comparisonType === '<=' || comparisonType === '<' 
          ? (userValue <= requirementsValue ? 1 : 0)
          : (userValue === requirementsValue ? 1 : 0))
  };
}

/**
 * Resolve achievements for a user, filtering by category first
 * @param {string|ObjectId} userId - The user ID
 * @param {string|Array<string>} categories - Category name(s) to filter by (optional)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeLeaderboard - Whether to calculate leaderboard for grand achievements (default: true)
 * @param {boolean} options.evaluateIndividually - Whether to evaluate each requirement individually (default: true)
 * @returns {Promise<Object>} Resolution result grouped by category
 */
async function resolveAchievementsByCategory(userId, categories = null, options = {}) {
  const { includeLeaderboard = true, evaluateIndividually = true } = options;
  const Achievement = require('../models/Achievement');

  try {
    // Get all achievements
    let achievements = await Achievement.find({});

    // Filter by category if specified
    if (categories) {
      achievements = filterAchievementsByCategory(achievements, categories);
    }

    // Group by category
    const groupedAchievements = groupAchievementsByCategory(achievements);

    // Calculate user statistics once
    const userStats = await calculateUserStats(userId);

    // Determine which categories need leaderboards (for grand achievements)
    const categoriesNeedingLeaderboard = new Set();
    achievements.forEach(achievement => {
      const hasGrandRequirement = achievement.requirements.some(req => req.isGrand);
      if (hasGrandRequirement) {
        const category = getAchievementCategory(achievement);
        categoriesNeedingLeaderboard.add(category);
      }
    });

    // Pre-calculate leaderboards for categories that need them
    const leaderboardsByCategory = {};
    if (includeLeaderboard) {
      for (const category of categoriesNeedingLeaderboard) {
        // Find a grand achievement in this category to determine the requirement type
        const categoryAchievements = groupedAchievements[category] || [];
        const grandAchievement = categoryAchievements.find(a => 
          a.requirements.some(req => req.isGrand)
        );
        
        if (grandAchievement) {
          const grandRequirement = grandAchievement.requirements.find(req => req.isGrand);
          leaderboardsByCategory[category] = await getLeaderboardValues(
            grandRequirement.type,
            grandRequirement.comparisonType
          );
        }
      }
    }

    // Special achievements that need custom leaderboards
    const specialAchievementsNeedingLeaderboard = ['Grand Wall', 'Grand Caboose'];
    for (const achievementName of specialAchievementsNeedingLeaderboard) {
      const achievement = achievements.find(a => a.name === achievementName);
      if (achievement) {
        const category = getAchievementCategory(achievement);
        if (!leaderboardsByCategory[category]) {
          // Grand Wall uses ConsecutivePlayedGames, Grand Caboose uses Rank
          const requirementType = achievementName === 'Grand Wall' ? 'ConsecutivePlayedGames' : 'Rank';
          leaderboardsByCategory[category] = await getLeaderboardValues(requirementType, '>=');
        }
      }
    }

    // Evaluate achievements by category
    const resultsByCategory = {};

    for (const [category, categoryAchievements] of Object.entries(groupedAchievements)) {
      const categoryResults = [];

      for (const achievement of categoryAchievements) {
        // Check if achievement has grand requirements
        const hasGrandRequirement = achievement.requirements.some(req => req.isGrand);
        const leaderboard = hasGrandRequirement ? leaderboardsByCategory[category] : null;

        // Check if this is a special achievement that needs custom evaluation
        const specialResult = evaluateSpecialAchievement(
          achievement.name,
          userStats,
          leaderboard,
          userId,
          achievement
        );

        if (specialResult) {
          // Use special evaluation
          categoryResults.push({
            earned: specialResult.earned,
            achievement: {
              _id: achievement._id,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              category: category,
              requirements: achievement.requirements
            },
            requirementResults: specialResult.requirementResults,
            userStats: {
              gamesPlayed: userStats.gamesPlayed,
              gamesWon: userStats.gamesWon,
              winStreak: userStats.winStreak,
              highestScore: userStats.highestScore,
              totalScore: userStats.totalScore,
              quizzesCompleted: userStats.quizzesCompleted,
              gamesSubmitted: userStats.gamesSubmitted,
              gamesVerified: userStats.gamesVerified,
              tournamentsPlayed: userStats.tournamentsPlayed,
              tournamentsWon: userStats.tournamentsWon,
              tournamentsCreated: userStats.tournamentsCreated,
              tournamentTop4: userStats.tournamentTop4
            }
          });
        } else if (evaluateIndividually) {
          // Evaluate each requirement individually (generic case)
          const requirementResults = achievement.requirements.map(requirement => {
            return evaluateRequirementIndividually(
              requirement,
              userStats,
              leaderboard,
              userId,
              achievement.requirements
            );
          });

          const allRequirementsMet = requirementResults.every(result => result.met);

          categoryResults.push({
            earned: allRequirementsMet,
            achievement: {
              _id: achievement._id,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              category: category,
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
              gamesVerified: userStats.gamesVerified,
              tournamentsPlayed: userStats.tournamentsPlayed,
              tournamentsWon: userStats.tournamentsWon,
              tournamentsCreated: userStats.tournamentsCreated,
              tournamentTop4: userStats.tournamentTop4
            }
          });
        } else {
          // Evaluate all requirements together (original behavior)
          const requirementResults = achievement.requirements.map(requirement => {
            const met = evaluateRequirement(requirement, userStats, leaderboard, userId, achievement.requirements);
            return { requirement, met };
          });

          const allRequirementsMet = requirementResults.every(result => result.met);

          categoryResults.push({
            earned: allRequirementsMet,
            achievement: {
              _id: achievement._id,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              category: category,
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
              gamesVerified: userStats.gamesVerified,
              tournamentsPlayed: userStats.tournamentsPlayed,
              tournamentsWon: userStats.tournamentsWon,
              tournamentsCreated: userStats.tournamentsCreated,
              tournamentTop4: userStats.tournamentTop4
            }
          });
        }
      }

      resultsByCategory[category] = categoryResults;
    }

    return {
      userId: userId.toString(),
      resultsByCategory,
      summary: {
        totalAchievements: achievements.length,
        earnedCount: Object.values(resultsByCategory)
          .flat()
          .filter(r => r.earned).length,
        byCategory: Object.entries(resultsByCategory).reduce((acc, [category, results]) => {
          acc[category] = {
            total: results.length,
            earned: results.filter(r => r.earned).length
          };
          return acc;
        }, {})
      }
    };
  } catch (error) {
    console.error('Error resolving achievements by category:', error);
    throw error;
  }
}

/**
 * Resolve a single achievement with category filtering and individual requirement evaluation
 * @param {string|ObjectId} userId - The user ID
 * @param {Object|string} achievement - The achievement object or achievement ID/name
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeLeaderboard - Whether to calculate leaderboard for grand achievements (default: true)
 * @param {boolean} options.evaluateIndividually - Whether to evaluate each requirement individually (default: true)
 * @returns {Promise<Object>} Resolution result with earned status and details
 */
async function resolveAchievementV2(userId, achievement, options = {}) {
  const { includeLeaderboard = true, evaluateIndividually = true } = options;
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

    // Calculate user statistics
    const userStats = await calculateUserStats(userId);

    // Check if achievement has grand requirements
    const hasGrandRequirement = achievementDoc.requirements.some(req => req.isGrand);

    // Get leaderboard if needed for grand achievements
    let leaderboard = null;
    if (hasGrandRequirement && includeLeaderboard) {
      // Special handling for achievements that need custom leaderboard types
      if (achievementDoc.name === 'Grand Wall') {
        leaderboard = await getLeaderboardValues('ConsecutivePlayedGames', '>=');
      } else if (achievementDoc.name === 'Grand Caboose') {
        leaderboard = await getLeaderboardValues('Position', '>=');
      } else {
        const grandRequirement = achievementDoc.requirements.find(req => req.isGrand);
        if (grandRequirement) {
          leaderboard = await getLeaderboardValues(grandRequirement.type, grandRequirement.comparisonType);
        }
      }
    }

    // Get category
    const category = getAchievementCategory(achievementDoc);

    // Check if this is a special achievement
    const specialResult = evaluateSpecialAchievement(
      achievementDoc.name,
      userStats,
      leaderboard,
      userId,
      achievementDoc
    );

    if (specialResult) {
      return {
        earned: specialResult.earned,
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon,
          category: category,
          requirements: achievementDoc.requirements
        },
        requirementResults: specialResult.requirementResults,
        userStats: {
          gamesPlayed: userStats.gamesPlayed,
          gamesWon: userStats.gamesWon,
          winStreak: userStats.winStreak,
          highestScore: userStats.highestScore,
          totalScore: userStats.totalScore,
          quizzesCompleted: userStats.quizzesCompleted,
          gamesSubmitted: userStats.gamesSubmitted,
          gamesVerified: userStats.gamesVerified,
          tournamentsPlayed: userStats.tournamentsPlayed,
          tournamentsWon: userStats.tournamentsWon,
          tournamentsCreated: userStats.tournamentsCreated,
          tournamentTop4: userStats.tournamentTop4
        }
      };
    }

    if (evaluateIndividually) {
      // Evaluate each requirement individually
      const requirementResults = achievementDoc.requirements.map(requirement => {
        return evaluateRequirementIndividually(
          requirement,
          userStats,
          leaderboard,
          userId,
          achievementDoc.requirements
        );
      });

      const allRequirementsMet = requirementResults.every(result => result.met);

      return {
        earned: allRequirementsMet,
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon,
          category: category,
          requirements: achievementDoc.requirements
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
          gamesVerified: userStats.gamesVerified,
          tournamentsPlayed: userStats.tournamentsPlayed,
          tournamentsWon: userStats.tournamentsWon,
          tournamentsCreated: userStats.tournamentsCreated,
          tournamentTop4: userStats.tournamentTop4
        }
      };
    } else {
      // Evaluate all requirements together (original behavior)
      const requirementResults = achievementDoc.requirements.map(requirement => {
        const met = evaluateRequirement(requirement, userStats, leaderboard, userId, achievementDoc.requirements);
        return { requirement, met };
      });

      const allRequirementsMet = requirementResults.every(result => result.met);

      return {
        earned: allRequirementsMet,
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon,
          category: category,
          requirements: achievementDoc.requirements
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
          gamesVerified: userStats.gamesVerified,
          tournamentsPlayed: userStats.tournamentsPlayed,
          tournamentsWon: userStats.tournamentsWon,
          tournamentsCreated: userStats.tournamentsCreated,
          tournamentTop4: userStats.tournamentTop4
        }
      };
    }
  } catch (error) {
    console.error('Error resolving achievement V2:', error);
    throw error;
  }
}

/**
 * Resolve all achievements for a user
 * @param {string|ObjectId} userId - The user ID
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeLeaderboard - Whether to calculate leaderboard for grand achievements (default: true)
 * @param {boolean} options.evaluateIndividually - Whether to evaluate each requirement individually (default: true)
 * @returns {Promise<Array>} Array of resolution results for all achievements
 */
async function resolveAllAchievements(userId, options = {}) {
  const Achievement = require('../models/Achievement');
  const achievements = await Achievement.find({});
  
  const results = await Promise.all(
    achievements.map(achievement => resolveAchievementV2(userId, achievement, options))
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
          icon: achievementDoc.icon,
          category: getAchievementCategory(achievementDoc)
        },
        isGrand: false,
        users: [],
        message: 'This is not a Grand achievement'
      };
    }

    // Handle special achievements that need custom leaderboard types
    let leaderboard;
    let requirementType = grandRequirement.type;
    
    if (achievementDoc.name === 'Grand Wall') {
      // Grand Wall uses ConsecutivePlayedGames leaderboard
      requirementType = 'ConsecutivePlayedGames';
      leaderboard = await getLeaderboardValues(requirementType, '>=');
    } else if (achievementDoc.name === 'Grand Caboose') {
      // Grand Caboose uses Rank leaderboard (for last place count)
      requirementType = 'Position';
      leaderboard = await getLeaderboardValues(requirementType, '>=');
    } else {
      // Standard grand achievement
      leaderboard = await getLeaderboardValues(
        grandRequirement.type,
        grandRequirement.comparisonType
      );
    }

    const allValues = Object.values(leaderboard).filter(v => v > 0);
    
    if (allValues.length === 0) {
      return {
        achievement: {
          _id: achievementDoc._id,
          name: achievementDoc.name,
          description: achievementDoc.description,
          icon: achievementDoc.icon,
          category: getAchievementCategory(achievementDoc)
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

    // For special achievements, apply additional filters
    if (achievementDoc.name === 'Grand Caboose') {
      // Grand Caboose also requires at least 8 games played
      const filteredUserIds = [];
      for (const userId of holderUserIds) {
        const stats = await calculateUserStats(userId);
        if (stats.gamesPlayed >= 8) {
          filteredUserIds.push(userId);
        }
      }
      holderUserIds.length = 0;
      holderUserIds.push(...filteredUserIds);
    }

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
            gamesVerified: stats.gamesVerified,
            tournamentsPlayed: stats.tournamentsPlayed,
            tournamentsWon: stats.tournamentsWon,
            tournamentsCreated: stats.tournamentsCreated,
            tournamentTop4: stats.tournamentTop4
          }
        };
      })
    );

    return {
      achievement: {
        _id: achievementDoc._id,
        name: achievementDoc.name,
        description: achievementDoc.description,
        icon: achievementDoc.icon,
        category: getAchievementCategory(achievementDoc)
      },
      isGrand: true,
      users,
      targetValue,
      requirementType: requirementType,
      count: users.length
    };
  } catch (error) {
    console.error('Error getting grand achievement holder:', error);
    throw error;
  }
}

module.exports = {
  resolveAchievementsByCategory,
  resolveAchievementV2,
  resolveAllAchievements,
  getGrandAchievementHolder,
  getAchievementCategory,
  groupAchievementsByCategory,
  filterAchievementsByCategory,
  evaluateRequirementIndividually,
  evaluateSpecialAchievement,
  // Core functions (ported from old service)
  calculateUserStats,
  getLeaderboardValues,
  evaluateRequirement
};
