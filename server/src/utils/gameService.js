const Game = require('../models/Game');
const User = require('../models/User');
const { PLAYER_POPULATE_FIELDS } = require('../models/User');
const { sendNewGameNotificationEmail } = require('./emailService');

/**
 * Creates a game with validation and notifications
 * @param {Object} gameData - Game data object
 * @param {Object} gameData.players - Array of player objects with player, score, and position
 * @param {Date} gameData.gameDate - Date of the game
 * @param {String} gameData.notes - Optional notes
 * @param {Number} gameData.pointsLeftOnTable - Points left on table
 * @param {Boolean} gameData.isEastOnly - Whether it's an east-only game
 * @param {Boolean} gameData.isInPerson - Whether it's in person
 * @param {Boolean} gameData.ranOutOfTime - Whether time ran out
 * @param {Boolean} gameData.isTournamentGame - Whether this is a tournament game (optional)
 * @param {ObjectId} submitterId - ID of the user submitting the game
 * @returns {Promise<Game>} The created game with populated fields
 */
async function createGame(gameData, submitterId) {
  const { players, gameDate, notes, pointsLeftOnTable, isEastOnly, isInPerson, ranOutOfTime, isTournamentGame } = gameData;

  // Verify all player IDs exist
  const playerIds = players.map(p => p.player);
  const users = await User.find({ _id: { $in: playerIds } });
  
  if (users.length !== 4) {
    throw new Error('One or more players not found');
  }

  // Validate that at least 2 players are non-guest users (skip for tournament games)
  if (!isTournamentGame) {
    const nonGuestUsers = users.filter(u => !u.isGuest);
    if (nonGuestUsers.length < 2) {
      throw new Error('At least 2 players must be registered users (not guests)');
    }
  }

  // Create game
  const game = new Game({
    submittedBy: submitterId,
    players,
    gameDate: gameDate || new Date(),
    notes,
    pointsLeftOnTable: pointsLeftOnTable || 0,
    isEastOnly: isEastOnly || false,
    isInPerson: isInPerson !== undefined ? isInPerson : true,
    ranOutOfTime: ranOutOfTime || false
  });

  await game.save();

  // Populate before sending response
  await game.populate('submittedBy', PLAYER_POPULATE_FIELDS);
  await game.populate('players.player', PLAYER_POPULATE_FIELDS);

  // Send notifications to players who aren't the submitter
  const submitterIdString = submitterId.toString();
  const submitterDisplayName = game.submittedBy.displayName;
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const gameUrl = `${frontendUrl}/games/${game._id}`;

  // Get all players who aren't the submitter and aren't guest users
  const otherPlayers = game.players.filter(p => {
    const playerId = p.player._id.toString();
    return playerId !== submitterIdString && !p.player.isGuest;
  });
  
  // Process notifications for each player (don't await - run in background)
  Promise.all(
    otherPlayers.map(async (playerData) => {
      try {
        const player = await User.findById(playerData.player._id);
        if (!player || player.isGuest) return; // Skip guest users

        // Check notification preferences
        const prefs = player.notificationPreferences || {};
        const emailEnabled = prefs.emailNotificationsEnabled !== false; // default to true
        const newGameNotificationsEnabled = prefs.emailNotificationsForNewGames !== false; // default to true

        // Send email if enabled
        if (emailEnabled && newGameNotificationsEnabled) {
          try {
            await sendNewGameNotificationEmail(
              player.email,
              player.displayName,
              game._id.toString(),
              submitterDisplayName
            );
          } catch (emailError) {
            console.error(`Failed to send email to ${player.email}:`, emailError);
            // Continue processing even if email fails
          }
        }

        // Add notification to user's queue
        player.notifications.push({
          name: 'New Game Submitted',
          description: `A new game you participated in has been submitted by ${submitterDisplayName}.`,
          type: 'Game',
          url: gameUrl
        });

        await player.save();
      } catch (playerError) {
        console.error(`Failed to process notification for player ${playerData.player._id}:`, playerError);
        // Continue processing other players even if one fails
      }
    })
  ).catch(error => {
    console.error('Error processing game notifications:', error);
    // Don't fail the request if notifications fail
  });

  return game;
}

module.exports = {
  createGame
};
