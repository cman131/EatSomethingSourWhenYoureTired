const express = require('express');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { attachHistoryContext } = require('../utils/pointsHistoryContext');
const pointsConfig = require('../utils/pointsConfig');

const router = express.Router();

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
