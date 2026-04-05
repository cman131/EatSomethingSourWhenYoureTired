const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../src/models/User');

const HASHED_PASSWORD = '$2a$12$nq.41Tb8hfwaDNWGimn70uRh.x672NEckoYrbb7IUS/RQilwM8Q5q';

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mahjong-club';
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✓ MongoDB connected');
};

const generateUsers = async () => {
  const count = parseInt(process.argv[2]);
  if (!count || isNaN(count) || count < 1) {
    console.error('Usage: node generateUsers.js <count>');
    console.error('Example: node generateUsers.js 12');
    process.exit(1);
  }

  await connectDB();

  // Use a timestamp-based suffix to ensure uniqueness across runs
  const base = Date.now();
  const docs = [];

  for (let i = 0; i < count; i++) {
    const uid = base + i;
    docs.push({
      displayName: `Player${uid}`,
      email: `player${uid}@test.local`,
      password: HASHED_PASSWORD,
      clubAffiliation: 'Charleston',
      notificationPreferences: {
        emailNotificationsEnabled: false,
        emailNotificationsForComments: false,
        emailNotificationsForNewGames: false,
        emailNotificationsForNewTournaments: false,
        emailNotificationsForRoundPairings: false,
      },
    });
  }

  // insertMany does not trigger pre-save hooks, so the password won't be re-hashed
  await User.insertMany(docs, { ordered: true });

  console.log(`\n✓ Created ${count} users:\n`);
  docs.forEach(u => console.log(`  ${u.displayName}  (${u.email})`));
  console.log();
};

generateUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('✗ Error:', err.message);
    process.exit(1);
  });
