const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import models
const Tournament = require('../src/models/Tournament');
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
const migrateStartingPointValue = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting UMA recalculation for completed tournament rounds...\n');
    
    // Find all tournaments that have rounds with games
    const allTournaments = await Tournament.find({
      'rounds.pairings.game': { $exists: true, $ne: null }
    }).populate('rounds.pairings.game');
    
    console.log(`Found ${allTournaments.length} tournaments with games\n`);
    
    let tournamentsRecalculated = 0;
    let totalRoundsRecalculated = 0;
    let totalGamesProcessed = 0;
    
    for (const tournament of allTournaments) {
      // Use tournament's startingPointValue, default to 25000 if not set
      const startingPoint = tournament.startingPointValue || 25000;
      let tournamentModified = false;
      let roundsRecalculated = 0;
      let gamesProcessed = 0;
      
      // Reset all player UMA to 0
      tournament.players.forEach(player => {
        if (player.uma !== 0) {
          player.uma = 0;
          tournamentModified = true;
        }
      });
      
      // Recalculate UMA by going through all completed rounds
      if (tournament.rounds && tournament.rounds.length > 0) {
        for (const round of tournament.rounds) {
          if (!round.pairings || round.pairings.length === 0) {
            continue;
          }
          
          // Check if round is completed: all pairings must have verified games
          const allPairingsHaveGames = round.pairings.every(p => p.game);
          if (!allPairingsHaveGames) {
            continue; // Round not completed yet
          }
          
          // Check if all games are verified
          let allGamesVerified = true;
          for (const pairing of round.pairings) {
            if (pairing.game) {
              let gameVerified = false;
              if (typeof pairing.game === 'object' && pairing.game !== null && 'verified' in pairing.game) {
                gameVerified = pairing.game.verified === true;
              } else {
                const game = await Game.findById(pairing.game);
                gameVerified = game && game.verified === true;
              }
              if (!gameVerified) {
                allGamesVerified = false;
                break;
              }
            }
          }
          
          if (!allGamesVerified) {
            continue; // Round not completed yet (games not all verified)
          }
          
          // Round is completed - recalculate UMA for all games in this round
          roundsRecalculated++;
          
          for (const pairing of round.pairings) {
            if (!pairing.game) continue;
            
            gamesProcessed++;
            // Get game (either populated or fetch it)
            let game = null;
            if (typeof pairing.game === 'object' && pairing.game !== null && 'players' in pairing.game) {
              game = pairing.game;
            } else {
              game = await Game.findById(pairing.game);
            }
            
            if (!game || !game.players) {
              continue;
            }
            
            // Calculate UMA for each player in this game
            for (const gamePlayer of game.players) {
              // Handle both ObjectId and populated player objects
              const playerId = gamePlayer.player._id 
                ? gamePlayer.player._id.toString() 
                : gamePlayer.player.toString();
              
              const tournamentPlayer = tournament.players.find(
                p => {
                  const tournamentPlayerId = p.player._id 
                    ? p.player._id.toString() 
                    : p.player.toString();
                  return tournamentPlayerId === playerId;
                }
              );
              
              if (tournamentPlayer) {
                // Calculate uma: (score - startingPointValue) / 1000
                const umaBase = (gamePlayer.score - startingPoint) / 1000;
                // Rank uma adjustment: 1st = 30, 2nd = 10, 3rd = -10, 4th = -30
                const rankUmaAdjustment = {
                  1: 30,
                  2: 10,
                  3: -10,
                  4: -30
                }[gamePlayer.rank] || 0;
                const uma = umaBase + rankUmaAdjustment;
                
                tournamentPlayer.uma = (tournamentPlayer.uma || 0) + uma;
                tournamentModified = true;
              }
            }
          }
        }
      }
      
      if (tournamentModified) {
        tournament.markModified('players');
        await tournament.save();
        tournamentsRecalculated++;
        totalRoundsRecalculated += roundsRecalculated;
        totalGamesProcessed += gamesProcessed;
        console.log(`  ✓ ${tournament.name}: ${roundsRecalculated} rounds, ${gamesProcessed} games (startingPoint: ${startingPoint})`);
      }
    }
    
    // Display summary
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Tournaments processed: ${allTournaments.length}`);
    console.log(`  Tournaments with UMA recalculated: ${tournamentsRecalculated}`);
    console.log(`  Total completed rounds processed: ${totalRoundsRecalculated}`);
    console.log(`  Total games processed: ${totalGamesProcessed}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateStartingPointValue().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateStartingPointValue };
