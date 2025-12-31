const express = require('express');
const Achievement = require('../models/Achievement');
const { resolveAllAchievements, getGrandAchievementHolder } = require('../utils/achievementService');
const { validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/achievements
// @desc    Get all achievements with pagination
// @access  Private
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const achievements = await Achievement.find()
      .sort({ createdAt: 1 }) // Sort by creation date (oldest first)
      .skip(skip)
      .limit(limit);

    const total = await Achievement.countDocuments();

    res.json({
      success: true,
      data: {
        items: achievements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievements'
    });
  }
});

// @route   GET /api/achievements/user/:userId
// @desc    Get all achievements for a specific user with earned status
// @access  Private
router.get('/user/:userId', validateMongoId('userId'), async (req, res) => {
  try {
    const userId = req.params.userId;

    // Resolve all achievements for this user
    const results = await resolveAllAchievements(userId, {
      includeLeaderboard: true
    });

    // Format the response
    const achievements = results.map(result => ({
      achievement: result.achievement,
      earned: result.earned,
      requirementResults: result.requirementResults,
      userStats: result.userStats
    }));

    // Separate earned and unearned achievements
    const earnedAchievements = achievements.filter(a => a.earned);
    const unearnedAchievements = achievements.filter(a => !a.earned);

    res.json({
      success: true,
      data: {
        achievements,
        earned: earnedAchievements,
        unearned: unearnedAchievements,
        summary: {
          total: achievements.length,
          earned: earnedAchievements.length,
          unearned: unearnedAchievements.length
        }
      }
    });
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user achievements'
    });
  }
});

// @route   GET /api/achievements/grand/:achievementIdentifier
// @desc    Get the user(s) who currently hold a Grand achievement
// @access  Private
// @param   achievementIdentifier - Can be achievement name or ID
router.get('/grand/:achievementIdentifier', async (req, res) => {
  try {
    const achievementIdentifier = req.params.achievementIdentifier;
    const mongoose = require('mongoose');

    // Try to find achievement by ID or name
    // Only check _id if the identifier is a valid ObjectId to avoid casting errors
    const achievement = await Achievement.findOne(
      mongoose.Types.ObjectId.isValid(achievementIdentifier)
        ? { $or: [{ _id: achievementIdentifier }, { name: achievementIdentifier }] }
        : { name: achievementIdentifier }
    );

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      });
    }

    // Get the grand achievement holder(s)
    const result = await getGrandAchievementHolder(achievement);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get grand achievement holder error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get grand achievement holder'
    });
  }
});

module.exports = router;

