const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import model
const User = require('../src/models/User');

// Guest user data to seed
const guestUsersToSeed = [
  {
    displayName: 'Guest Player',
    isGuest: true
  },
  {
    displayName: 'Guest Player 2',
    isGuest: true
  },
  {
    displayName: 'Filler 1',
    isGuest: true
  },
  {
    displayName: 'Filler 2',
    isGuest: true
  },
  {
    displayName: 'Filler 3',
    isGuest: true
  }
];

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

// Main seeding function
const seedGuestPlayers = async () => {
  try {
    await connectDB();
    
    // Check if we should clear existing data
    const clearData = process.argv.includes('--clear') || process.argv.includes('-c');
    
    if (clearData) {
      console.log('\n⚠ Clearing existing guest users...');
      await User.deleteMany({ isGuest: true });
      console.log('✓ Existing guest users cleared\n');
    }
    
    // Create guest users
    console.log('Creating guest users...');
    const createdGuestUsers = [];
    
    for (const guestUserData of guestUsersToSeed) {
      // Check if guest user already exists
      const existingGuestUser = await User.findOne({
        displayName: guestUserData.displayName,
        isGuest: true
      });
      
      if (existingGuestUser) {
        console.log(`  - Guest user "${guestUserData.displayName}" already exists, skipping...`);
        createdGuestUsers.push(existingGuestUser);
      } else {
        // Create guest user with unique dummy email
        // Use a unique email pattern to satisfy the unique constraint
        const guestUser = new User({
          displayName: guestUserData.displayName,
          isGuest: true,
          email: `guest.${guestUserData.displayName.toLowerCase().replace(/\s+/g, '.')}@guest.local`
        });
        await guestUser.save();
        console.log(`  ✓ Created guest user: ${guestUser.displayName}`);
        createdGuestUsers.push(guestUser);
      }
    }
    
    console.log(`\n✓ Created/found ${createdGuestUsers.length} guest users\n`);
    
    // Display summary
    const totalGuestUsers = await User.countDocuments({ isGuest: true });
    
    console.log('═══════════════════════════════════════');
    console.log('  Guest Users Seeding Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Guest Users: ${totalGuestUsers}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding guest users:', error);
    process.exit(1);
  }
};

// Run the seeding script
if (require.main === module) {
  seedGuestPlayers().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { seedGuestPlayers };

// Also export as seedGuestUsers for consistency
module.exports.seedGuestUsers = seedGuestPlayers;
