const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import User model
const User = require('../src/models/User');

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
const migrateClubAffiliation = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting clubAffiliation migration...\n');
    
    // Find all users that don't have clubAffiliation set or have it set to null/undefined
    const usersToUpdate = await User.find({
      $or: [
        { clubAffiliation: { $exists: false } },
        { clubAffiliation: null },
        { clubAffiliation: undefined }
      ]
    });
    
    console.log(`Found ${usersToUpdate.length} users to update`);
    
    if (usersToUpdate.length === 0) {
      console.log('✓ No users need updating');
      process.exit(0);
    }
    
    // Update all users to have "Charleston" as their clubAffiliation
    const result = await User.updateMany(
      {
        $or: [
          { clubAffiliation: { $exists: false } },
          { clubAffiliation: null },
          { clubAffiliation: undefined }
        ]
      },
      {
        $set: { clubAffiliation: 'Charleston' }
      }
    );
    
    console.log(`✓ Updated ${result.modifiedCount} users with clubAffiliation: "Charleston"`);
    
    // Verify the migration
    const usersWithoutAffiliation = await User.countDocuments({
      $or: [
        { clubAffiliation: { $exists: false } },
        { clubAffiliation: null },
        { clubAffiliation: undefined }
      ]
    });
    
    if (usersWithoutAffiliation === 0) {
      console.log('✓ Migration verified: All users now have clubAffiliation set');
    } else {
      console.log(`⚠ Warning: ${usersWithoutAffiliation} users still without clubAffiliation`);
    }
    
    // Display summary
    const totalUsers = await User.countDocuments();
    const charlestonUsers = await User.countDocuments({ clubAffiliation: 'Charleston' });
    const charlotteUsers = await User.countDocuments({ clubAffiliation: 'Charlotte' });
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Users: ${totalUsers}`);
    console.log(`  Charleston: ${charlestonUsers}`);
    console.log(`  Charlotte: ${charlotteUsers}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateClubAffiliation().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateClubAffiliation };

