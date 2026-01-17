const express = require('express');
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { PLAYER_POPULATE_FIELDS } = require('../models/User');
const Game = require('../models/Game');
const { validateMongoId, validateGameCreation } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { generateRoundPairings } = require('../utils/roundGenerationService');
const { createGame } = require('../utils/gameService');
const { sendRoundPairingNotificationEmail, sendNewTournamentNotificationEmail } = require('../utils/emailService');

const router = express.Router();

// Admin middleware - requires user to have isAdmin = true
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Tournament owner or admin middleware - requires user to be admin OR tournament creator
const requireTournamentOwnerOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admins can always access
    if (req.user.isAdmin) {
      return next();
    }

    // Check if user is the tournament creator
    const tournamentId = req.params.id;
    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is the creator
    if (tournament.createdBy && tournament.createdBy.toString() === req.user._id.toString()) {
      return next();
    }

    // User is neither admin nor creator
    return res.status(403).json({
      success: false,
      message: 'You must be the tournament creator or an admin to perform this action'
    });
  } catch (error) {
    console.error('Error in requireTournamentOwnerOrAdmin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking tournament permissions'
    });
  }
};

// Helper function to send new tournament notifications to all users
const sendNewTournamentNotifications = async (tournament) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const tournamentUrl = `${frontendUrl}/tournaments/${tournament._id}`;
  
  // Get all users in the system
  const allUsers = await User.find();
  
  // Process notifications for each user (don't await - run in background)
  Promise.all(
    allUsers.map(async (user) => {
      try {
        // Check notification preferences
        const prefs = user.notificationPreferences || {};
        const emailEnabled = prefs.emailNotificationsEnabled !== false; // default to true
        const newTournamentNotificationsEnabled = prefs.emailNotificationsForNewTournaments !== false; // default to true

        // Send email if enabled
        if (emailEnabled && newTournamentNotificationsEnabled) {
          try {
            await sendNewTournamentNotificationEmail(
              user.email,
              user.displayName,
              tournament._id.toString(),
              tournament.name,
              tournament.date
            );
          } catch (emailError) {
            console.error(`Failed to send email to ${user.email}:`, emailError);
            // Continue processing even if email fails
          }
        }

        // Add notification to user's queue
        user.notifications.push({
          name: 'New Tournament Created',
          description: `A new tournament "${tournament.name}" has been created. Sign up now!`,
          type: 'Other',
          url: tournamentUrl
        });

        await user.save();
      } catch (userError) {
        console.error(`Failed to process notification for user ${user._id}:`, userError);
        // Continue processing other users even if one fails
      }
    })
  ).catch(error => {
    console.error('Error processing new tournament notifications:', error);
    // Don't fail the request if notifications fail
  });
};

// Helper function to send round pairing notifications to all active tournament players
const sendRoundPairingNotifications = async (tournament, roundNumber) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const tournamentUrl = `${frontendUrl}/tournaments/${tournament._id}`;
  
  // Get all active (non-dropped) players
  const activePlayers = tournament.players.filter(p => !p.dropped);
  
  // Process notifications for each player (don't await - run in background)
  Promise.all(
    activePlayers.map(async (playerEntry) => {
      try {
        const player = await User.findById(playerEntry.player);
        if (!player) return;

        // Check notification preferences
        const prefs = player.notificationPreferences || {};
        const emailEnabled = prefs.emailNotificationsEnabled !== false; // default to true
        const roundPairingNotificationsEnabled = prefs.emailNotificationsForRoundPairings !== false; // default to true

        // Send email if enabled
        if (emailEnabled && roundPairingNotificationsEnabled) {
          try {
            await sendRoundPairingNotificationEmail(
              player.email,
              player.displayName,
              tournament._id.toString(),
              tournament.name,
              roundNumber
            );
          } catch (emailError) {
            console.error(`Failed to send email to ${player.email}:`, emailError);
            // Continue processing even if email fails
          }
        }

        // Add notification to user's queue
        player.notifications.push({
          name: 'Round Pairings Available',
          description: `Round ${roundNumber} pairings for ${tournament.name} have been generated.`,
          type: 'Other',
          url: tournamentUrl
        });

        await player.save();
      } catch (playerError) {
        console.error(`Failed to process notification for player ${playerEntry.player}:`, playerError);
        // Continue processing other players even if one fails
      }
    })
  ).catch(error => {
    console.error('Error processing round pairing notifications:', error);
    // Don't fail the request if notifications fail
  });
};

// @route   GET /api/tournaments
// @desc    Get all tournaments with pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tournaments = await Tournament.find()
      .populate('players.player', PLAYER_POPULATE_FIELDS)
      .populate('createdBy', PLAYER_POPULATE_FIELDS)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Tournament.countDocuments();

    res.json({
      success: true,
      data: {
        items: tournaments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tournaments'
    });
  }
});

// @route   GET /api/tournaments/public/:id
// @desc    Get tournament by ID (public, minimal data)
// @access  Public
router.get('/public/:id', validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .select('-rounds'); // Exclude rounds, pairings, and games

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Get tournament (public) error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tournament'
    });
  }
});

// @route   GET /api/tournaments/:id
// @desc    Get tournament by ID
// @access  Private
router.get('/:id', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('players.player', PLAYER_POPULATE_FIELDS);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Populate rounds pairings players and games if tournament has started
    if (tournament.status !== 'NotStarted' && tournament.rounds && tournament.rounds.length > 0) {
      await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);
      await tournament.populate({
        path: 'rounds.pairings.game',
        populate: {
          path: 'players.player',
          select: PLAYER_POPULATE_FIELDS
        }
      });
    }
    
    // Always populate createdBy
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.json({
      success: true,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tournament'
    });
  }
});

// @route   POST /api/tournaments
// @desc    Create a new tournament (Any authenticated user)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, date, location, onlineLocation, isOnline, modifications, ruleset } = req.body;

    if (!name || !date) {
      return res.status(400).json({
        success: false,
        message: 'Tournament name and date are required'
      });
    }

    const isOnlineTournament = isOnline === true;

    // Validate location based on isOnline flag
    if (isOnlineTournament) {
      // If online, onlineLocation is required
      if (!onlineLocation || onlineLocation.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Online location is required when tournament is online'
        });
      }
    } else {
      // If not online, physical location is required
      if (!location || !location.streetAddress || !location.city || !location.state || !location.zipCode) {
        return res.status(400).json({
          success: false,
          message: 'Location must include street address, city, state, and zip code'
        });
      }

      // Validate state is 2 characters
      if (location.state && location.state.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'State must be a 2-letter abbreviation'
        });
      }
    }

    const tournamentData = {
      name,
      description: description || '',
      date,
      isOnline: isOnlineTournament,
      ruleset: ruleset || 'WRC2025', // Use provided ruleset or default to WRC2025
      modifications: modifications && Array.isArray(modifications) 
        ? modifications.map(m => m.trim()).filter(m => m.length > 0)
        : [],
      createdBy: req.user._id, // Set the creator
      players: [],
      rounds: []
    };

    if (isOnlineTournament) {
      tournamentData.onlineLocation = onlineLocation.trim();
    } else {
      tournamentData.location = {
        streetAddress: location.streetAddress.trim(),
        addressLine2: location.addressLine2 ? location.addressLine2.trim() : undefined,
        city: location.city.trim(),
        state: location.state.trim().toUpperCase(),
        zipCode: location.zipCode.trim()
      };
    }

    const tournament = new Tournament(tournamentData);

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    // Send notifications to all users about the new tournament
    // Only send if tournament is 7 or more days away from current date
    const tournamentDate = new Date(tournament.date);
    const currentDate = new Date();
    const daysUntilTournament = Math.ceil((tournamentDate - currentDate) / (1000 * 60 * 60 * 24));
    
    if (daysUntilTournament >= 7) {
      sendNewTournamentNotifications(tournament);
    }

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create tournament'
    });
  }
});

