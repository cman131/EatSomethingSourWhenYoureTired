const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const { validateGameCreation, validateMongoId } = require('../middleware/validation');
const { sendNewCommentNotificationEmail } = require('../utils/emailService');
const { createGame } = require('../utils/gameService');

const router = express.Router();

// @route   GET /api/games
// @desc    Get all games with pagination
// @access  Private
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const games = await Game.find()
      .populate('submittedBy', 'displayName avatar privateMode')
      .populate('players.player', 'displayName avatar privateMode')
      .populate('verifiedBy', 'displayName avatar privateMode')
      .sort({ gameDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments();

    res.json({
      success: true,
      data: {
        items: games,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get games'
    });
  }
});

// @route   POST /api/games
// @desc    Create a new game
// @access  Private
router.post('/', validateGameCreation, async (req, res) => {
  try {
    const { players, gameDate, notes, pointsLeftOnTable, isEastOnly, isInPerson, ranOutOfTime } = req.body;

    // Create game using the service (includes validation and notifications)
    const game = await createGame(
      { players, gameDate, notes, pointsLeftOnTable, isEastOnly, isInPerson, ranOutOfTime },
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Game submitted successfully',
      data: {
        game
      }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create game'
    });
  }
});

// @route   GET /api/games/pending-verification
// @desc    Get all unverified games where user was a player (but not submitter)
// @access  Private
router.get('/pending-verification', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const games = await Game.find({
      'players.player': req.user._id,
      verified: false,
      submittedBy: { $ne: req.user._id }
    })
      .populate('submittedBy', 'displayName avatar privateMode')
      .populate('players.player', 'displayName avatar privateMode')
      .populate('verifiedBy', 'displayName avatar privateMode')
      .sort({ gameDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments({
      'players.player': req.user._id,
      verified: false,
      submittedBy: { $ne: req.user._id }
    });

    res.json({
      success: true,
      data: {
        items: games,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get pending verification games error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending verification games'
    });
  }
});

// @route   GET /api/games/:id
// @desc    Get game by ID
// @access  Private
router.get('/:id', validateMongoId('id'), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('submittedBy', 'displayName avatar privateMode')
      .populate('players.player', 'displayName avatar privateMode')
      .populate('verifiedBy', 'displayName avatar privateMode')
      .populate('comments.commenter', 'displayName avatar privateMode');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    res.json({
      success: true,
      data: {
        game
      }
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game'
    });
  }
});

// @route   PUT /api/games/:id/verify
// @desc    Verify a game
// @access  Private
router.put('/:id/verify', validateMongoId('id'), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    if (game.verified) {
      return res.status(400).json({
        success: false,
        message: 'Game is already verified'
      });
    }

    game.verified = true;
    game.verifiedBy = req.user._id;
    game.verifiedAt = new Date();

    await game.save();

    await game.populate('submittedBy', 'displayName avatar privateMode');
    await game.populate('players.player', 'displayName avatar privateMode');
    await game.populate('verifiedBy', 'displayName avatar privateMode');
    await game.populate('comments.commenter', 'displayName avatar privateMode');

    res.json({
      success: true,
      message: 'Game verified successfully',
      data: {
        game
      }
    });
  } catch (error) {
    console.error('Verify game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify game'
    });
  }
});

// @route   POST /api/games/:id/comments
// @desc    Add a comment to a game
// @access  Private
router.post('/:id/comments', validateMongoId('id'), async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be 500 characters or less'
      });
    }

    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    const commentText = comment.trim();
    const commenterId = req.user._id.toString();

    // Add comment to game
    game.comments.push({
      comment: commentText,
      commenter: req.user._id,
      createdAt: new Date()
    });

    await game.save();

    // Populate all fields before sending response
    await game.populate('submittedBy', 'displayName avatar privateMode');
    await game.populate('players.player', 'displayName avatar privateMode');
    await game.populate('verifiedBy', 'displayName avatar privateMode');
    await game.populate('comments.commenter', 'displayName avatar privateMode');

    // Send notifications to relevant users
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const gameUrl = `${frontendUrl}/games/${game._id}`;
    const commenterDisplayName = req.user.displayName;

    // Collect all users who should be notified:
    // 1. All players in the game
    // 2. All previous commenters (before this new comment)
    const userIdsToNotify = new Set();
    
    // Add all players
    game.players.forEach(player => {
      const playerId = player.player._id.toString();
      if (playerId !== commenterId) {
        userIdsToNotify.add(playerId);
      }
    });

    // Add all previous commenters (exclude the new comment we just added)
    const previousComments = game.comments.slice(0, -1); // All comments except the last one (the new one)
    previousComments.forEach(comment => {
      if (comment.commenter) {
        // Handle both populated and unpopulated commenter
        const commenterIdStr = (comment.commenter._id || comment.commenter).toString();
        if (commenterIdStr !== commenterId) {
          userIdsToNotify.add(commenterIdStr);
        }
      }
    });

    // Process notifications for each user
    Promise.all(
      Array.from(userIdsToNotify).map(async (userId) => {
        try {
          const user = await User.findById(userId);
          if (!user) return;

          // Check notification preferences
          const prefs = user.notificationPreferences || {};
          const emailEnabled = prefs.emailNotificationsEnabled !== false; // default to true
          const commentNotificationsEnabled = prefs.emailNotificationsForComments !== false; // default to true

          // Send email if enabled
          if (emailEnabled && commentNotificationsEnabled) {
            try {
              await sendNewCommentNotificationEmail(
                user.email,
                user.displayName,
                game._id.toString(),
                commenterDisplayName,
                commentText
              );
            } catch (emailError) {
              console.error(`Failed to send email to ${user.email}:`, emailError);
              // Continue processing even if email fails
            }
          }

          // Add notification to user's queue
          user.notifications.push({
            name: 'New Comment',
            description: `${commenterDisplayName} left a comment on a game you participated in or commented on.`,
            type: 'Comment',
            url: gameUrl
          });

          await user.save();
        } catch (userError) {
          console.error(`Failed to process notification for user ${userId}:`, userError);
          // Continue processing other users even if one fails
        }
      })
    ).catch(error => {
      console.error('Error processing comment notifications:', error);
      // Don't fail the request if notifications fail
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        game
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// @route   DELETE /api/games/:id
// @desc    Delete a game (only by submitter or admin)
// @access  Private
router.delete('/:id', validateMongoId('id'), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    // Only allow deletion by submitter
    if (game.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete games you submitted'
      });
    }

    await game.deleteOne();

    res.json({
      success: true,
      message: 'Game deleted successfully'
    });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete game'
    });
  }
});

module.exports = router;

