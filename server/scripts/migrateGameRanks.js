const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import Game model
const Game = require('../src/models/Game');

// Connect to database
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mahjong-club';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function
const migrateGameRanks = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting game ranks migration...\n');
    
    // Find all games
    const games = await Game.find({});
    
    console.log(`Found ${games.length} games to process`);
    
    if (games.length === 0) {
      console.log('✓ No games to update');
      process.exit(0);
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each game
    for (const game of games) {
      try {
        // Skip if game doesn't have exactly 4 players
        if (!game.players || game.players.length !== 4) {
          console.log(`⚠ Skipping game ${game._id}: Expected 4 players, found ${game.players?.length || 0}`);
          skippedCount++;
          continue;
        }
        
        // Sort players by score descending (highest score = rank 1)
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        
        // Check if ranks need updating
        let needsUpdate = false;
        const newRanks = {};
        
        sortedPlayers.forEach((sortedPlayer, index) => {
          const rank = index + 1; // 1st, 2nd, 3rd, 4th
          const player = game.players.find(p => 
            p.player.toString() === sortedPlayer.player.toString()
          );
          
          if (player) {
            // Check if rank is different or missing
            if (player.rank !== rank) {
              needsUpdate = true;
              newRanks[player.player.toString()] = rank;
            }
          }
        });
        
        if (needsUpdate) {
          // Update ranks
          game.players.forEach(player => {
            const newRank = newRanks[player.player.toString()];
            if (newRank !== undefined) {
              player.rank = newRank;
            }
          });
          
          game.markModified('players');
          await game.save();
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`✗ Error processing game ${game._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Games: ${games.length}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped (no changes needed): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateGameRanks().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateGameRanks };
