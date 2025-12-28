const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', validateUserUpdate, async (req, res) => {
  try {
    const { displayName, avatar, realName, discordName, mahjongSoulName } = req.body;
    const user = await User.findById(req.user._id);

    if (displayName !== undefined) {
      // Check if displayName is already taken by another user
      const existingUser = await User.findOne({ 
        displayName, 
        _id: { $ne: user._id } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Display name already taken'
        });
      }
      
      user.displayName = displayName;
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    if (realName !== undefined) {
      user.realName = realName.trim() === '' ? null : realName.trim();
    }

    if (discordName !== undefined) {
      user.discordName = discordName.trim() === '' ? null : discordName.trim();
    }

    if (mahjongSoulName !== undefined) {
      user.mahjongSoulName = mahjongSoulName.trim() === '' ? null : mahjongSoulName.trim();
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users by display name
// @access  Private
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 10;

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: {
          users: []
        }
      });
    }

    const users = await User.find({
      $or: [
        { displayName: { $regex: q.trim(), $options: 'i' } },
        { realName: { $regex: q.trim(), $options: 'i' } },
        { discordName: { $regex: q.trim(), $options: 'i' } },
        { mahjongSoulName: { $regex: q.trim(), $options: 'i' } }
      ]
    })
      .select('displayName realName avatar')
      .limit(limit);

    res.json({
      success: true,
      data: {
        users
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get statistics for a user
// @access  Private
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.params.id;

    // Get all games where user is involved (submitted or played)
    const allGames = await Game.find({
      $or: [
        { submittedBy: userId },
        { 'players.player': userId }
      ]
    });

    // Calculate statistics
    const gamesSubmitted = allGames.filter(g => g.submittedBy.toString() === userId).length;
    const gamesPlayed = allGames.length;

    // Get all scores from games where user played
    const allScores = [];
    allGames.forEach(game => {
      const userPlayer = game.players.find(p => p.player.toString() === userId);
      if (userPlayer) {
        allScores.push(userPlayer.score);
      }
    });

    const totalScore = allScores.reduce((sum, score) => sum + score, 0);
    const averageScore = allScores.length > 0 ? Math.round((totalScore / allScores.length) * 100) / 100 : 0;
    const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalGames: gamesPlayed,
          gamesSubmitted,
          gamesPlayed,
          averageScore,
          highestScore,
          lowestScore
        }
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user stats'
    });
  }
});

// @route   GET /api/users/:id/games
// @desc    Get games for a user (only games where user was a player)
// @access  Private
router.get('/:id/games', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const games = await Game.find({
      'players.player': req.params.id
    })
      .populate('submittedBy', 'displayName email avatar')
      .populate('players.player', 'displayName email avatar')
      .populate('verifiedBy', 'displayName')
      .sort({ gameDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments({
      'players.player': req.params.id
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
    console.error('Get user games error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user games'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
});

module.exports = router;