// @route   PUT /api/tournaments/:id
// @desc    Update a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.put('/:id', authenticateToken, validateMongoId('id'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const { name, description, date, location, onlineLocation, isOnline, modifications, ruleset } = req.body;

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Update fields if provided
    if (name !== undefined) {
      tournament.name = name;
    }

    if (description !== undefined) {
      tournament.description = description;
    }

    if (date !== undefined) {
      tournament.date = date;
    }

    // Handle isOnline flag
    if (isOnline !== undefined) {
      tournament.isOnline = isOnline === true;
    }

    const isOnlineTournament = tournament.isOnline;

    // Handle location updates
    if (location !== undefined || onlineLocation !== undefined || isOnline !== undefined) {
      if (isOnlineTournament) {
        // If online, validate and set onlineLocation
        if (onlineLocation !== undefined) {
          if (!onlineLocation || onlineLocation.trim() === '') {
            return res.status(400).json({
              success: false,
              message: 'Online location is required when tournament is online'
            });
          }
          tournament.onlineLocation = onlineLocation.trim();
        }
        // Clear physical location if switching to online
        if (isOnline !== undefined) {
          tournament.location = undefined;
        }
      } else {
        // If not online, validate and set physical location
        if (location !== undefined) {
          if (!location.streetAddress || !location.city || !location.state || !location.zipCode) {
            return res.status(400).json({
              success: false,
              message: 'Location must include street address, city, state, and zip code'
            });
          }

          // Validate state is 2 characters
          if (location.state && location.state.length !== 2) {
            return res.status(400).json({
              success: false,
              message: 'State must be a 2-letter abbreviation'
            });
          }

          tournament.location = {
            streetAddress: location.streetAddress.trim(),
            addressLine2: location.addressLine2 ? location.addressLine2.trim() : undefined,
            city: location.city.trim(),
            state: location.state.trim().toUpperCase(),
            zipCode: location.zipCode.trim()
          };
        }
        // Clear online location if switching to physical
        if (isOnline !== undefined) {
          tournament.onlineLocation = undefined;
        }
      }
    }

    if (ruleset !== undefined) {
      // Validate ruleset is a valid enum value
      if (ruleset !== 'WRC2025') {
        return res.status(400).json({
          success: false,
          message: 'Invalid ruleset. Must be WRC2025'
        });
      }
      tournament.ruleset = ruleset;
    }

    if (modifications !== undefined) {
      // Validate modifications is an array
      if (!Array.isArray(modifications)) {
        return res.status(400).json({
          success: false,
          message: 'Modifications must be an array'
        });
      }

      // Trim and filter empty strings
      tournament.modifications = modifications.map(m => String(m).trim()).filter(m => m.length > 0);
    }

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tournament'
    });
  }
});

// @route   PUT /api/tournaments/:id/start
// @desc    Start a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.put('/:id/start', authenticateToken, validateMongoId('id'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if tournament has players
    const activePlayers = tournament.players.filter(p => !p.dropped);
    if (!activePlayers || activePlayers.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start tournament with less than 8 players'
      });
    }

    // Generate first round pairings if they don't exist
    let firstRound = tournament.rounds.find(r => r.roundNumber === 1);
    
    if (!firstRound || !firstRound.pairings || firstRound.pairings.length === 0) {
      try {
        const firstRoundPairings = await generateRoundPairings(tournament, 1);
        
        // Convert player IDs from strings to ObjectIds
        const pairingsWithObjectIds = firstRoundPairings.map(pairing => ({
          tableNumber: pairing.tableNumber,
          players: pairing.players.map(playerEntry => ({
            player: new mongoose.Types.ObjectId(playerEntry.player),
            seat: playerEntry.seat
          })),
          game: null
        }));
        
        if (!firstRound) {
          // Create new round
          tournament.rounds.push({
            roundNumber: 1,
            startDate: new Date(),
            pairings: pairingsWithObjectIds
          });
        } else {
          // Update existing round
          firstRound.pairings = pairingsWithObjectIds;
          // Set startDate if not already set
          if (!firstRound.startDate) {
            firstRound.startDate = new Date();
          }
        }
        
        tournament.markModified('rounds');
        
        // Send notifications to all active players about the first round
        sendRoundPairingNotifications(tournament, 1);
      } catch (error) {
        console.error('Error generating first round:', error);
        return res.status(500).json({
          success: false,
          message: `Failed to generate first round pairings: ${error.message}`
        });
      }
    }

    // Update tournament status to InProgress
    tournament.status = 'InProgress';
    
    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);
    await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);

    res.json({
      success: true,
      message: 'Tournament started successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Start tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start tournament'
    });
  }
});

// @route   DELETE /api/tournaments/:id
// @desc    Delete a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.delete('/:id', authenticateToken, validateMongoId('id'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    await tournament.deleteOne();

    res.json({
      success: true,
      message: 'Tournament deleted successfully'
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tournament'
    });
  }
});

// @route   PUT /api/tournaments/:id/rounds/:roundNumber/end
// @desc    End a round in a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.put('/:id/rounds/:roundNumber/end', authenticateToken, validateMongoId('id'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    const roundNumber = parseInt(req.params.roundNumber);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (isNaN(roundNumber) || roundNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid round number'
      });
    }

    const round = tournament.rounds.find(r => r.roundNumber === roundNumber);

    if (!round) {
      return res.status(404).json({
        success: false,
        message: `Round ${roundNumber} not found`
      });
    }

    // Check if all pairings have associated games
    const incompletePairings = round.pairings.filter(p => !p.game);
    if (incompletePairings.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot end round: ${incompletePairings.length} pairing(s) do not have associated games`
      });
    }

    // Update player uma scores based on game results
    // Populate games to get scores
    await tournament.populate('rounds.pairings.game');
    
    // Check if all games are verified
    const unverifiedPairings = round.pairings.filter(p => {
      if (!p.game) return true;
      // Check if game is verified (handle both populated object and ObjectId)
      if (typeof p.game === 'object' && p.game !== null) {
        return !p.game.verified;
      }
      return true; // If game is not populated, consider it unverified
    });
    
    if (unverifiedPairings.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot end round: ${unverifiedPairings.length} game(s) are not verified`
      });
    }
    
    // Check if this is the final 4 round
    const isFinalRound = roundNumber === tournament.maxRounds + 1;
    
    if (isFinalRound) {
      // For the final round, don't update UMA - just populate top4 array
      // The final round should have exactly one pairing with one game
      const finalPairing = round.pairings.find(p => p.game);
      
      if (finalPairing && finalPairing.game && finalPairing.game.players) {
        // Sort players by rank (1st, 2nd, 3rd, 4th)
        const sortedPlayers = [...finalPairing.game.players].sort((a, b) => a.rank - b.rank);
        
        // Populate top4 array with player IDs in order (1st to 4th)
        tournament.top4 = sortedPlayers.map(gamePlayer => {
          const playerId = gamePlayer.player;
          // Handle both ObjectId and populated object cases
          if (typeof playerId === 'string') {
            return new mongoose.Types.ObjectId(playerId);
          } else if (playerId && playerId._id) {
            // Populated object
            return typeof playerId._id === 'string' 
              ? new mongoose.Types.ObjectId(playerId._id)
              : playerId._id;
          } else {
            // Already an ObjectId
            return playerId;
          }
        });
        
        tournament.markModified('top4');
      }
    } else {
      // For regular rounds, update UMA as normal
      for (const pairing of round.pairings) {
        if (pairing.game && pairing.game.players) {
          // Calculate uma for each player in this game
          // Uma is typically calculated as: (player's score - 30,000) / 1000
          // But this can vary by tournament rules
          for (const gamePlayer of pairing.game.players) {
            const playerId = gamePlayer.player.toString();
            const tournamentPlayer = tournament.players.find(
              p => p.player.toString() === playerId
            );
            
            if (tournamentPlayer) {
              // Calculate uma: (score - 30000) / 1000
              // This is a standard calculation, but may need adjustment based on tournament rules
              const umaBase = (gamePlayer.score - 30000) / 1000;
              // Rank uma adjustment: 1st = 30, 2nd = 10, 3rd = -10, 4th = -30
              const rankUmaAdjustment = {
                1: 30,
                2: 10,
                3: -10,
                4: -30
              }[gamePlayer.rank];
              tournamentPlayer.uma = (tournamentPlayer.uma || 0) + umaBase + rankUmaAdjustment;
            }
          }
        }
      }
    }

    // Generate the next round and its pairings if round is not the last round
    if (roundNumber < tournament.maxRounds) {
      try {
        const nextRoundNumber = roundNumber + 1;
        const nextRoundPairings = await generateRoundPairings(tournament, nextRoundNumber);
        
        // Convert player IDs from strings to ObjectIds
        const pairingsWithObjectIds = nextRoundPairings.map(pairing => ({
          tableNumber: pairing.tableNumber,
          players: pairing.players.map(playerEntry => ({
            player: new mongoose.Types.ObjectId(playerEntry.player),
            seat: playerEntry.seat
          })),
          game: null
        }));
        
        // Check if next round already exists
        let nextRound = tournament.rounds.find(r => r.roundNumber === nextRoundNumber);
        
        if (!nextRound) {
          // Create new round
          tournament.rounds.push({
            roundNumber: nextRoundNumber,
            startDate: new Date(),
            pairings: pairingsWithObjectIds
          });
        } else {
          // Update existing round (in case it was reset)
          nextRound.pairings = pairingsWithObjectIds;
          // Set startDate if not already set
          if (!nextRound.startDate) {
            nextRound.startDate = new Date();
          }
        }
        tournament.markModified('rounds');
        
        // Send notifications to all active players about the new round
        sendRoundPairingNotifications(tournament, nextRoundNumber);
      } catch (error) {
        console.error('Error generating next round:', error);
        // Don't fail the request if round generation fails
        // Admin can manually create the round
      }
    } else if (roundNumber === tournament.maxRounds) {
      // This is the last regular round - create the final 4 round
      const finalRoundNumber = tournament.maxRounds + 1;
      const finalRoundExists = tournament.rounds.some(r => r.roundNumber === finalRoundNumber);
      
      if (!finalRoundExists) {
        // Get top 4 players by UMA (non-dropped only)
        const activePlayers = tournament.players
          .filter(p => !p.dropped)
          .sort((a, b) => (b.uma || 0) - (a.uma || 0))
          .slice(0, 4);
        
        if (activePlayers.length < 4) {
          // Not enough players for final 4 round, just end the tournament
          tournament.status = 'Completed';
        } else {
          // Create final 4 round with single pairing
          const seats = ['East', 'South', 'West', 'North'];
          const shuffledSeats = [...seats].sort(() => Math.random() - 0.5);
          
          const finalPairing = {
            tableNumber: 1,
            players: activePlayers.map((playerEntry, index) => ({
              player: new mongoose.Types.ObjectId(playerEntry.player),
              seat: shuffledSeats[index]
            })),
            game: null
          };
          
          tournament.rounds.push({
            roundNumber: finalRoundNumber,
            startDate: new Date(),
            pairings: [finalPairing]
          });
          
          tournament.markModified('rounds');
          
          // Send notifications to the top 4 players about the final round
          sendRoundPairingNotifications(tournament, finalRoundNumber);
        }
      }
      // If final round already exists, don't create it again - tournament will be completed when final round ends
    } else if (roundNumber === tournament.maxRounds + 1) {
      // This is the final 4 round, end the tournament
      tournament.status = 'Completed';
    } else {
      // Round number is beyond final round (shouldn't happen), end the tournament
      tournament.status = 'Completed';
    }

    // Round is complete
    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('rounds.pairings.game');

    res.json({
      success: true,
      message: `Round ${roundNumber} ended successfully`,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('End round error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to end round'
    });
  }
});

