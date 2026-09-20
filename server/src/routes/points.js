const express = require('express');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

const router = express.Router();

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      PointTransaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PointTransaction.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get points history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get points history' });
  }
});

module.exports = router;
