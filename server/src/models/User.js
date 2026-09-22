const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getAllYaku } = require('./Yaku');
const { FLAIR_CATEGORIES, INLINE_FLAIR_CATEGORIES } = require('../data/flairCategories');
const { SHOWCASE_MAX_ENTRIES, SHOWCASE_ENTRY_TYPES } = require('../utils/showcaseService');

const userSchema = new mongoose.Schema({
  isAdmin: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: function() {
      return !this.isGuest;
    },
    unique: true,
    sparse: true, // Allows multiple null values
    lowercase: true,
    validate: {
      validator: function(v) {
        // Skip validation for guest users
        if (this.isGuest) return true;
        // Validate email format for non-guest users
        return !v || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v);
      },
      message: 'Please provide a valid email'
    }
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Display name must be at least 2 characters'],
    maxlength: [30, 'Display name cannot be more than 30 characters'],
  },
  realName: {
    type: String,
    trim: true,
    minlength: [1, 'Real name must be at least 1 character'],
    maxlength: [30, 'Real name cannot be more than 30 characters']
  },
  discordName: {
    type: String,
    trim: true,
    minlength: [1, 'Real name must be at least 1 character'],
    maxlength: [30, 'Real name cannot be more than 30 characters']
  },
  mahjongSoulName: {
    type: String,
    trim: true,
    minlength: [1, 'Real name must be at least 1 character'],
    maxlength: [30, 'Real name cannot be more than 30 characters']
  },
  password: {
    type: String,
    required: function() {
      return !this.isGuest;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  favoriteYaku: {
    type: String,
    enum: [...getAllYaku(), null],
    default: null
  },
  favoriteTile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tile',
    default: null
  },
  clubAffiliation: {
    type: String,
    required: [true, 'Club affiliation is required'],
    enum: ['Charleston', 'Charlotte', 'Washington D.C.'],
    default: 'Charleston'
  },
  privateMode: {
    type: Boolean,
    default: false
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  notificationPreferences: {
    emailNotificationsEnabled: {
      type: Boolean,
      default: true
    },
    emailNotificationsForComments: {
      type: Boolean,
      default: true
    },
    emailNotificationsForNewGames: {
      type: Boolean,
      default: true
    },
    emailNotificationsForNewTournaments: {
      type: Boolean,
      default: true
    },
    emailNotificationsForRoundPairings: {
      type: Boolean,
      default: true
    }
  },
  notifications: [{
    name: {
      type: String,
      required: [true, 'Notification name is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Notification description is required'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: ['Game', 'Comment', 'Other'],
      default: 'Other'
    },
    url: {
      type: String,
      trim: true
    },
    viewed: {
      type: Boolean,
      default: false
    }
  }],
  riichiMusic: {
    url: {
      type: String,
      trim: true,
      default: null
    },
    type: {
      type: String,
      enum: ['youtube', 'spotify'],
      default: 'spotify'
    }
  },
  pointsBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPointsEarned: {
    type: Number,
    default: 0,
  },
  // Updated at most once per calendar week (see middleware/auth.js) — the "visited the site"
  // signal for the weekly streak bonus (see utils/weeklyStreakService.js).
  lastActiveAt: {
    type: Date,
    default: null,
  },
  purchasedItems: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
    purchasedAt: { type: Date, default: Date.now },
  }],
  // One slot per flair category, holding the equipped item's `value`.
  equippedFlair: Object.fromEntries(
    FLAIR_CATEGORIES.map(category => [category, { type: String, default: null }])
  ),
  // Things the player pins to their profile; entry shapes are validated by showcaseService.
  showcase: {
    type: [{
      _id: false,
      type: { type: String, enum: SHOWCASE_ENTRY_TYPES, required: true },
      category: { type: String, enum: FLAIR_CATEGORIES },
      value: { type: String },
      key: { type: String },
    }],
    default: [],
    validate: {
      validator: entries => entries.length <= SHOWCASE_MAX_ENTRIES,
      message: `showcase can hold at most ${SHOWCASE_MAX_ENTRIES} entries`,
    },
  },
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ displayName: 1 });

// Hash password before saving (skip for guest users)
userSchema.pre('save', async function(next) {
  console.info('Saving user: ', this.email || 'Guest', this.displayName);
  
  // Skip password hashing for guest users
  if (this.isGuest) {
    return next();
  }
  
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Enforce email notification preferences: if top level is off, all others must be off
userSchema.pre('save', function(next) {
  // Initialize notificationPreferences if it doesn't exist
  if (!this.notificationPreferences) {
    this.notificationPreferences = {};
  }
  
  // Set defaults if not present
  if (this.notificationPreferences.emailNotificationsEnabled === undefined) {
    this.notificationPreferences.emailNotificationsEnabled = true;
  }
  if (this.notificationPreferences.emailNotificationsForComments === undefined) {
    this.notificationPreferences.emailNotificationsForComments = true;
  }
  if (this.notificationPreferences.emailNotificationsForNewGames === undefined) {
    this.notificationPreferences.emailNotificationsForNewGames = true;
  }
  if (this.notificationPreferences.emailNotificationsForNewTournaments === undefined) {
    this.notificationPreferences.emailNotificationsForNewTournaments = true;
  }
  if (this.notificationPreferences.emailNotificationsForRoundPairings === undefined) {
    this.notificationPreferences.emailNotificationsForRoundPairings = true;
  }
  
  // If top level is off, all others must be off
  if (this.notificationPreferences.emailNotificationsEnabled === false) {
    this.notificationPreferences.emailNotificationsForComments = false;
    this.notificationPreferences.emailNotificationsForNewGames = false;
    this.notificationPreferences.emailNotificationsForNewTournaments = false;
    this.notificationPreferences.emailNotificationsForRoundPairings = false;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  
  // Hide email for guest users (it's just a dummy email)
  if (userObject.isGuest === true) {
    userObject.email = undefined;
  }
  
  // If private mode is enabled, hide name and username fields
  if (userObject.privateMode === true) {
    userObject.displayName = 'Hidden';
    userObject.realName = undefined;
    userObject.discordName = undefined;
    userObject.mahjongSoulName = undefined;
    userObject.avatar = undefined;
    userObject.favoriteYaku = undefined;
    userObject.favoriteTile = undefined;
    userObject.clubAffiliation = undefined;
    // Profile-only flair: the inline slots (name, icon, border, title) stay visible.
    if (userObject.equippedFlair) {
      userObject.equippedFlair.profileBackdrop = null;
    }
    userObject.showcase = [];
  }

  return userObject;
};

// Common fields to populate when fetching player data. Inline flair only: the profile backdrop
// is drawn on the profile page alone, so it is served with the user profile and does not ride
// along on every game, tournament and member list.
const PLAYER_POPULATE_FIELDS = [
  'displayName',
  'avatar',
  'privateMode',
  'isGuest',
  ...INLINE_FLAIR_CATEGORIES.map(category => `equippedFlair.${category}`),
].join(' ');

module.exports = mongoose.model('User', userSchema);
module.exports.PLAYER_POPULATE_FIELDS = PLAYER_POPULATE_FIELDS;

