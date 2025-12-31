const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getAllYaku } = require('./Yaku');

const userSchema = new mongoose.Schema({
  isAdmin: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      'Please provide a valid email'
    ]
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Display name must be at least 3 characters'],
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
    required: [true, 'Password is required'],
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
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ displayName: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  console.info('Saving user: ', this.email, this.displayName);
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
  
  // If top level is off, all others must be off
  if (this.notificationPreferences.emailNotificationsEnabled === false) {
    this.notificationPreferences.emailNotificationsForComments = false;
    this.notificationPreferences.emailNotificationsForNewGames = false;
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
  return userObject;
};

module.exports = mongoose.model('User', userSchema);

