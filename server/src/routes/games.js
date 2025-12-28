const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const { validateGameCreation, validateMongoId } = require('../middleware/validation');

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
      .populate('submittedBy', 'username email')
      .populate('players.player', 'username email')
      .populate('verifiedBy', 'username')
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
    const { players, gameDate, notes } = req.body;

    // Verify all player IDs exist
    const playerIds = players.map(p => p.player);
    const users = await User.find({ _id: { $in: playerIds } });
    
    if (users.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'One or more players not found'
      });
    }

    // Create game
    const game = new Game({
      submittedBy: req.user._id,
      players,
      gameDate: gameDate || new Date(),
      notes
    });

    await game.save();

    // Populate before sending response
    await game.populate('submittedBy', 'username email');
    await game.populate('players.player', 'username email');

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

// @route   GET /api/games/:id
// @desc    Get game by ID
// @access  Private
router.get('/:id', validateMongoId('id'), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('submittedBy', 'username email')
      .populate('players.player', 'username email')
      .populate('verifiedBy', 'username');

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

    await game.populate('submittedBy', 'username email');
    await game.populate('players.player', 'username email');
    await game.populate('verifiedBy', 'username');

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

