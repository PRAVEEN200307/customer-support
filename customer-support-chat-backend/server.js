const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sequelize } = require('./config/database');
const passport = require('./config/passport');
const ChatHandler = require('./sockets/chatHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Chat Handler
const chatHandler = new ChatHandler(io);
chatHandler.initialize();


// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));



// // Chat-specific rate limiter (more generous)
// const chatLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 300, // 300 requests per minute
//   message: {
//     success: false,
//     message: 'Chat rate limit exceeded. Please wait a moment.',
//     retryAfter: 30
//   },
//   skip: (req) => {
//     // Skip rate limiting for WebSocket-related requests
//     return req.path.includes('/socket.io/') || req.headers.upgrade === 'websocket';
//   }
// });

// const authLimiter = rateLimit({
//   store: new RedisStore({
//     client: redisClient,
//     prefix: 'ratelimit:auth:',
//     expiry: 3600, // 1 hour TTL
//   }),
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 10, // Only 10 failed attempts per hour
//   message: {
//     success: false,
//     message: 'Too many failed login attempts. Account temporarily locked.',
//     retryAfter: 3600
//   }
// });

// app.use(globalLimiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Sync database and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Sync database
    await sequelize.sync({ force: false });
    console.log('Database synced successfully');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    sequelize.close().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);