// @route   PUT /api/tournaments/:id/rounds/:roundNumber/reset
// @desc    Reset round pairings in a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.put('/:id/rounds/:roundNumber/reset', authenticateToken, validateMongoId('id'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    const roundNumber = parseInt(req.params.roundNumber);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (isNaN(roundNumber) || roundNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid round number'
      });
    }

    const round = tournament.rounds.find(r => r.roundNumber === roundNumber);

    if (!round) {
      return res.status(404).json({
        success: false,
        message: `Round ${roundNumber} not found`
      });
    }

    // Reset pairings - clear all pairings for this round
    round.pairings = [];

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.json({
      success: true,
      message: `Round ${roundNumber} pairings reset successfully`,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Reset round pairings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset round pairings'
    });
  }
});

// @route   POST /api/tournaments/:id/signup
// @desc    Sign up for a tournament
// @access  Private
router.post('/:id/signup', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is already signed up
    const existingPlayer = tournament.players.find(
      p => p.player.toString() === req.user._id.toString()
    );

    if (existingPlayer) {
      // If already signed up but dropped, re-enable them
      if (existingPlayer.dropped) {
        existingPlayer.dropped = false;
        await tournament.save();
        
        await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
        
        return res.json({
          success: true,
          message: 'Re-joined tournament successfully',
          data: {
            tournament
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'You are already signed up for this tournament'
      });
    }

    // Add player to tournament
    tournament.players.push({
      player: req.user._id,
      uma: 0,
      dropped: false
    });

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);

    res.status(201).json({
      success: true,
      message: 'Signed up for tournament successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Tournament signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sign up for tournament'
    });
  }
});

