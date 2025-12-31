const { body, param, query, validationResult } = require('express-validator');
const { getAllYaku } = require('../models/Yaku');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  
  body('displayName')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Display name must be between 3 and 30 characters'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateUserUpdate = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Display name must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Display name can only contain letters, numbers, and underscores'),
  
  body('avatar')
    .optional()
    .isString()
    .withMessage('Avatar must be a string'),
  
  body('realName')
    .optional()
    .trim()
    .isLength({ min: 0, max: 30 })
    .withMessage('Real name cannot be more than 30 characters'),
  
  body('discordName')
    .optional()
    .trim()
    .isLength({ min: 0, max: 30 })
    .withMessage('Discord name cannot be more than 30 characters'),
  
  body('mahjongSoulName')
    .optional()
    .trim()
    .isLength({ min: 0, max: 30 })
    .withMessage('Mahjong Soul name cannot be more than 30 characters'),
  
  body('favoriteYaku')
    .optional({ nullable: true, checkFalsy: true })
    .isIn([...getAllYaku(), null])
    .withMessage('Favorite Yaku must be a valid Yaku from the enum or null'),
  
  body('clubAffiliation')
    .optional()
    .isIn(['Charleston', 'Charlotte', 'Washington D.C.'])
    .withMessage('Club affiliation must be Charleston, Charlotte, or Washington D.C.'),
  
  handleValidationErrors
];

// Game validation rules
const validateGameCreation = [
  body('players')
    .isArray({ min: 4, max: 4 })
    .withMessage('A mahjong game must have exactly 4 players'),
  
  body('players.*.player')
    .isMongoId()
    .withMessage('Invalid player ID'),
  
  body('players.*.score')
    .isInt()
    .withMessage('Score must be an integer'),
  
  body('players.*.position')
    .isInt({ min: 1, max: 4 })
    .withMessage('Position must be between 1 and 4'),
  
  body('gameDate')
    .optional()
    .isISO8601()
    .withMessage('Game date must be a valid ISO 8601 date'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot be more than 500 characters'),
  
  handleValidationErrors
];

// Password reset validation
const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  
  handleValidationErrors
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  handleValidationErrors
];

// Parameter validation
const validateMongoId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} ID`),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateGameCreation,
  validateForgotPassword,
  validateResetPassword,
  validateMongoId
};

