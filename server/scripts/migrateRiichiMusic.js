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
const migrateRiichiMusic = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting riichiMusic migration...\n');
    
    // Find all users that have riichiMusic as a string (old format)
    // We'll check for users where riichiMusic exists and is not an object
    const allUsers = await User.find({ riichiMusic: { $exists: true, $ne: null } });
    
    console.log(`Found ${allUsers.length} users with riichiMusic set`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of allUsers) {
      try {
        // Check if already in new format (object with url and type)
        if (user.riichiMusic && typeof user.riichiMusic === 'object' && user.riichiMusic.url !== undefined) {
          skippedCount++;
          continue;
        }
        
        // Get the old string value
        const oldValue = user.riichiMusic;
        
        // If it's null, empty, or not a string, unset the field
        if (!oldValue || typeof oldValue !== 'string' || oldValue.trim() === '') {
          user.riichiMusic = undefined;
          user.markModified('riichiMusic');
          await user.save();
          migratedCount++;
          continue;
        }
        
        // Assume all existing URLs are Spotify
        user.riichiMusic = {
          url: oldValue.trim(),
          type: 'spotify'
        };
        
        await user.save();
        migratedCount++;
        console.log(`✓ Migrated user ${user.displayName}: ${oldValue} -> ${JSON.stringify(user.riichiMusic)}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating user ${user.displayName} (${user._id}):`, error.message);
      }
    }
    
    // Also handle users with null riichiMusic to ensure it's properly set
    const usersWithNull = await User.find({ 
      $or: [
        { riichiMusic: null },
        { 'riichiMusic.url': { $exists: false } }
      ]
    });
    
    for (const user of usersWithNull) {
      if (user.riichiMusic === null || (typeof user.riichiMusic === 'object' && !user.riichiMusic.url)) {
        user.riichiMusic = undefined;
        user.markModified('riichiMusic');
        await user.save();
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total users with riichiMusic: ${allUsers.length}`);
    console.log(`  Migrated: ${migratedCount}`);
    console.log(`  Skipped (already migrated): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('═══════════════════════════════════════\n');
    
    // Verify the migration
    const usersWithOldFormat = await User.find({
      riichiMusic: { $exists: true, $ne: null, $type: 'string' }
    });
    
    if (usersWithOldFormat.length === 0) {
      console.log('✓ Migration verified: All riichiMusic fields are in new format or null');
    } else {
      console.log(`⚠ Warning: ${usersWithOldFormat.length} users still have old string format`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migrateRiichiMusic().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateRiichiMusic };
