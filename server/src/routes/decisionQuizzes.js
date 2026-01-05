const express = require('express');
const DecisionQuiz = require('../models/DecisionQuiz');
const Tile = require('../models/Tile');
const { generateDecisionQuiz } = require('../utils/decisionQuizService');

const router = express.Router();

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

// @route   GET /api/decision-quizzes/:id
// @desc    Get decision quiz by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const quizId = req.params.id;
    
    const quiz = await DecisionQuiz.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Decision quiz not found'
      });
    }
    
    // Populate tile information for all players
    const playersWithTiles = await Promise.all(quiz.players.map(async (player) => {
      const handTiles = await populateTiles(player.hand);
      const discardTiles = await populateTiles(player.discard);
      
      // Populate meld tiles
      const meldsWithTiles = await Promise.all(player.melds.map(async (meld) => {
        const meldTiles = await populateTiles(meld.tiles);
        return {
          tiles: meldTiles,
          stolenTileIndex: meld.stolenTileIndex,
          stolenFromSeat: meld.stolenFromSeat
        };
      }));
      
      return {
        hand: handTiles,
        discard: discardTiles,
        melds: meldsWithTiles,
        seat: player.seat,
        isUser: player.isUser,
        score: player.score,
        riichiTile: player.riichiTile
      };
    }));
    
    // Populate dora indicator tiles
    const doraTiles = await populateTiles(quiz.doraIndicators);
    
    // Convert responses Map to object for easier handling
    const responsesObj = {};
    if (quiz.responses) {
      for (const [tile, responseData] of quiz.responses.entries()) {
        responsesObj[tile] = responseData;
      }
    }
    
    res.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          players: playersWithTiles,
          doraIndicators: doraTiles,
          roundWind: quiz.roundWind,
          roundNumber: quiz.roundNumber,
          remainingTileCount: quiz.remainingTileCount,
          responses: responsesObj,
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get decision quiz error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get decision quiz'
    });
  }
});

