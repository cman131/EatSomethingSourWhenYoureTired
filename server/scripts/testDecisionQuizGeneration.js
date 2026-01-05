const mongoose = require('mongoose');
require('dotenv').config();
const { generateDecisionQuiz } = require('../src/utils/decisionQuizService');
const DecisionQuiz = require('../src/models/DecisionQuiz');

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-club';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test function
async function testDecisionQuizGeneration() {
  try {
    await connectDB();

    const numTests = 5;
    console.log(`\n🧪 Testing generateDecisionQuiz ${numTests} times...\n`);

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (let i = 1; i <= numTests; i++) {
      console.log(`Test ${i}/${numTests}:`);
      
      try {
        // Generate quiz with random options
        const userSeat = ['E', 'S', 'W', 'N'][Math.floor(Math.random() * 4)];
        const roundWind = ['E', 'S'][Math.floor(Math.random() * 2)];
        const numDora = Math.floor(Math.random() * 4) + 1; // 1-4
        
        console.log(`  Generating with userSeat=${userSeat}, roundWind=${roundWind}, numDora=${numDora}...`);
        
        const quiz = await generateDecisionQuiz({
          userSeat,
          roundWind,
          numDora
        });

        // Validate the quiz
        console.log(`  ✓ Quiz created with ID: ${quiz.id}`);
        console.log(`    - User player: ${quiz.players.find(p => p.isUser).seat} (${quiz.players.find(p => p.isUser).hand.length} tiles)`);
        console.log(`    - Total scores: ${quiz.players.reduce((sum, p) => sum + p.score, 0)}`);
        console.log(`    - Dora indicators: ${quiz.doraIndicators.length}`);
        console.log(`    - Total melds: ${quiz.players.reduce((sum, p) => sum + p.melds.length, 0)}`);
        
        // Check if scores are multiples of 100
        const invalidScores = quiz.players.filter(p => p.score % 100 !== 0);
        if (invalidScores.length > 0) {
          throw new Error(`Scores not multiples of 100: ${invalidScores.map(p => `${p.seat}:${p.score}`).join(', ')}`);
        }

        // Verify total score
        const totalScore = quiz.players.reduce((sum, p) => sum + p.score, 0);
        if (totalScore !== 100000) {
          throw new Error(`Total score is ${totalScore}, expected 100000`);
        }

        // Verify hand + meld counts
        for (const player of quiz.players) {
          const handCount = player.hand.length;
          const meldCount = player.melds.length * 3; // Each meld counts as 3 tiles
          const totalTiles = handCount + meldCount;
          const expectedTiles = player.isUser ? 14 : 13;
          
          if (totalTiles !== expectedTiles) {
            throw new Error(`Player ${player.seat} (${player.isUser ? 'user' : 'non-user'}): hand (${handCount}) + melds (${meldCount}) = ${totalTiles}, expected ${expectedTiles}`);
          }
        }

        // Try to reload from database to ensure it was saved correctly
        const reloaded = await DecisionQuiz.findOne({ id: quiz.id });
        if (!reloaded) {
          throw new Error('Quiz not found in database after save');
        }

        console.log(`  ✅ Test ${i} PASSED\n`);
        successCount++;

        // Clean up - delete the test quiz
        await DecisionQuiz.deleteOne({ id: quiz.id });

      } catch (error) {
        console.error(`  ❌ Test ${i} FAILED: ${error.message}\n`);
        errors.push({ test: i, error: error.message });
        failureCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${successCount}/${numTests}`);
    console.log(`   ❌ Failed: ${failureCount}/${numTests}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ test, error }) => {
        console.log(`   Test ${test}: ${error}`);
      });
    }

    if (failureCount === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run tests
testDecisionQuizGeneration();

