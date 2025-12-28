const { body, param, query, validationResult } = require('express-validator');

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
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
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
  body('avatar')
    .optional()
    .isString()
    .withMessage('Avatar must be a string'),
  
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
  validateMongoId
};