// @route   GET /api/decision-quizzes/generate/random
// @desc    Generate or retrieve a random decision quiz
// @access  Private
router.get('/generate/random', async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = userId.toString();
    
    // 90% chance to attempt loading an existing quiz or generate a new one
    const shouldLoadExisting = Math.random() < 0.99;
    
    if (shouldLoadExisting) {
      // Try to find an existing quiz that the user hasn't responded to using aggregation
      const unrespondedQuizzes = await DecisionQuiz.aggregate([
        {
          $match: {
            $and: [
              // Ensure required fields exist
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
        
        // Populate tile information for all players
        const playersWithTiles = await Promise.all(randomQuiz.players.map(async (player) => {
          const handTiles = await populateTiles(player.hand);
          const discardTiles = await populateTiles(player.discard);
          
          // Populate meld tiles
          const meldsWithTiles = await Promise.all((player.melds || []).map(async (meld) => {
            const meldTiles = await populateTiles(meld.tiles);
            return {
              tiles: meldTiles,
              stolenTileIndex: meld.stolenTileIndex,
              stolenFromSeat: meld.stolenFromSeat
            };
          }));
          
          return {
            hand: handTiles,
            discard: discardTiles,
            melds: meldsWithTiles,
            seat: player.seat,
            isUser: player.isUser,
            score: player.score,
            riichiTile: player.riichiTile
          };
        }));
        
        // Populate dora indicator tiles
        const doraTiles = await populateTiles(randomQuiz.doraIndicators);
        
        const responsesObj = {};
        if (randomQuiz.responses) {
          // Aggregation returns plain objects, not Maps
          for (const [tile, responseData] of Object.entries(randomQuiz.responses)) {
            responsesObj[tile] = responseData;
          }
        }
        
        return res.json({
          success: true,
          data: {
            quiz: {
              id: randomQuiz.id,
              players: playersWithTiles,
              doraIndicators: doraTiles,
              roundWind: randomQuiz.roundWind,
              remainingTileCount: randomQuiz.remainingTileCount,
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
      
      // Generate quiz using service
      const quiz = await generateDecisionQuiz();
        
      // Check if user has already responded
      let userHasResponded = false;
      
      if (quiz.responses && quiz.responses.size > 0) {
        for (const [, responseData] of quiz.responses.entries()) {
          // Check if responseData contains userId (could be array or object)
          if (Array.isArray(responseData)) {
            if (responseData.some(id => id.toString() === userIdString)) {
              userHasResponded = true;
              break;
            }
          } else if (responseData && typeof responseData === 'object') {
            // Check if userId is in the response object
            if (Object.values(responseData).some(id => id && id.toString() === userIdString)) {
              userHasResponded = true;
              break;
            }
          }
        }
      }
      
      // If user hasn't responded, return the quiz
      if (!userHasResponded) {
        // Populate tile information for all players
        const playersWithTiles = await Promise.all(quiz.players.map(async (player) => {
          const handTiles = await populateTiles(player.hand);
          const discardTiles = await populateTiles(player.discard);
          
          // Populate meld tiles
          const meldsWithTiles = await Promise.all(player.melds.map(async (meld) => {
            const meldTiles = await populateTiles(meld.tiles);
            return {
              tiles: meldTiles,
              stolenTileIndex: meld.stolenTileIndex,
              stolenFromSeat: meld.stolenFromSeat
            };
          }));
          
          return {
            hand: handTiles,
            discard: discardTiles,
            melds: meldsWithTiles,
            seat: player.seat,
            isUser: player.isUser,
            score: player.score,
            riichiTile: player.riichiTile
          };
        }));
        
        // Populate dora indicator tiles
        const doraTiles = await populateTiles(quiz.doraIndicators);
        
        const responsesObj = {};
        if (quiz.responses) {
          for (const [tile, responseData] of quiz.responses.entries()) {
            responsesObj[tile] = responseData;
          }
        }
        
        return res.status(201).json({
          success: true,
          message: 'Decision quiz created successfully',
          data: {
            quiz: {
              id: quiz.id,
              players: playersWithTiles,
              doraIndicators: doraTiles,
              roundWind: quiz.roundWind,
              remainingTileCount: quiz.remainingTileCount,
              responses: responsesObj,
              createdAt: quiz.createdAt,
              updatedAt: quiz.updatedAt
            }
          }
        });
      }
      
      // User has already responded, try again
      continue;
    }
    
    // If we've tried too many times, return an error
    res.status(500).json({
      success: false,
      message: 'Unable to generate a new quiz. Please try again later.'
    });
  } catch (error) {
    console.error('Generate decision quiz error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate decision quiz'
    });
  }
});

// @route   PUT /api/decision-quizzes/:id/response
// @desc    Submit a tile choice for a decision quiz
// @access  Private
router.put('/:id/response', async (req, res) => {
  try {
    const { tileId, responseData } = req.body;
    const quizId = req.params.id;

    // Validate tileId is provided
    if (!tileId) {
      return res.status(400).json({
        success: false,
        message: 'tileId is required'
      });
    }

    // Find the quiz by its deterministic ID
    const quiz = await DecisionQuiz.findOne({ id: quizId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Decision quiz not found'
      });
    }

    // Find the user player
    const userPlayer = quiz.players.find(p => p.isUser);
    if (!userPlayer) {
      return res.status(400).json({
        success: false,
        message: 'User player not found in quiz'
      });
    }

    // Validate that tileId is in the user's hand
    if (!userPlayer.hand.includes(tileId)) {
      return res.status(400).json({
        success: false,
        message: `Tile ${tileId} is not part of the user's hand`
      });
    }

    // Get or initialize the response for this tile
    const userId = req.user._id;
    
    // Check if user already submitted a response for any tile
    let alreadyResponded = false;
    if (quiz.responses && quiz.responses.size > 0) {
      for (const [, existingResponse] of quiz.responses.entries()) {
        if (existingResponse.some(id => id.toString() === userId.toString())) {
          alreadyResponded = true;
          break;
        }
      }
    }

    if (alreadyResponded) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a response for this quiz'
      });
    }

    // Set the response data (or use userId if no responseData provided)
    const currentResponse = quiz.responses.get(tileId) || [];
    const responseToStore = [...currentResponse, userId];
    quiz.responses.set(tileId, responseToStore);
    
    // Mark the responses Map as modified so Mongoose saves it
    quiz.markModified('responses');
    await quiz.save();

    // Reload quiz to get fresh data
    const updatedQuiz = await DecisionQuiz.findOne({ id: quizId });

    // Populate tile information for all players
    const playersWithTiles = await Promise.all(updatedQuiz.players.map(async (player) => {
      const handTiles = await populateTiles(player.hand);
      const discardTiles = await populateTiles(player.discard);
      
      // Populate meld tiles
      const meldsWithTiles = await Promise.all(player.melds.map(async (meld) => {
        const meldTiles = await populateTiles(meld.tiles);
        return {
          tiles: meldTiles,
          stolenTileIndex: meld.stolenTileIndex,
          stolenFromSeat: meld.stolenFromSeat
        };
      }));
      
      return {
        hand: handTiles,
        discard: discardTiles,
        melds: meldsWithTiles,
        seat: player.seat,
        isUser: player.isUser,
        score: player.score,
        riichiTile: player.riichiTile
      };
    }));
    
    // Populate dora indicator tiles
    const doraTiles = await populateTiles(updatedQuiz.doraIndicators);

    // Convert responses Map to object for easier handling
    const responsesObj = {};
    if (updatedQuiz.responses) {
      for (const [tile, responseData] of updatedQuiz.responses.entries()) {
        responsesObj[tile] = responseData;
      }
    }

    res.json({
      success: true,
      message: 'Response submitted successfully',
      data: {
        quiz: {
          id: updatedQuiz.id,
          players: playersWithTiles,
          doraIndicators: doraTiles,
          roundWind: updatedQuiz.roundWind,
          remainingTileCount: updatedQuiz.remainingTileCount,
          responses: responsesObj,
          createdAt: updatedQuiz.createdAt,
          updatedAt: updatedQuiz.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Submit decision quiz response error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit response'
    });
  }
});

module.exports = router;

