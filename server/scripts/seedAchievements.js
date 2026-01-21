const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import Achievement model
const Achievement = require('../src/models/Achievement');

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

// Initial achievements for mahjong club
const achievements = [
  // First Steps
  {
    name: 'First Game',
    description: 'Played your first game of mahjong',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '🎮'
  },
  {
    name: 'Getting Started',
    description: 'Completed your first 5 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '🌱'
  },
  {
    name: 'Regular Player',
    description: 'Played 25 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 25
    }],
    icon: '🎯'
  },
  {
    name: 'Dedicated Player',
    description: 'Played 50 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 50
    }],
    icon: '🏆'
  },
  {
    name: 'Mahjong Enthusiast',
    description: 'Played 100 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 100
    }],
    icon: '🔥'
  },
  {
    name: 'Veteran Player',
    description: 'Played 250 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 250
    }],
    icon: '⭐'
  },
  {
    name: 'Master Player',
    description: 'Played 500 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 500
    }],
    icon: '👑'
  },
  {
    name: 'Legend',
    description: 'Played 1000 games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 1000
    }],
    icon: '💎'
  },
  {
    name: 'Grand Gamer',
    description: 'Played the most games',
    category: 'GamesPlayed',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 8,
      isGrand: true
    }],
    icon: '🎮'
  },

  // Victory Achievements
  {
    name: 'First Victory',
    description: 'Won your first game',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '🎉'
  },
  {
    name: 'Winner',
    description: 'Won 10 games',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '🥇'
  },
  {
    name: 'Elite',
    description: 'Won 25 games',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 25
    }],
    icon: '🏅'
  },
  {
    name: 'Dominator',
    description: 'Won 50 games',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 50
    }],
    icon: '⚔️'
  },
  {
    name: 'Unstoppable',
    description: 'Won 100 games',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 100
    }],
    icon: '💪'
  },
  {
    name: 'Grand Winner',
    description: 'Won the most games',
    category: 'Victories',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 6,
      isGrand: true
    }],
    icon: '🏆'
  },

  // Win Streaks
  {
    name: 'Hot Streak',
    description: 'Won 3 games in a row',
    category: 'WinStreaks',
    requirements: [{
      type: 'WinStreak',
      comparisonType: '>=',
      requirementsValue: 3
    }],
    icon: '🔥'
  },
  {
    name: 'On Fire',
    description: 'Won 5 games in a row',
    category: 'WinStreaks',
    requirements: [{
      type: 'WinStreak',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '🌋'
  },
  {
    name: 'Unbeatable',
    description: 'Won 10 games in a row',
    category: 'WinStreaks',
    requirements: [{
      type: 'WinStreak',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '⚡'
  },
  {
    name: 'Grand Streaker',
    description: 'Won the most games in a row',
    category: 'WinStreaks',
    requirements: [{
      type: 'WinStreak',
      comparisonType: '>=',
      requirementsValue: 3,
      isGrand: true
    }],
    icon: '📈'
  },

  // High Scores
  {
    name: 'High Roller',
    description: 'Scored 40,000 points in a single game',
    category: 'Scores',
    requirements: [{
      type: 'ScoredPoints',
      comparisonType: '>=',
      requirementsValue: 40000
    }],
    icon: '💰'
  },
  {
    name: 'Point Master',
    description: 'Scored 50,000 points in a single game',
    category: 'Scores',
    requirements: [{
      type: 'ScoredPoints',
      comparisonType: '>=',
      requirementsValue: 50000
    }],
    icon: '💵'
  },
  {
    name: 'Perfect Game',
    description: 'Scored 60,000+ points in a single game',
    category: 'Scores',
    requirements: [{
      type: 'ScoredPoints',
      comparisonType: '>=',
      requirementsValue: 60000
    }],
    icon: '✨'
  },
  {
    name: 'Maximum Score',
    description: 'Achieved the maximum possible score',
    category: 'Scores',
    requirements: [{
      type: 'ScoredPoints',
      comparisonType: '>=',
      requirementsValue: 80000
    }],
    icon: '🌟'
  },
  {
    name: 'Grand Scorer',
    description: 'Scored the most points in a single game',
    category: 'Scores',
    requirements: [{
      type: 'ScoredPoints',
      comparisonType: '>=',
      requirementsValue: 30000,
      isGrand: true
    }],
    icon: '💯'
  },

  // Low Scores (for fun)
  {
    name: 'Close Call',
    description: 'Won a game with less than 30,000 points',
    category: 'Scores',
    requirements: [{
      type: 'WonGames',
      comparisonType: '>=',
      requirementsValue: 1
    }, {
      type: 'ScoredPoints',
      comparisonType: '<',
      requirementsValue: 30000
    }],
    icon: '😅'
  },

  // Position Achievements
  {
    name: 'Top Performer',
    description: 'Finished in 1st or 2nd place 20 times',
    category: 'Positions',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 20
    }, {
      type: 'Position',
      comparisonType: '<=',
      requirementsValue: 2
    }],
    icon: '🥇'
  },
  {
    name: 'Consistent',
    description: 'Finished in 1st or 2nd place 50 times',
    category: 'Positions',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 50
    }, {
      type: 'Position',
      comparisonType: '<=',
      requirementsValue: 2
    }],
    icon: '📊'
  },
  {
    name: 'Never Last',
    description: 'Avoided last place for 20 consecutive games',
    category: 'Positions',
    requirements: [{
      type: 'ConsecutivePlayedGames',
      comparisonType: '>=',
      requirementsValue: 20
    }, {
      type: 'Position',
      comparisonType: '<=',
      requirementsValue: 3
    }],
    icon: '🛡️'
  },
  {
    name: 'Grand Wall',
    description: 'Avoided last place for the most consecutive games',
    category: 'Positions',
    requirements: [{
      type: 'ConsecutivePlayedGames',
      comparisonType: '>=',
      requirementsValue: 3,
      isGrand: true
    }, {
      type: 'Position',
      comparisonType: '<=',
      requirementsValue: 3
    }],
    icon: '🧱'
  },
  {
    name: 'Grand Caboose',
    description: 'Finished last place the most times',
    category: 'Positions',
    requirements: [{
      type: 'PlayedGames',
      comparisonType: '>=',
      requirementsValue: 8
    }, {
      type: 'Position',
      comparisonType: '=',
      requirementsValue: 4,
      isGrand: true
    }],
    icon: '🚃'
  },

  // Quiz Achievements
  {
    name: 'Quiz Novice',
    description: 'Completed 10 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '📝'
  },
  {
    name: 'Quiz Master',
    description: 'Completed 50 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 50
    }],
    icon: '📚'
  },
  {
    name: 'Quiz Legend',
    description: 'Completed 100 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 100
    }],
    icon: '🏆'
  },
  {
    name: 'Quiz Wizard',
    description: 'Completed 200 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 200
    }],
    icon: '🧙‍♂️'
  },
  {
    name: 'Quiz Guru',
    description: 'Completed 500 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 500
    }],
    icon: '🧠'
  },
  {
    name: 'Quiz Genius',
    description: 'Completed 1000 discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 1000
    }],
    icon: '🤯'
  },
  {
    name: 'Grand Quizzler',
    description: 'Completed the most discard quizzes',
    category: 'Quizzes',
    requirements: [{
      type: 'CompletedQuizzes',
      comparisonType: '>=',
      requirementsValue: 8,
      isGrand: true
    }],
    icon: '🤓'
  },

  // Social Achievements
  {
    name: 'Team Player',
    description: 'Played games with 10 different players',
    category: 'Social',
    requirements: [{
      type: 'PlayersPlayedWith',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '👥'
  },
  {
    name: 'Social Butterfly',
    description: 'Played games with 25 different players',
    category: 'Social',
    requirements: [{
      type: 'PlayersPlayedWith',
      comparisonType: '>=',
      requirementsValue: 25
    }],
    icon: '🦋'
  },
  {
    name: 'Game Submitter',
    description: 'Submitted 25 games',
    category: 'Submissions',
    requirements: [{
      type: 'SubmittedGames',
      comparisonType: '>=',
      requirementsValue: 25
    }],
    icon: '📤'
  },
  {
    name: 'Grand Archivist',
    description: 'Submitted the most games',
    category: 'Submissions',
    requirements: [{
      type: 'SubmittedGames',
      comparisonType: '>=',
      requirementsValue: 0,
      isGrand: true
    }],
    icon: '🏛️'
  },
  {
    name: 'Verifier',
    description: 'Verified 10 games',
    category: 'Verifications',
    requirements: [{
      type: 'VerifiedGames',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '✅'
  },
  {
    name: 'Trusted Verifier',
    description: 'Verified 50 games',
    category: 'Verifications',
    requirements: [{
      type: 'VerifiedGames',
      comparisonType: '>=',
      requirementsValue: 50
    }],
    icon: '🔒'
  },
  {
    name: 'Grand Magistrate',
    description: 'Verified the most games',
    category: 'Verifications',
    requirements: [{
      type: 'VerifiedGames',
      comparisonType: '>=',
      requirementsValue: 0,
      isGrand: true
    }],
    icon: '🧑‍⚖️'
  },

  // Time-Based Achievements
  {
    name: 'Early Bird',
    description: 'Played a game before 9 AM',
    category: 'TimeBased',
    requirements: [{
      type: 'TimePlayedAt',
      comparisonType: '<',
      requirementsValue: 9
    }],
    icon: '🌅'
  },
  {
    name: 'Night Owl',
    description: 'Played a game after 11 PM',
    category: 'TimeBased',
    requirements: [{
      type: 'TimePlayedAt',
      comparisonType: '>=',
      requirementsValue: 23
    }],
    icon: '🦉'
  },
  {
    name: 'Daily Player',
    description: 'Played games on 7 consecutive days',
    category: 'Consistency',
    requirements: [{
      type: 'ConsecutivePlayedDays',
      comparisonType: '>=',
      requirementsValue: 7
    }],
    icon: '📅'
  },
  {
    name: 'Week Warrior',
    description: 'Played games on 30 consecutive days',
    category: 'Consistency',
    requirements: [{
      type: 'ConsecutivePlayedDays',
      comparisonType: '>=',
      requirementsValue: 30
    }],
    icon: '🗓️'
  },
  {
    name: 'Grand Mahjonger',
    description: 'Played the most days consecutively',
    category: 'Consistency',
    requirements: [{
      type: 'ConsecutivePlayedDays',
      comparisonType: '>=',
      requirementsValue: 3,
      isGrand: true
    }],
    icon: '🗓️'
  },

  // Milestone Achievements
  {
    name: 'Century Club',
    description: 'Reached 100,000 total points across all games',
    category: 'AccumulatedScores',
    requirements: [{
      type: 'AccumulatedPoints',
      comparisonType: '>=',
      requirementsValue: 100000
    }],
    icon: '💯'
  },
  {
    name: 'Millionaire',
    description: 'Reached 1,000,000 total points',
    category: 'AccumulatedScores',
    requirements: [{
      type: 'AccumulatedPoints',
      comparisonType: '>=',
      requirementsValue: 1000000
    }],
    icon: '💎'
  },
  {
    name: 'Grand Wealth Horder',
    description: 'Accumulated the most points across all games',
    category: 'AccumulatedScores',
    requirements: [{
      type: 'AccumulatedPoints',
      comparisonType: '>=',
      requirementsValue: 100000,
      isGrand: true
    }],
    icon: '💰'
  },

  // Special Achievements
  {
    name: 'Marathon Session',
    description: 'Played 5 games in a single day',
    category: 'TimeBased',
    requirements: [{
      type: 'GamesInADay',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '🏃'
  },
  {
    name: 'Speed Demon',
    description: 'Played 10 games in a single day',
    category: 'TimeBased',
    requirements: [{
      type: 'GamesInADay',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '🚀'
  },
  {
    name: 'Grand Marathoner',
    description: 'Played the most games in a single day',
    category: 'TimeBased',
    requirements: [{
      type: 'GamesInADay',
      comparisonType: '>=',
      requirementsValue: 4,
      isGrand: true
    }],
    icon: '🏃‍♂️'
  },

  // Tournament Achievements
  {
    name: 'First Tournament',
    description: 'Participated in your first tournament',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsPlayed',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '🎪'
  },
  {
    name: 'Tournament Regular',
    description: 'Participated in 5 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsPlayed',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '🏟️'
  },
  {
    name: 'Tournament Veteran',
    description: 'Participated in 10 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsPlayed',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '🎯'
  },
  {
    name: 'Tournament Master',
    description: 'Participated in 25 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsPlayed',
      comparisonType: '>=',
      requirementsValue: 25
    }],
    icon: '👑'
  },
  {
    name: 'Grand Competitor',
    description: 'Participated in the most tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsPlayed',
      comparisonType: '>=',
      requirementsValue: 1,
      isGrand: true
    }],
    icon: '🏅'
  },
  {
    name: 'Champion',
    description: 'Won your first tournament',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsWon',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '🥇'
  },
  {
    name: 'Multi-Champion',
    description: 'Won 3 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsWon',
      comparisonType: '>=',
      requirementsValue: 3
    }],
    icon: '🏆'
  },
  {
    name: 'Elite Champion',
    description: 'Won 5 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsWon',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '💎'
  },
  {
    name: 'Legendary Champion',
    description: 'Won 10 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsWon',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '🌟'
  },
  {
    name: 'Grand Champion',
    description: 'Won the most tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsWon',
      comparisonType: '>=',
      requirementsValue: 1,
      isGrand: true
    }],
    icon: '👑'
  },
  {
    name: 'Top Finisher',
    description: 'Finished in the top 4 of a tournament',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentTop4',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '🎖️'
  },
  {
    name: 'Consistent Performer',
    description: 'Finished in the top 4 of 5 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentTop4',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '⭐'
  },
  {
    name: 'Elite Performer',
    description: 'Finished in the top 4 of 10 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentTop4',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '💫'
  },
  {
    name: 'Grand Finalist',
    description: 'Finished in the top 4 the most times',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentTop4',
      comparisonType: '>=',
      requirementsValue: 1,
      isGrand: true
    }],
    icon: '🏅'
  },
  {
    name: 'Tournament Organizer',
    description: 'Created your first tournament',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsCreated',
      comparisonType: '>=',
      requirementsValue: 1
    }],
    icon: '📋'
  },
  {
    name: 'Event Coordinator',
    description: 'Created 5 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsCreated',
      comparisonType: '>=',
      requirementsValue: 5
    }],
    icon: '📅'
  },
  {
    name: 'Tournament Director',
    description: 'Created 10 tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsCreated',
      comparisonType: '>=',
      requirementsValue: 10
    }],
    icon: '🎬'
  },
  {
    name: 'Grand Organizer',
    description: 'Created the most tournaments',
    category: 'Tournaments',
    requirements: [{
      type: 'TournamentsCreated',
      comparisonType: '>=',
      requirementsValue: 1,
      isGrand: true
    }],
    icon: '🎪'
  }
];

// Main seeding function
const seedAchievements = async () => {
  try {
    await connectDB();
    
    // Always clear existing achievements
    console.log('\n⚠ Clearing existing achievements...');
    const deletedCount = await Achievement.deleteMany({});
    console.log(`✓ Deleted ${deletedCount.deletedCount} existing achievements\n`);
    
    // Create all achievements fresh
    console.log('Creating achievements...');
    let achievementsCreated = 0;
    let achievementsFailed = 0;
    
    for (const achievementData of achievements) {
      try {
        await Achievement.create(achievementData);
        console.log(`  ✓ Created achievement: ${achievementData.icon} ${achievementData.name}`);
        achievementsCreated++;
      } catch (error) {
        console.log(`  ⚠ Failed to create achievement "${achievementData.name}": ${error.message}`);
        achievementsFailed++;
      }
    }
    
    // Display summary
    const totalAchievements = await Achievement.countDocuments();
    
    console.log(`\n✓ Created ${achievementsCreated} achievements`);
    if (achievementsFailed > 0) {
      console.log(`  ⚠ Failed to create ${achievementsFailed} achievements`);
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Achievement Seeding Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Achievements: ${totalAchievements}`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding achievements:', error);
    process.exit(1);
  }
};

// Run the seeding script
if (require.main === module) {
  seedAchievements().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { seedAchievements };

