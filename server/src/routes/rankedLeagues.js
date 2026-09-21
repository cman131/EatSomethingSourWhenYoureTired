const express = require('express');
const { getCurrentLeague, RANKED_GAMES_THRESHOLD } = require('../utils/rankedLeagueService');
const { PLAYER_POPULATE_FIELDS } = require('../models/User');

const router = express.Router();

async function toLeagueResponse(league) {
  await league.populate('players.player', PLAYER_POPULATE_FIELDS);
  const leagueObj = league.toObject();
  leagueObj.players = leagueObj.players.sort((a, b) => b.rankedPoints - a.rankedPoints);
  leagueObj.rankedGamesThreshold = RANKED_GAMES_THRESHOLD;
  return leagueObj;
}

// @route   GET /api/ranked-leagues/current
// @desc    Get the current ranked league with sorted players
// @access  Private
router.get('/current', async (req, res) => {
  try {
    const league = await getCurrentLeague();
    res.json({
      success: true,
      data: { league: await toLeagueResponse(league) }
    });
  } catch (error) {
    console.error('Get ranked league error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ranked league' });
  }
});

// @route   POST /api/ranked-leagues/current/join
// @desc    Join the current ranked league (no-op if already joined)
// @access  Private
router.post('/current/join', async (req, res) => {
  try {
    const league = await getCurrentLeague();

    const alreadyJoined = league.players.some(
      p => p.player.toString() === req.user._id.toString()
    );

    if (!alreadyJoined) {
      league.players.push({ player: req.user._id, rankedPoints: 500 });
      await league.save();
    }

    res.json({
      success: true,
      data: { league: await toLeagueResponse(league) }
    });
  } catch (error) {
    console.error('Join ranked league error:', error);
    res.status(500).json({ success: false, message: 'Failed to join ranked league' });
  }
});

module.exports = router;
