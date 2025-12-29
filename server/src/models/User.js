const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
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
  passwordResetToken: String,
  passwordResetExpires: Date
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

