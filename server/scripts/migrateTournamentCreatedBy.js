const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import models
const User = require('../src/models/User');
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
const migrateTournamentCreatedBy = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting tournament createdBy migration...\n');
    
    // Find the first admin user
    const adminUser = await User.findOne({ isAdmin: true });
    
    if (!adminUser) {
      console.error('✗ No admin user found in the database. Cannot proceed with migration.');
      process.exit(1);
    }
    
    console.log(`✓ Found admin user: ${adminUser.displayName} (${adminUser._id})`);
    
    // Find all tournaments that don't have createdBy set
    const tournamentsToUpdate = await Tournament.find({
      $or: [
        { createdBy: { $exists: false } },
        { createdBy: null },
        { createdBy: undefined }
      ]
    });
    
    console.log(`Found ${tournamentsToUpdate.length} tournaments to update`);
    
    if (tournamentsToUpdate.length === 0) {
      console.log('✓ No tournaments need updating');
      process.exit(0);
    }
    
    // Update all tournaments to have createdBy set to the admin user
    const result = await Tournament.updateMany(
      {
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          { createdBy: undefined }
        ]
      },
      {
        $set: { createdBy: adminUser._id }
      }
    );
    
    console.log(`✓ Updated ${result.modifiedCount} tournaments with createdBy: ${adminUser.displayName}`);
    
    // Verify the migration
    const tournamentsWithoutCreatedBy = await Tournament.countDocuments({
      $or: [
        { createdBy: { $exists: false } },
        { createdBy: null },
        { createdBy: undefined }
      ]
    });
    
    if (tournamentsWithoutCreatedBy === 0) {
      console.log('✓ Migration verified: All tournaments now have createdBy set');
    } else {
      console.log(`⚠ Warning: ${tournamentsWithoutCreatedBy} tournaments still without createdBy`);
    }
    
    // Display summary
    const totalTournaments = await Tournament.countDocuments();
    const tournamentsWithCreatedBy = await Tournament.countDocuments({ createdBy: { $exists: true, $ne: null } });
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Tournaments: ${totalTournaments}`);
    console.log(`  With createdBy: ${tournamentsWithCreatedBy}`);
    console.log(`  Assigned to Admin: ${adminUser.displayName}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateTournamentCreatedBy().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateTournamentCreatedBy };
