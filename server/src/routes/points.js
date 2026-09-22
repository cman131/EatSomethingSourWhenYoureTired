const express = require('express');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { attachHistoryContext } = require('../utils/pointsHistoryContext');
const { adjustPoints, AdjustmentFailure } = require('../utils/pointsService');
const { validateAdminAdjustment } = require('../middleware/validation');
const pointsConfig = require('../utils/pointsConfig');

const router = express.Router();

const ADJUSTMENT_FAILURE_RESPONSES = {
  [AdjustmentFailure.UserNotFound]: { status: 404, message: 'User not found' },
  [AdjustmentFailure.InsufficientBalance]: { status: 400, message: 'Adjustment would drop the balance below zero' },
};

function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  next();
}

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

function parseHistoryPaging(query) {
  const page = parseInt(query.page, 10);
  const limit = parseInt(query.limit, 10);
  return {
    page: Number.isNaN(page) ? 1 : Math.max(page, 1),
    limit: limit === 0 || Number.isNaN(limit)
      ? DEFAULT_HISTORY_LIMIT
      : Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT),
  };
}

// @route   GET /api/points/me
// @desc    Get current user's points summary
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('pointsBalance totalPointsEarned');
    const recentTransactions = await PointTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        balance: user.pointsBalance,
        totalEarned: user.totalPointsEarned,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error('Get points summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get points summary' });
  }
});

// @route   GET /api/points/me/history
// @desc    Get paginated transaction history for current user
// @access  Private
router.get('/me/history', async (req, res) => {
  try {
    const { page, limit } = parseHistoryPaging(req.query);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      PointTransaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PointTransaction.countDocuments({ user: req.user._id }),
    ]);
    const items = await attachHistoryContext(transactions);

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get points history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get points history' });
  }
});

// @route   POST /api/points/admin/adjust
// @desc    Manually adjust a player's points balance with a required reason
// @access  Private (admin only)
router.post('/admin/adjust', requireAdmin, validateAdminAdjustment, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    const result = await adjustPoints({
      userId,
      amount: Number(amount),
      adjustedBy: req.user._id,
      reason: reason.trim(),
    });

    if (!result.adjusted) {
      const failure = ADJUSTMENT_FAILURE_RESPONSES[result.reason];
      return res.status(failure.status).json({ success: false, message: failure.message });
    }

    res.json({ success: true, message: 'Adjustment recorded' });
  } catch (error) {
    console.error('Admin point adjustment error:', error);
    res.status(500).json({ success: false, message: 'Failed to record adjustment' });
  }
});

// @route   GET /api/points/config
// @desc    Get the current award amounts, so the client never hardcodes them
// @access  Private
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        gamePlacementAmounts: pointsConfig.GAME_PLACEMENT_AMOUNTS,
        gameSubmittedAmount: pointsConfig.GAME_SUBMITTED_AMOUNT,
        gameVerifiedAmount: pointsConfig.GAME_VERIFIED_AMOUNT,
        gameDailyCap: pointsConfig.GAME_DAILY_CAP,
        gameDailyWindowHours: pointsConfig.GAME_DAILY_WINDOW_MS / (60 * 60 * 1000),
        repeatGroupMaxGames: pointsConfig.REPEAT_GROUP_MAX_GAMES,
        repeatGroupWindowDays: pointsConfig.REPEAT_GROUP_WINDOW_MS / (24 * 60 * 60 * 1000),
        tournamentParticipationAmount: pointsConfig.TOURNAMENT_PARTICIPATION_AMOUNT,
        tournamentPlacementAmounts: pointsConfig.TOURNAMENT_PLACEMENT_AMOUNTS,
        rankedQualificationAmount: pointsConfig.RANKED_QUALIFICATION_AMOUNT,
        rankedPlacementAmounts: pointsConfig.RANKED_PLACEMENT_AMOUNTS,
        quizCompletionAmount: pointsConfig.QUIZ_COMPLETION_AMOUNT,
        quizWeeklyCapCount: pointsConfig.QUIZ_WEEKLY_CAP_COUNT,
        weeklyStreakAmounts: pointsConfig.WEEKLY_STREAK_AMOUNTS,
      },
    });
  } catch (error) {
    console.error('Get points config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get points config' });
  }
});

module.exports = router;
