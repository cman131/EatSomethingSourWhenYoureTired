const mongoose = require('mongoose');
const DecisionQuiz = require('./DecisionQuiz');

// Connect to test database (you may need to adjust this)
beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('DecisionQuiz Model Validation', () => {
  beforeEach(async () => {
    // Clear DecisionQuiz collection before each test
    await DecisionQuiz.deleteMany({});
  });

  test('should create a valid DecisionQuiz', async () => {
    // TODO: Fill in all tile values below
    
    const validDecisionQuiz = {
      players: [
        {
          // Player 0 - Non-user (East seat)
          hand: [
            "M5R", "M7", "M8", "P4", "P5", "P5", "P6", "P7", "P7", "P7", "P8", "S", "r"
          ],
          discard: [
            "P9", "r", "S3", "M8", "S6", "S9", "N", "S5", "M2", "M1", "S8", "M6", "P1", "M4", "M4", "M6", "M9"
          ],
          melds: [
          ],
          seat: 'E',
          isUser: false,
          score: 18000,
          riichiTile: null
        },
        {
          // Player 1 - Non-user (South seat)
          hand: [
            "P1", "P2", "P3", "P4", "P4", "S5R", "S6"
          ],
          discard: [
            "P9", "M9", "M1", "g", "M8", "S8", "M7", "M3", "S1", "g", "M3", "N", "g", "E", "N", "P6", "r"
          ],
          melds: [
            {
                tiles: ["W", "W", "W"],
                stolenTileIndex: 2,
                stolenFromSeat: "E"
            },
            {
                tiles: ["S9", "S9", "S9"],
                stolenTileIndex: 1,
                stolenFromSeat: "E"
            }
          ],
          seat: 'S', // TODO: Set seat wind
          isUser: false,
          score: 29100, // TODO: Set score
          riichiTile: null
        },
        {
          // Player 2 - User (West seat)
          hand: [
            "S2", "S3", "S4", "S6", "S7", "S8", "S", "P3"
          ],
          discard: [
            "N", "P9", "P1", "P6", "P3", "M3", "P8", "P2", "M4", "S7", "P9", "S3", "P4", "P3", "M9"
          ],
          melds: [
            {
                tiles: ["S2", "S3", "S4"],
                stolenTileIndex: 1,
                stolenFromSeat: "S"
            },
            {
                tiles: ["E", "E", "E"],
                stolenTileIndex: 1,
                stolenFromSeat: "E"
            }
          ],
          seat: 'W',
          isUser: true,
          score: 23900,
          riichiTile: null
        },
        {
          // Player 3 - Non-user (North seat)
          hand: [
            "S"
          ],
          discard: [
            "S1", "S8", "P5R", "S6", "P8", "g", "W", "P6", "S1", "M2", "M6", "P1", "S2", "S5", "S1", "P2", "S4", "M6", "M2"
          ],
          melds: [
                {
                    tiles: ["M5", "M5", "M5"],
                    stolenTileIndex: 2,
                    stolenFromSeat: "W"
                },
                {
                    tiles: ["M1", "M2", "M3"],
                    stolenTileIndex: 2,
                    stolenFromSeat: "W"
                },
                {
                    tiles: ["M7", "M8", "M9"],
                    stolenTileIndex: 2,
                    stolenFromSeat: "W"
                },
                {
                    tiles: ["w", "w", "w", "w"],
                    stolenTileIndex: 2,
                    stolenFromSeat: "S"
                }
          ],
          seat: 'N',
          isUser: false,
          score: 29000,
          riichiTile: null
        },
      ],
      doraIndicators: [
        "M4", "P8"
      ],
      roundWind: 'E',
      responses: new Map(),
    };

    validDecisionQuiz.id = DecisionQuiz.generateId(validDecisionQuiz.players, validDecisionQuiz.doraIndicators, validDecisionQuiz.roundWind);
    const quiz = new DecisionQuiz(validDecisionQuiz);
    const savedQuiz = await quiz.save();
    
    expect(savedQuiz.id).toBeDefined();
    expect(savedQuiz.players).toHaveLength(4);
    expect(savedQuiz.players[2].isUser).toBe(true);
  });
});