// @route   POST /api/tournaments/:id/players
// @desc    Add a player to a tournament (Admin only)
// @access  Private (AdminOnly)
router.post('/:id/players', authenticateToken, validateMongoId('id'), requireAdmin, async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if tournament has started
    if (tournament.status !== 'NotStarted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add players to a tournament that has already started'
      });
    }

    // Verify player exists
    const player = await User.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    if (player.isGuest) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add guest players to tournaments'
      });
    }

    // Check if player is already in tournament
    const existingPlayer = tournament.players.find(
      p => p.player.toString() === playerId
    );

    if (existingPlayer) {
      // If already signed up but dropped, re-enable them
      if (existingPlayer.dropped) {
        existingPlayer.dropped = false;
        await tournament.save();
        
        await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
        
        return res.json({
          success: true,
          message: 'Player re-added to tournament successfully',
          data: {
            tournament
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Player is already in the tournament'
      });
    }

    // Add player to tournament
    tournament.players.push({
      player: playerId,
      uma: 0,
      dropped: false
    });

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);

    res.status(201).json({
      success: true,
      message: 'Player added to tournament successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Add player to tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add player to tournament'
    });
  }
});

// @route   PUT /api/tournaments/:id/players/:playerId/kick
// @desc    Kick a player from a tournament (Creator or Admin only)
// @access  Private (Creator or Admin)
router.put('/:id/players/:playerId/kick', authenticateToken, validateMongoId('id'), validateMongoId('playerId'), requireTournamentOwnerOrAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if tournament has started
    if (tournament.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot kick players from a tournament that has already ended'
      });
    }

    // Find the player in the tournament
    const playerEntry = tournament.players.find(
      p => p.player.toString() === req.params.playerId
    );

    if (!playerEntry) {
      return res.status(404).json({
        success: false,
        message: 'Player not found in tournament'
      });
    }

    if (playerEntry.dropped) {
      return res.status(400).json({
        success: false,
        message: 'Player has already been removed from the tournament'
      });
    }

    // Mark player as dropped
    playerEntry.dropped = true;
    tournament.markModified('players');

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.json({
      success: true,
      message: 'Player removed from tournament successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Kick player from tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove player from tournament'
    });
  }
});

// @route   PUT /api/tournaments/:id/drop
// @desc    Drop from a tournament
// @access  Private
router.put('/:id/drop', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Find the player in the tournament
    const playerEntry = tournament.players.find(
      p => p.player.toString() === req.user._id.toString()
    );

    if (!playerEntry) {
      return res.status(404).json({
        success: false,
        message: 'You are not signed up for this tournament'
      });
    }

    if (playerEntry.dropped) {
      return res.status(400).json({
        success: false,
        message: 'You have already dropped from this tournament'
      });
    }

    // Mark player as dropped
    playerEntry.dropped = true;
    tournament.markModified('players');

    await tournament.save();

    await tournament.populate('players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.json({
      success: true,
      message: 'Dropped from tournament successfully',
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Drop from tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to drop from tournament'
    });
  }
});

// @route   POST /api/tournaments/:id/games
// @desc    Report a tournament game
// @access  Private
router.post('/:id/games', authenticateToken, validateMongoId('id'), validateGameCreation, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is signed up and not dropped, is an admin, or is the tournament creator
    const playerEntry = tournament.players.find(
      p => p.player.toString() === req.user._id.toString()
    );
    
    const isAdmin = req.user.isAdmin === true;
    const createdById = tournament.createdBy ? tournament.createdBy.toString() : null;
    const isCreator = createdById === req.user._id.toString();
    const isPlayer = playerEntry && !playerEntry.dropped;

    if (!isPlayer && !isAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'You must be signed up for this tournament, be the tournament creator, or be an admin to report games'
      });
    }

    const { players, notes, pointsLeftOnTable, ranOutOfTime, roundNumber, pairingIndex } = req.body;

    // Note: Basic game validation (players array, player IDs, scores, positions) is handled by validateGameCreation middleware
    const playerIds = players.map(p => p.player);

    // Find the current round (use provided roundNumber or find the latest round)
    let round;
    if (roundNumber) {
      round = tournament.rounds.find(r => r.roundNumber === roundNumber);
      if (!round) {
        return res.status(404).json({
          success: false,
          message: `Round ${roundNumber} not found`
        });
      }
    } else {
      // Find the latest round that has pairings
      const roundsWithPairings = tournament.rounds
        .filter(r => r.pairings && r.pairings.length > 0)
        .sort((a, b) => b.roundNumber - a.roundNumber);
      
      if (roundsWithPairings.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No rounds with pairings found in this tournament'
        });
      }
      
      round = roundsWithPairings[0];
    }

    // Find the pairing that includes the current user (or use pairingIndex if provided)
    const userId = req.user._id.toString();
    let pairing;
    
    if (pairingIndex !== undefined) {
      pairing = round.pairings[pairingIndex];
      if (!pairing) {
        return res.status(404).json({
          success: false,
          message: 'Pairing not found at specified index'
        });
      }
      // For non-admins and non-creators, verify they are in this pairing
      const createdById = tournament.createdBy ? tournament.createdBy.toString() : null;
      const isCreator = createdById === req.user._id.toString();
      
      if (!req.user.isAdmin && !isCreator) {
        const userInPairing = pairing.players.some(playerEntry => 
          playerEntry.player.toString() === userId
        );
        if (!userInPairing) {
          return res.status(403).json({
            success: false,
            message: 'You are not a player in this pairing'
          });
        }
      }
    } else {
      // If no pairingIndex provided, find pairing by user
      pairing = round.pairings.find(p => 
        p.players.some(playerEntry => playerEntry.player.toString() === userId)
      );
      
      const createdById = tournament.createdBy ? tournament.createdBy.toString() : null;
      const isCreator = createdById === req.user._id.toString();
      
      if (!pairing && !req.user.isAdmin && !isCreator) {
        return res.status(404).json({
          success: false,
          message: 'No pairing found for you in this round'
        });
      }
      
      // If admin/creator and no pairing found, they need to provide pairingIndex
      if (!pairing && (req.user.isAdmin || isCreator)) {
        return res.status(400).json({
          success: false,
          message: 'pairingIndex is required for admin/creator submissions when not in the pairing'
        });
      }
    }

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: 'No pairing found for you in this round'
      });
    }

    // Check if pairing already has a game
    if (pairing.game) {
      return res.status(400).json({
        success: false,
        message: 'This pairing already has an associated game'
      });
    }

    // Verify that the game players match the pairing players
    const pairingPlayerIds = pairing.players.map(p => p.player.toString()).sort();
    
    const gamePlayerIds = playerIds.map(id => id.toString()).sort();
    
    if (JSON.stringify(pairingPlayerIds) !== JSON.stringify(gamePlayerIds)) {
      return res.status(400).json({
        success: false,
        message: 'Game players must match the pairing players'
      });
    }

    // Create game using the service (includes validation and notifications)
    const game = await createGame(
      {
        players,
        gameDate: new Date(),
        notes,
        pointsLeftOnTable: pointsLeftOnTable || 0,
        isEastOnly: tournament.isEastOnly || false,
        isInPerson: true,
        ranOutOfTime: ranOutOfTime || false,
        isTournamentGame: true
      },
      req.user._id
    );

    // Associate game with pairing
    pairing.game = game._id;
    tournament.markModified('rounds');

    await tournament.save();

    // Populate tournament before sending response (game is already populated by createGame)
    await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('createdBy', PLAYER_POPULATE_FIELDS);

    res.status(201).json({
      success: true,
      message: 'Tournament game reported successfully',
      data: {
        game,
        tournament
      }
    });
  } catch (error) {
    console.error('Report tournament game error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to report tournament game'
    });
  }
});

