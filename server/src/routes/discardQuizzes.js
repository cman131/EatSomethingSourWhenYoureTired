const express = require('express');
const DiscardQuiz = require('../models/DiscardQuiz');
const Tile = require('../models/Tile');

const router = express.Router();

// Helper function to generate a random hand and dora indicator
const generateRandomHandAndDoraIndicator = (allTiles) => {
  const red5Tiles = ['M5R', 'P5R', 'S5R'];
  
  // Create a pool of available tiles
  const regularTiles = allTiles.filter(tile => !red5Tiles.includes(tile.id));
  const red5TilesList = allTiles.filter(tile => red5Tiles.includes(tile.id));
  
  // Build a pool of available tiles with their max counts
  const tilePool = [];
  regularTiles.forEach(tile => {
    let count = 4;

    // The 4th tile is the red 5
    if (tile.id === 'M5' || tile.id === 'P5' || tile.id === 'S5') {
      count = 3;
    }
    for (let i = 0; i < count; i++) {
      tilePool.push(tile.id);
    }
  });
  red5TilesList.forEach(tile => {
    tilePool.push(tile.id); // Red 5s can only appear once
  });
  
  // Shuffle the pool
  for (let i = tilePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tilePool[i], tilePool[j]] = [tilePool[j], tilePool[i]];
  }
  
  // Take first 14 tiles from shuffled pool
  return { hand: tilePool.slice(0, 14), doraIndicator: tilePool.slice(14, 15)[0] };
};

// Helper function to populate tile information
const populateTiles = async (tileIds) => {
  const tiles = await Tile.find({ id: { $in: tileIds } });
  const tileMap = {};
  tiles.forEach(tile => {
    tileMap[tile.id] = {
      id: tile.id,
      name: tile.name,
      suit: tile.suit
    };
  });
  
  // Return tiles in the same order as tileIds, with tile info
  return tileIds.map(tileId => tileMap[tileId] || { id: tileId, name: tileId, suit: null });
};

// @route   GET /api/discard-quizzes/:id
// @desc    Get discard quiz by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const quizId = req.params.id;
    
    const quiz = await DiscardQuiz.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Discard quiz not found'
      });
    }
    
    // Populate tile information for hand and dora indicator
    const handTiles = await populateTiles(quiz.hand);
    const doraTile = (await populateTiles([quiz.doraIndicator]))[0];
    
    // Convert responses Map to object for easier handling
    const responsesObj = {};
    if (quiz.responses) {
      for (const [tile, userIds] of quiz.responses.entries()) {
        responsesObj[tile] = userIds;
      }
    }
    
    res.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          hand: handTiles,
          doraIndicator: doraTile,
          seat: quiz.seat,
          roundWind: quiz.roundWind,
          responses: responsesObj,
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get discard quiz error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get discard quiz'
    });
  }
});

// @route   GET /api/discard-quizzes/generate/random
// @desc    Generate or retrieve a random discard quiz
// @access  Private
router.get('/generate/random', async (req, res) => {
  try {
    // Get all tiles from database
    const allTiles = await Tile.find();
    
    if (allTiles.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No tiles found in database. Please seed the tile collection first.'
      });
    }
    
    const userId = req.user._id;
    const userIdString = userId.toString();
    
    // 50% chance to attempt loading an existing quiz or generate a new one
    const shouldLoadExisting = Math.random() < 0.9;
    
    if (shouldLoadExisting) {
      // Try to find an existing quiz that the user hasn't responded to using aggregation
      // This filters in MongoDB instead of fetching all quizzes and filtering in JavaScript
      const unrespondedQuizzes = await DiscardQuiz.aggregate([
        {
          $match: {
            $and: [
              // Ensure required fields exist
              { seat: { $exists: true, $ne: null } },
              { roundWind: { $exists: true, $ne: null } },
              {
                $expr: {
                  $or: [
                    // Responses field doesn't exist or is null
                    { $eq: [{ $type: "$responses" }, "missing"] },
                    { $eq: ["$responses", null] },
                    // Responses is empty object
                    { $eq: [{ $size: { $objectToArray: { $ifNull: ["$responses", {}] } } }, 0] },
                    // User ID is not in any of the response arrays
                    {
                      $not: {
                        $anyElementTrue: {
                          $map: {
                            input: { $objectToArray: { $ifNull: ["$responses", {}] } },
                            as: "response",
                            in: { $in: [userId, { $ifNull: ["$$response.v", []] }] }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        { $sample: { size: 1 } }
      ]);
      
      // If we found unresponded quizzes, return the random one
      if (unrespondedQuizzes.length > 0) {
        const randomQuiz = unrespondedQuizzes[0];
        
        // Populate tile information for hand and dora indicator
        const handTiles = await populateTiles(randomQuiz.hand);
        const doraTile = (await populateTiles([randomQuiz.doraIndicator]))[0];
        
        const responsesObj = {};
        if (randomQuiz.responses) {
          // Aggregation returns plain objects, not Maps, so use Object.entries()
          for (const [tile, userIds] of Object.entries(randomQuiz.responses)) {
            responsesObj[tile] = userIds;
          }
        }
        
        return res.json({
          success: true,
          data: {
            quiz: {
              id: randomQuiz.id,
              hand: handTiles,
              doraIndicator: doraTile,
              seat: randomQuiz.seat,
              roundWind: randomQuiz.roundWind,
              responses: responsesObj,
              createdAt: randomQuiz.createdAt,
              updatedAt: randomQuiz.updatedAt
            }
          }
        });
      }
      // If no unresponded quiz found, fall through to generate a new one
    }
    
    // Generate a new quiz (either by decision or because no existing quiz was found)
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops
    
    // Try to generate a quiz that the user hasn't responded to
    while (attempts < maxAttempts) {
      attempts++;
      
      // Generate a random hand and dora indicator
      let randomHandAndDoraIndicator = generateRandomHandAndDoraIndicator(allTiles);
      let hand = randomHandAndDoraIndicator.hand;
      let doraIndicator = randomHandAndDoraIndicator.doraIndicator;
      
      // Generate random seat and round wind
      const seats = ['E', 'S', 'W', 'N'];
      const roundWinds = ['E', 'S'];
      const seat = seats[Math.floor(Math.random() * seats.length)];
      const roundWind = roundWinds[Math.floor(Math.random() * roundWinds.length)];
      
      // Generate deterministic ID
      const quizId = DiscardQuiz.generateId(hand, doraIndicator, seat, roundWind);
      
      // Check if quiz already exists
      let quiz = await DiscardQuiz.findOne({ id: quizId });
      
    if (quiz) {
      // Quiz exists, check if user has already responded
      let userHasResponded = false;
      
      if (quiz.responses && quiz.responses.size > 0) {
        for (const [, userIds] of quiz.responses.entries()) {
          if (userIds.some(id => id.toString() === userIdString)) {
            userHasResponded = true;
            break;
          }
        }
      }
      
      // If user hasn't responded, return the existing quiz
      if (!userHasResponded) {
        // Populate tile information for hand and dora indicator
        const handTiles = await populateTiles(quiz.hand);
        const doraTile = (await populateTiles([quiz.doraIndicator]))[0];
        
        const responsesObj = {};
        if (quiz.responses) {
          for (const [tile, userIds] of quiz.responses.entries()) {
            responsesObj[tile] = userIds;
          }
        }
        
        return res.json({
          success: true,
          data: {
            quiz: {
              id: quiz.id,
              hand: handTiles,
              doraIndicator: doraTile,
              seat: quiz.seat,
              roundWind: quiz.roundWind,
              responses: responsesObj,
              createdAt: quiz.createdAt,
              updatedAt: quiz.updatedAt
            }
          }
        });
      }
      
      // User has already responded, regenerate and try again
      continue;
    }
    
    // Quiz doesn't exist, create it
    quiz = new DiscardQuiz({
      id: quizId,
      hand,
      doraIndicator,
      seat,
      roundWind,
      responses: new Map()
    });
    
    await quiz.save();
    
    // Populate tile information for hand and dora indicator
    const handTiles = await populateTiles(quiz.hand);
    const doraTile = (await populateTiles([quiz.doraIndicator]))[0];
    
    return res.status(201).json({
      success: true,
      message: 'Discard quiz created successfully',
      data: {
        quiz: {
          id: quiz.id,
          hand: handTiles,
          doraIndicator: doraTile,
          seat: quiz.seat,
          roundWind: quiz.roundWind,
          responses: {},
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt
        }
      }
    });
    }
    
    // If we've tried too many times, return an error
    res.status(500).json({
      success: false,
      message: 'Unable to generate a new quiz. Please try again later.'
    });
  } catch (error) {
    console.error('Generate discard quiz error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate discard quiz'
    });
  }
});

// @route   PUT /api/discard-quizzes/:id/response
// @desc    Submit a tile choice for a discard quiz
// @access  Private
router.put('/:id/response', async (req, res) => {
  try {
    const { tileId } = req.body;
    const quizId = req.params.id;

    // Validate tileId is provided
    if (!tileId) {
      return res.status(400).json({
        success: false,
        message: 'tileId is required'
      });
    }

    // Find the quiz by its deterministic ID
    const quiz = await DiscardQuiz.findOne({ id: quizId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Discard quiz not found'
      });
    }

    // Ensure required fields exist (safety check for old/invalid quizzes)
    if (!quiz.seat || !quiz.roundWind) {
      return res.status(400).json({
        success: false,
        message: 'Quiz is missing required fields. Please try a different quiz.'
      });
    }

    // Validate that tileId is in the hand
    if (!quiz.hand.includes(tileId)) {
      return res.status(400).json({
        success: false,
        message: `Tile ${tileId} is not part of the quiz hand`
      });
    }

    // Get or initialize the responses array for this tile
    const userId = req.user._id;
    const userIdString = userId.toString();
    
    // Check if user already submitted a response for any tile
    let previousTileId = null;
    for (const [tile, userIds] of quiz.responses.entries()) {
      if (userIds.some(id => id.toString() === userIdString)) {
        previousTileId = tile;
        break;
      }
    }

    // If user has already responded, remove their previous response
    if (previousTileId) {
      const previousResponses = quiz.responses.get(previousTileId) || [];
      const filteredResponses = previousResponses.filter(id => id.toString() !== userIdString);
      
      if (filteredResponses.length === 0) {
        // Remove the tile entry if no responses remain
        quiz.responses.delete(previousTileId);
      } else {
        quiz.responses.set(previousTileId, filteredResponses);
      }
    }

    // Add the new response
    const currentResponses = quiz.responses.get(tileId) || [];
    const updatedResponses = [...currentResponses, userId];
    quiz.responses.set(tileId, updatedResponses);
    
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');

    await quiz.save();

    // Reload quiz to get fresh data
    const updatedQuiz = await DiscardQuiz.findOne({ id: quizId });

    // Populate tile information for hand and dora indicator
    const handTiles = await populateTiles(updatedQuiz.hand);
    const doraTile = (await populateTiles([updatedQuiz.doraIndicator]))[0];

    // Convert responses Map to object for easier handling
    const responsesObj = {};
    if (updatedQuiz.responses) {
      for (const [tile, userIds] of updatedQuiz.responses.entries()) {
        responsesObj[tile] = userIds;
      }
    }

    res.json({
      success: true,
      message: 'Response submitted successfully',
      data: {
        quiz: {
          id: updatedQuiz.id,
          hand: handTiles,
          doraIndicator: doraTile,
          seat: updatedQuiz.seat,
          roundWind: updatedQuiz.roundWind,
          responses: responsesObj,
          createdAt: updatedQuiz.createdAt,
          updatedAt: updatedQuiz.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Submit discard quiz response error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit response'
    });
  }
});

module.exports = router;

