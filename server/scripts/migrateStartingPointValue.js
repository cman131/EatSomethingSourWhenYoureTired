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
    
    console.log('\n🔄 Starting startingPointValue migration...\n');
    
    // Step 1: Update startingPointValue for tournaments that don't have it set
    const tournamentsToUpdate = await Tournament.find({
      $or: [
        { startingPointValue: { $exists: false } },
        { startingPointValue: null },
        { startingPointValue: undefined },
      ]
    });
    
    console.log(`Found ${tournamentsToUpdate.length} tournaments to update startingPointValue`);
    
    if (tournamentsToUpdate.length > 0) {
      // Display tournaments that will be updated
      console.log('\nTournaments to update:');
      tournamentsToUpdate.forEach((tournament, index) => {
        console.log(`  ${index + 1}. ${tournament.name} (ID: ${tournament._id})`);
      });
      
      // Update all tournaments to have startingPointValue: 25000
      const result = await Tournament.updateMany(
        {
          $or: [
            { startingPointValue: { $exists: false } },
            { startingPointValue: null },
            { startingPointValue: undefined },
          ]
        },
        {
          $set: { startingPointValue: 25000 }
        }
      );
      
      console.log(`\n✓ Updated ${result.modifiedCount} tournaments with startingPointValue: 30000`);
    } else {
      console.log('✓ All tournaments already have startingPointValue set');
    }
    
    // Step 2: Recalculate UMA for all tournaments with ended rounds
    console.log('\n🔄 Recalculating UMA for all tournaments with games...\n');
    
    // Find all tournaments that have rounds with games
    const allTournaments = await Tournament.find({
      'rounds.pairings.game': { $exists: true, $ne: null }
    }).populate('rounds.pairings.game');
    
    console.log(`Found ${allTournaments.length} tournaments with games to recalculate UMA`);
    
    let tournamentsRecalculated = 0;
    let totalPlayersRecalculated = 0;
    
    for (const tournament of allTournaments) {
      const startingPoint = tournament.startingPointValue || 25000;
      let tournamentModified = false;
      let playersRecalculated = 0;
      
      // Reset all player UMA to 0
      tournament.players.forEach(player => {
        if (player.uma !== 0) {
          player.uma = 0;
          tournamentModified = true;
        }
      });
      
      // Recalculate UMA by going through all rounds and their games
      if (tournament.rounds && tournament.rounds.length > 0) {
        for (const round of tournament.rounds) {
          if (round.pairings && round.pairings.length > 0) {
            // Check if round has ended: all pairings must have verified games
            const allPairingsHaveGames = round.pairings.every(p => p.game);
            if (!allPairingsHaveGames) {
              // Round hasn't ended yet, skip it
              continue;
            }
            
            // Check if all games are verified
            let allGamesVerified = true;
            for (const pairing of round.pairings) {
              if (pairing.game) {
                let gameVerified = false;
                if (typeof pairing.game === 'object' && pairing.game !== null && 'verified' in pairing.game) {
                  // Game is populated
                  gameVerified = pairing.game.verified === true;
                } else {
                  // Game is not populated, need to fetch it
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
              // Round hasn't ended yet (games not all verified), skip it
              continue;
            }
            
            // Round has ended, recalculate UMA for all games in this round
            for (const pairing of round.pairings) {
              // Check if pairing has a populated game
              if (pairing.game && pairing.game.players) {
                const game = pairing.game;
                
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
                    playersRecalculated++;
                  }
                }
              } else if (pairing.game) {
                // Game exists but not populated, need to fetch it
                const game = await Game.findById(pairing.game);
                if (game && game.players) {
                  for (const gamePlayer of game.players) {
                    const playerId = gamePlayer.player.toString();
                    const tournamentPlayer = tournament.players.find(
                      p => p.player.toString() === playerId
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
                      playersRecalculated++;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      if (tournamentModified) {
        tournament.markModified('players');
        await tournament.save();
        tournamentsRecalculated++;
        totalPlayersRecalculated += playersRecalculated;
        console.log(`  ✓ Recalculated UMA for ${tournament.name} (${playersRecalculated} players)`);
      }
    }
    
    // Verify the migration
    const tournamentsWithoutStartingPoint = await Tournament.countDocuments({
      $or: [
        { startingPointValue: { $exists: false } },
        { startingPointValue: null },
        { startingPointValue: undefined },
      ]
    });
    
    if (tournamentsWithoutStartingPoint === 0) {
      console.log('\n✓ Migration verified: All tournaments now have startingPointValue set');
    } else {
      console.log(`\n⚠ Warning: ${tournamentsWithoutStartingPoint} tournaments still without startingPointValue`);
    }
    
    // Display summary
    const totalTournaments = await Tournament.countDocuments();
    const tournamentsWith25000 = await Tournament.countDocuments({ startingPointValue: 25000 });
    const tournamentsWith30000 = await Tournament.countDocuments({ startingPointValue: 30000 });
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Tournaments: ${totalTournaments}`);
    console.log(`  With startingPointValue 25000: ${tournamentsWith25000}`);
    console.log(`  With startingPointValue 30000: ${tournamentsWith30000}`);
    console.log(`  Tournaments with startingPointValue updated: ${tournamentsToUpdate.length}`);
    console.log(`  Tournaments with UMA recalculated: ${tournamentsRecalculated}`);
    console.log(`  Total players recalculated: ${totalPlayersRecalculated}`);
    console.log(`  Default Value: 25000`);
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
