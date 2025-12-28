const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import models
const User = require('../src/models/User');
const Game = require('../src/models/Game');

// Sample user data
const sampleUsers = [
  {
    email: 'alice@mahjong.com',
    username: 'alice_mahjong',
    password: 'password123',
    avatar: ''
  },
  {
    email: 'bob@mahjong.com',
    username: 'bob_tiles',
    password: 'password123',
    avatar: ''
  },
  {
    email: 'charlie@mahjong.com',
    username: 'charlie_dragon',
    password: 'password123',
    avatar: ''
  },
  {
    email: 'diana@mahjong.com',
    username: 'diana_wind',
    password: 'password123',
    avatar: ''
  },
  {
    email: 'eve@mahjong.com',
    username: 'eve_bamboo',
    password: 'password123',
    avatar: ''
  },
  {
    email: 'frank@mahjong.com',
    username: 'frank_circle',
    password: 'password123',
    avatar: ''
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

// Generate random score between min and max (rounded to nearest multiple of 100)
const randomScore = (min, max) => {
  const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
  return Math.round(randomValue / 100) * 100;
};

// Create sample games
const createSampleGames = async (users) => {
  const games = [];
  const now = new Date();
  
  // Create games from the past 30 days
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const gameDate = new Date(now);
    gameDate.setDate(gameDate.getDate() - daysAgo);
    gameDate.setHours(Math.floor(Math.random() * 12) + 10); // Random time between 10 AM and 10 PM
    
    // Randomly select 4 unique users
    const shuffled = [...users].sort(() => 0.5 - Math.random());
    const selectedPlayers = shuffled.slice(0, 4);
    
    // Generate scores that sum to 100000 (all multiples of 100)
    // Generate 3 scores in reasonable ranges, then calculate 4th to sum to 100000
    const TARGET_TOTAL = 100000;
    let baseScores = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 100;
    
    // Keep trying until we get valid scores
    while (attempts < MAX_ATTEMPTS) {
      // Generate 3 scores in typical mahjong ranges (as multiples of 100)
      const score1 = randomScore(25000, 40000); // Winner range
      const score2 = randomScore(15000, 30000); // Second place range
      const score3 = randomScore(5000, 20000);  // Third place range
      
      // Calculate 4th score to make total 100000
      const score4 = TARGET_TOTAL - (score1 + score2 + score3);
      
      // Ensure 4th score is reasonable (between 0 and 30000, and multiple of 100)
      if (score4 >= 0 && score4 <= 30000 && score4 % 100 === 0) {
        baseScores = [score1, score2, score3, score4];
        break;
      }
      attempts++;
    }
    
    // Fallback: if we couldn't generate valid scores, use a balanced distribution
    if (baseScores.length === 0) {
      baseScores = [30000, 25000, 20000, 25000]; // Sums to 100000
    }
    
    // Create player-score pairs and sort by score descending
    const playerScorePairs = selectedPlayers.map((user, index) => ({
      player: user._id,
      score: baseScores[index]
    }));
    
    // Sort by score descending and assign positions 1-4
    playerScorePairs.sort((a, b) => b.score - a.score);
    const players = playerScorePairs.map((pair, index) => ({
      player: pair.player,
      score: pair.score,
      position: index + 1
    }));
    
    // Randomly select a submitter
    const submittedBy = selectedPlayers[Math.floor(Math.random() * selectedPlayers.length)]._id;
    
    // Some games are verified (randomly ~70%)
    const verified = Math.random() > 0.3;
    const verifiedBy = verified ? users[Math.floor(Math.random() * users.length)]._id : null;
    const verifiedAt = verified ? new Date(gameDate.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null;
    
    // Add notes to some games
    const notesOptions = [
      '',
      '',
      '',
      'Great game!',
      'Close match!',
      'Lucky draw!',
      'First win of the day!',
      'Amazing comeback!'
    ];
    const notes = notesOptions[Math.floor(Math.random() * notesOptions.length)];
    
    games.push({
      submittedBy,
      players,
      gameDate,
      notes,
      verified,
      verifiedBy,
      verifiedAt
    });
  }
  
  return games;
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Check if we should clear existing data
    const clearData = process.argv.includes('--clear') || process.argv.includes('-c');
    
    if (clearData) {
      console.log('\n⚠ Clearing existing data...');
      await User.deleteMany({});
      await Game.deleteMany({});
      console.log('✓ Existing data cleared\n');
    }
    
    // Create users
    console.log('Creating sample users...');
    const createdUsers = [];
    
    for (const userData of sampleUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }]
      });
      
      if (existingUser) {
        console.log(`  - User ${userData.username} already exists, skipping...`);
        createdUsers.push(existingUser);
      } else {
        // Hash password before creating user
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        const user = await User.create({
          ...userData,
          password: hashedPassword
        });
        console.log(`  ✓ Created user: ${user.username} (${user.email})`);
        createdUsers.push(user);
      }
    }
    
    console.log(`\n✓ Created/found ${createdUsers.length} users\n`);
    
    // Create games (need at least 4 users)
    if (createdUsers.length < 4) {
      console.log('⚠ Need at least 4 users to create games. Skipping game creation.');
    } else {
      console.log('Creating sample games...');
      const gamesData = await createSampleGames(createdUsers);
      
      // Insert games in batches to avoid validation issues
      let gamesCreated = 0;
      for (const gameData of gamesData) {
        try {
          await Game.create(gameData);
          gamesCreated++;
        } catch (error) {
          console.log(`  ⚠ Failed to create game: ${error.message}`);
        }
      }
      
      console.log(`✓ Created ${gamesCreated} games\n`);
    }
    
    // Display summary
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    
    console.log('═══════════════════════════════════════');
    console.log('  Database Seeding Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Users: ${totalUsers}`);
    console.log(`  Total Games: ${totalGames}`);
    console.log('═══════════════════════════════════════\n');
    
    console.log('Sample login credentials:');
    console.log('  Email: alice@mahjong.com');
    console.log('  Password: password123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeding script
if (require.main === module) {
  seedDatabase().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { seedDatabase };

