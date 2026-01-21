const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import models
const Tournament = require('../src/models/Tournament');

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
const migrateRoundDurationMinutes = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting roundDurationMinutes migration...\n');
    
    // Find all in-person tournaments that don't have roundDurationMinutes set
    // Include tournaments where isOnline is false or not defined
    const tournamentsToUpdate = await Tournament.find({
      $and: [
        {
          $or: [
            { isOnline: false },
            { isOnline: null },
            { isOnline: undefined },
            { isOnline: { $exists: false } }
          ]
        },
        {
          $or: [
            { roundDurationMinutes: { $exists: false } },
            { roundDurationMinutes: null },
            { roundDurationMinutes: undefined }
          ]
        }
      ]
    });
    
    console.log(`Found ${tournamentsToUpdate.length} in-person tournaments to update`);
    
    if (tournamentsToUpdate.length === 0) {
      console.log('✓ No tournaments need updating');
      process.exit(0);
    }
    
    // Display tournaments that will be updated
    console.log('\nTournaments to update:');
    tournamentsToUpdate.forEach((tournament, index) => {
      console.log(`  ${index + 1}. ${tournament.name} (ID: ${tournament._id})`);
    });
    
    // Update all in-person tournaments to have roundDurationMinutes: 90
    // Include tournaments where isOnline is false or not defined
    const result = await Tournament.updateMany(
      {
        $and: [
          {
            $or: [
              { isOnline: false },
              { isOnline: null },
              { isOnline: undefined },
              { isOnline: { $exists: false } }
            ]
          },
          {
            $or: [
              { roundDurationMinutes: { $exists: false } },
              { roundDurationMinutes: null },
              { roundDurationMinutes: undefined }
            ]
          }
        ]
      },
      {
        $set: { isOnline: false, roundDurationMinutes: 90 }
      }
    );
    
    console.log(`\n✓ Updated ${result.modifiedCount} tournaments with roundDurationMinutes: 90`);
    
    // Verify the migration
    const tournamentsWithoutRoundDuration = await Tournament.countDocuments({
      $and: [
        {
          $or: [
            { isOnline: false },
            { isOnline: null },
            { isOnline: undefined },
            { isOnline: { $exists: false } }
          ]
        },
        {
          $or: [
            { roundDurationMinutes: { $exists: false } },
            { roundDurationMinutes: null },
            { roundDurationMinutes: undefined }
          ]
        }
      ]
    });
    
    if (tournamentsWithoutRoundDuration === 0) {
      console.log('✓ Migration verified: All in-person tournaments now have roundDurationMinutes set');
    } else {
      console.log(`⚠ Warning: ${tournamentsWithoutRoundDuration} in-person tournaments still without roundDurationMinutes`);
    }
    
    // Display summary
    const totalInPersonTournaments = await Tournament.countDocuments({
      $or: [
        { isOnline: false },
        { isOnline: { $exists: false } }
      ]
    });
    const inPersonTournamentsWithRoundDuration = await Tournament.countDocuments({
      $and: [
        {
          $or: [
            { isOnline: false },
            { isOnline: { $exists: false } }
          ]
        },
        {
          roundDurationMinutes: { $exists: true, $ne: null }
        }
      ]
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total In-Person Tournaments: ${totalInPersonTournaments}`);
    console.log(`  With roundDurationMinutes: ${inPersonTournamentsWithRoundDuration}`);
    console.log(`  Updated: ${result.modifiedCount}`);
    console.log(`  Default Duration: 90 minutes`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateRoundDurationMinutes().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateRoundDurationMinutes };
