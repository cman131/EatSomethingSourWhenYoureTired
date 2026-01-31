const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const tileRoutes = require('./routes/tiles');
const discardQuizRoutes = require('./routes/discardQuizzes');
const decisionQuizRoutes = require('./routes/decisionQuizzes');
const achievementRoutes = require('./routes/achievements');
const tournamentRoutes = require('./routes/tournaments');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting - skip in development mode
const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
if (!isDevelopment) {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
      // Skip rate limiting for auth routes (they have their own stricter limiter)
      return req.path.startsWith('/api/auth');
    },
    handler: (req, res) => {
      // Log rate limit hit with IP, timestamp, request details, and request count
      const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const timestamp = new Date().toISOString();
      const requestPath = req.path;
      const requestMethod = req.method;
      
      // Get rate limit information
      const rateLimitInfo = req.rateLimit || {};
      const currentRequests = rateLimitInfo.current || 'unknown';
      const limit = rateLimitInfo.limit || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000;
      const requestsMade = currentRequests > limit ? currentRequests : limit + 1; // If current exceeds limit, use current; otherwise limit + 1
      
      console.warn(`[RATE LIMIT HIT] IP: ${clientIP} | Time: ${timestamp} | Method: ${requestMethod} | Path: ${requestPath} | Requests: ${requestsMade}/${limit} | User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
      
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      });
    }
  });
  app.use('/api/', limiter);
} else {
  console.log('General rate limiting disabled for development mode');
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/games', authenticateToken, gameRoutes);
app.use('/api/tiles', authenticateToken, tileRoutes);
app.use('/api/discard-quizzes', authenticateToken, discardQuizRoutes);
app.use('/api/decision-quizzes', authenticateToken, decisionQuizRoutes);
app.use('/api/achievements', authenticateToken, achievementRoutes);
app.use('/api/tournaments', tournamentRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI 
      : process.env.MONGODB_URI;
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();

module.exports = { app };

