const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import Tile model
const Tile = require('../src/models/Tile');

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

// All tiles in riichi mahjong
const tiles = [
  // Man (Characters) 1-9
  { id: 'M1', name: '1 of Man', suit: 'Man' },
  { id: 'M2', name: '2 of Man', suit: 'Man' },
  { id: 'M3', name: '3 of Man', suit: 'Man' },
  { id: 'M4', name: '4 of Man', suit: 'Man' },
  { id: 'M5', name: '5 of Man', suit: 'Man' },
  { id: 'M5R', name: 'Red 5 of Man', suit: 'Man' },
  { id: 'M6', name: '6 of Man', suit: 'Man' },
  { id: 'M7', name: '7 of Man', suit: 'Man' },
  { id: 'M8', name: '8 of Man', suit: 'Man' },
  { id: 'M9', name: '9 of Man', suit: 'Man' },
  
  // Pin (Dots) 1-9
  { id: 'P1', name: '1 of Pin', suit: 'Pin' },
  { id: 'P2', name: '2 of Pin', suit: 'Pin' },
  { id: 'P3', name: '3 of Pin', suit: 'Pin' },
  { id: 'P4', name: '4 of Pin', suit: 'Pin' },
  { id: 'P5', name: '5 of Pin', suit: 'Pin' },
  { id: 'P5R', name: 'Red 5 of Pin', suit: 'Pin' },
  { id: 'P6', name: '6 of Pin', suit: 'Pin' },
  { id: 'P7', name: '7 of Pin', suit: 'Pin' },
  { id: 'P8', name: '8 of Pin', suit: 'Pin' },
  { id: 'P9', name: '9 of Pin', suit: 'Pin' },
  
  // Sou (Bamboo) 1-9
  { id: 'S1', name: '1 of Sou', suit: 'Sou' },
  { id: 'S2', name: '2 of Sou', suit: 'Sou' },
  { id: 'S3', name: '3 of Sou', suit: 'Sou' },
  { id: 'S4', name: '4 of Sou', suit: 'Sou' },
  { id: 'S5', name: '5 of Sou', suit: 'Sou' },
  { id: 'S5R', name: 'Red 5 of Sou', suit: 'Sou' },
  { id: 'S6', name: '6 of Sou', suit: 'Sou' },
  { id: 'S7', name: '7 of Sou', suit: 'Sou' },
  { id: 'S8', name: '8 of Sou', suit: 'Sou' },
  { id: 'S9', name: '9 of Sou', suit: 'Sou' },
  
  // Winds
  { id: 'E', name: 'East Wind', suit: 'Wind' },
  { id: 'S', name: 'South Wind', suit: 'Wind' },
  { id: 'W', name: 'West Wind', suit: 'Wind' },
  { id: 'N', name: 'North Wind', suit: 'Wind' },
  
  // Dragons
  { id: 'w', name: 'White Dragon', suit: 'Dragon' },
  { id: 'g', name: 'Green Dragon', suit: 'Dragon' },
  { id: 'r', name: 'Red Dragon', suit: 'Dragon' },
];

// Main seeding function
const seedTileCollection = async () => {
  try {
    await connectDB();
    
    // Check if we should clear existing data
    const clearData = process.argv.includes('--clear') || process.argv.includes('-c');
    
    if (clearData) {
      console.log('\n⚠ Clearing existing tiles...');
      await Tile.deleteMany({});
      console.log('✓ Existing tiles cleared\n');
    }
    
    // Create tiles
    console.log('Creating tiles...');
    let tilesCreated = 0;
    let tilesSkipped = 0;
    
    for (const tileData of tiles) {
      try {
        // Check if tile already exists
        const existingTile = await Tile.findOne({ id: tileData.id });
        
        if (existingTile) {
          console.log(`  - Tile ${tileData.id} (${tileData.name}) already exists, skipping...`);
          tilesSkipped++;
        } else {
          await Tile.create(tileData);
          console.log(`  ✓ Created tile: ${tileData.id} - ${tileData.name} (${tileData.suit})`);
          tilesCreated++;
        }
      } catch (error) {
        console.log(`  ⚠ Failed to create tile ${tileData.id}: ${error.message}`);
      }
    }
    
    console.log(`\n✓ Created ${tilesCreated} tiles`);
    if (tilesSkipped > 0) {
      console.log(`  (${tilesSkipped} tiles already existed)`);
    }
    
    // Display summary
    const totalTiles = await Tile.countDocuments();
    const tilesBySuit = await Tile.aggregate([
      { $group: { _id: '$suit', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Tile Collection Seeding Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`  Total Tiles: ${totalTiles}`);
    console.log('\n  Tiles by Suit:');
    tilesBySuit.forEach(({ _id, count }) => {
      console.log(`    ${_id}: ${count}`);
    });
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding tile collection:', error);
    process.exit(1);
  }
};

// Run the seeding script
if (require.main === module) {
  seedTileCollection().then(() => {
    mongoose.connection.close();
  }).catch((error) => {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = { seedTileCollection };

