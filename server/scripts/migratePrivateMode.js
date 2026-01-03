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
const migratePrivateMode = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 Starting privateMode migration...\n');
    
    // Find all users that don't have privateMode set or have it set to null/undefined
    const usersToUpdate = await User.find({
      $or: [
        { privateMode: { $exists: false } },
        { privateMode: null },
        { privateMode: undefined }
      ]
    });
    
    console.log(`Found ${usersToUpdate.length} users to update`);
    
    if (usersToUpdate.length === 0) {
      console.log('✓ No users need updating');
      process.exit(0);
    }
    
    // Update all users to have privateMode: false
    const result = await User.updateMany(
      {
        $or: [
          { privateMode: { $exists: false } },
          { privateMode: null },
          { privateMode: undefined }
        ]
      },
      {
        $set: { privateMode: false }
      }
    );
    
    console.log(`✓ Updated ${result.modifiedCount} users with privateMode: false`);
    
    // Verify the migration
    const usersWithoutPrivateMode = await User.countDocuments({
      $or: [
        { privateMode: { $exists: false } },
        { privateMode: null },
        { privateMode: undefined }
      ]
    });
    
    if (usersWithoutPrivateMode === 0) {
      console.log('✓ Migration verified: All users now have privateMode set');
    } else {
      console.log(`⚠ Warning: ${usersWithoutPrivateMode} users still without privateMode`);
    }
    
    // Display summary
    const totalUsers = await User.countDocuments();
    const privateModeFalse = await User.countDocuments({ privateMode: false });
    const privateModeTrue = await User.countDocuments({ privateMode: true });
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Users: ${totalUsers}`);
    console.log(`  Private Mode: false: ${privateModeFalse}`);
    console.log(`  Private Mode: true: ${privateModeTrue}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration script
if (require.main === module) {
  migratePrivateMode().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { migratePrivateMode };

