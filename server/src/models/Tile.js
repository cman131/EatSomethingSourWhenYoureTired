const mongoose = require('mongoose');

const suitEnum = ['Man', 'Sou', 'Pin', 'Wind', 'Dragon'];

const tileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'Tile ID is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Tile name is required'],
    trim: true
  },
  suit: {
    type: String,
    required: [true, 'Tile suit is required'],
    enum: suitEnum
  }
}, {
  timestamps: false
});

// Index for better query performance
tileSchema.index({ id: 1 });
tileSchema.index({ suit: 1 });

module.exports = mongoose.model('Tile', tileSchema);

