const express = require('express');
const Tile = require('../models/Tile');

const router = express.Router();

// @route   GET /api/tiles
// @desc    Get all tiles
// @access  Private
router.get('/', async (req, res) => {
  try {
    const tiles = await Tile.find().sort({ suit: 1, id: 1 });
    
    res.json({
      success: true,
      data: {
        tiles
      }
    });
  } catch (error) {
    console.error('Get tiles error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tiles'
    });
  }
});

module.exports = router;

