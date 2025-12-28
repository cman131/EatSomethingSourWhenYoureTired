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
const migrateUsernameToDisplayName = async () => {
  try {
    await connectDB();
    
    console.log('\nStarting migration: username -> displayName\n');
    
    // Find all users that have username field but no displayName (or displayName is empty)
    // Note: This handles the case where users might have been created with username
    const users = await User.find({});
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        // Check if user has username field (from old schema) but no displayName
        // Since displayName is required in the new schema, we'll check if it exists
        // If the user object has a username property (from old data), copy it to displayName
        const userObj = user.toObject();
        
        // If displayName doesn't exist or is empty, and username exists, migrate it
        if ((!user.displayName || user.displayName === '') && userObj.username) {
          user.displayName = userObj.username;
          await user.save();
          console.log(`  ✓ Migrated user: ${userObj.username} -> ${user.displayName}`);
          migrated++;
        } else if (user.displayName) {
          // User already has displayName, skip
          skipped++;
        } else {
          // User has neither - this shouldn't happen with required field, but handle it
          console.log(`  ⚠ User ${user._id} has no displayName or username, skipping...`);
          skipped++;
        }
      } catch (error) {
        console.error(`  ✗ Error migrating user ${user._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Migrated: ${migrated} users`);
    console.log(`  Skipped: ${skipped} users`);
    console.log(`  Errors: ${errors} users`);
    console.log('═══════════════════════════════════════\n');
    
    // Drop the old username index if it exists (it should be displayName now)
    try {
      await User.collection.dropIndex('username_1');
      console.log('✓ Dropped old username index');
    } catch (error) {
      // Index might not exist, which is fine
      if (error.code !== 27) { // 27 is index not found
        console.log('  ⚠ Could not drop username index (may not exist)');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration
if (require.main === module) {
  migrateUsernameToDisplayName().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migrateUsernameToDisplayName };

