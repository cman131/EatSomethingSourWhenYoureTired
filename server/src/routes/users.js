const express = require('express');
const User = require('../models/User');
const { PLAYER_POPULATE_FIELDS } = require('../models/User');
const Game = require('../models/Game');
const DiscardQuiz = require('../models/DiscardQuiz');
const { validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favoriteTile');
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

    const { displayName, avatar, realName, discordName, mahjongSoulName, favoriteYaku, favoriteTile, clubAffiliation, privateMode, riichiMusic } = req.body;
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

    if (favoriteYaku !== undefined) {
      user.favoriteYaku = favoriteYaku === '' || favoriteYaku === null ? null : favoriteYaku;
    }

    if (favoriteTile !== undefined) {
      user.favoriteTile = favoriteTile === '' || favoriteTile === null ? null : favoriteTile;
    }

    if (clubAffiliation !== undefined) {
      user.clubAffiliation = clubAffiliation;
    }

    if (privateMode !== undefined) {
      user.privateMode = privateMode;
    }

    if (riichiMusic !== undefined) {
      user.riichiMusic = riichiMusic === '' || riichiMusic === null ? null : riichiMusic.trim();
    }

    await user.save();
    await user.populate('favoriteTile');

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

// @route   PUT /api/users/notification-preferences
// @desc    Update notification preferences for authenticated user
// @access  Private
router.put('/notification-preferences', async (req, res) => {
  try {
    const { emailNotificationsEnabled, emailNotificationsForComments, emailNotificationsForNewGames } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize notificationPreferences if it doesn't exist
    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    // Update preferences if provided
    if (emailNotificationsEnabled !== undefined) {
      user.notificationPreferences.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    if (emailNotificationsForComments !== undefined) {
      user.notificationPreferences.emailNotificationsForComments = emailNotificationsForComments;
    }

    if (emailNotificationsForNewGames !== undefined) {
      user.notificationPreferences.emailNotificationsForNewGames = emailNotificationsForNewGames;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences'
    });
  }
});

// @route   GET /api/users
// @desc    Get all users with pagination
// @access  Private
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({ privateMode: false })
      .select('displayName avatar privateMode realName discordName mahjongSoulName favoriteYaku')
      .sort({ displayName: 1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: {
        items: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users'
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

    // Only exception to private mode is when searching for users on a form
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

// @route   GET /api/users/notifications
// @desc    Get all notifications for authenticated user
// @access  Private
router.get('/notifications', async (req, res) => {
  try {
    console.log('Notifications endpoint hit, user ID:', req.user?._id);
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      data: {
        notifications: user.notifications || []
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    
    // Count games won by user (user has highest score)
    let gamesWon = 0;
    allGames.forEach(game => {
      const userPlayer = game.players.find(p => p.player.toString() === userId);
      if (userPlayer) {
        // Sort players by score (descending) to find winner
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        // Check if user is first (has highest score)
        if (sortedPlayers[0].player.toString() === userId) {
          gamesWon++;
        }
      }
    });
    
    // Count games verified by this user
    const gamesVerified = await Game.countDocuments({
      verifiedBy: userId
    });

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

    // Count quizzes responded to
    // Get all quizzes and check if user has responded to any of them
    const allQuizzes = await DiscardQuiz.find({});
    let quizzesRespondedTo = 0;
    const userIdString = userId.toString();
    
    for (const quiz of allQuizzes) {
      if (quiz.responses && quiz.responses.size > 0) {
        for (const [, userIds] of quiz.responses.entries()) {
          // userIds is an array of ObjectIds or strings
          const hasResponded = userIds.some(id => {
            const idString = id.toString ? id.toString() : id;
            return idString === userIdString;
          });
          if (hasResponded) {
            quizzesRespondedTo++;
            break; // User responded to this quiz, no need to check other tiles
          }
        }
      }
    }

    // Count comments made by user
    const commentsCount = await Game.aggregate([
      { $unwind: '$comments' },
      { $match: { 'comments.commenter': userId } },
      { $count: 'total' }
    ]);
    const commentsMade = commentsCount.length > 0 ? commentsCount[0].total : 0;

    res.json({
      success: true,
      data: {
        stats: {
          gamesWon,
          gamesVerified,
          gamesSubmitted,
          gamesPlayed,
          averageScore,
          highestScore,
          lowestScore,
          quizzesRespondedTo,
          commentsMade
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
      .populate('submittedBy', PLAYER_POPULATE_FIELDS)
      .populate('players.player', PLAYER_POPULATE_FIELDS)
      .populate('verifiedBy', PLAYER_POPULATE_FIELDS)
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

// @route   PUT /api/users/notifications/:notificationId/view
// @desc    Mark a notification as viewed
// @access  Private
router.put('/notifications/:notificationId/view', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user data'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const notificationId = req.params.notificationId;
    const notification = user.notifications.id(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.viewed = true;
    await user.save();

    res.json({
      success: true,
      message: 'Notification marked as viewed',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Mark notification as viewed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as viewed'
    });
  }
});

// @route   PUT /api/users/notifications/view-all
// @desc    Mark all notifications as viewed
// @access  Private
router.put('/notifications/view-all', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user data'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.notifications.forEach(notification => {
      notification.viewed = true;
    });
    await user.save();

    res.json({
      success: true,
      message: 'All notifications marked as viewed',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Mark all notifications as viewed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as viewed'
    });
  }
});

// @route   DELETE /api/users/notifications/:notificationId
// @desc    Remove a specific notification from authenticated user
// @access  Private
router.delete('/notifications/:notificationId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const notificationId = req.params.notificationId;
    const notification = user.notifications.id(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    user.notifications.pull(notificationId);
    await user.save();

    res.json({
      success: true,
      message: 'Notification removed successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Remove notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove notification'
    });
  }
});

// @route   DELETE /api/users/notifications
// @desc    Clear all notifications from authenticated user
// @access  Private
router.delete('/notifications', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.notifications = [];
    await user.save();

    res.json({
      success: true,
      message: 'All notifications cleared successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear notifications'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('favoriteTile');
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