// @route   GET /api/tournaments/:id/my-pairing
// @desc    Get current round pairing for the authenticated user
// @access  Private
router.get('/:id/my-pairing', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is signed up and not dropped
    const playerEntry = tournament.players.find(
      p => p.player.toString() === req.user._id.toString() && !p.dropped
    );

    if (!playerEntry) {
      return res.status(403).json({
        success: false,
        message: 'You must be signed up for this tournament'
      });
    }

    const userId = req.user._id.toString();

    // Find the latest round that has pairings
    const roundsWithPairings = tournament.rounds
      .filter(r => r.pairings && r.pairings.length > 0)
      .sort((a, b) => b.roundNumber - a.roundNumber);

    if (roundsWithPairings.length === 0) {
      return res.json({
        success: true,
        message: 'No rounds with pairings found',
        data: {
          pairing: null,
          round: null
        }
      });
    }

    // Find pairing in the latest round
    let foundPairing = null;
    let foundRound = null;

    for (const round of roundsWithPairings) {
      const pairing = round.pairings.find(p => 
        p.players.some(playerEntry => playerEntry.player.toString() === userId)
      );

      if (pairing) {
        foundPairing = pairing;
        foundRound = round;
        break;
      }
    }

    if (!foundPairing) {
      return res.json({
        success: true,
        message: 'No pairing found for you in current rounds',
        data: {
          pairing: null,
          round: null
        }
      });
    }

    // Populate player and game data
    await tournament.populate('rounds.pairings.players.player', PLAYER_POPULATE_FIELDS);
    await tournament.populate('rounds.pairings.game');

    // Get the updated pairing after population
    const updatedRound = tournament.rounds.find(r => r.roundNumber === foundRound.roundNumber);
    const updatedPairing = updatedRound.pairings.find(p => 
      p.players.some(playerEntry => playerEntry.player.toString() === userId)
    );

    res.json({
      success: true,
      data: {
        pairing: updatedPairing,
        round: {
          roundNumber: foundRound.roundNumber
        }
      }
    });
  } catch (error) {
    console.error('Get my pairing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get pairing'
    });
  }
});

module.exports = router;

