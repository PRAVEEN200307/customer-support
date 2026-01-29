const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.'
  },
  skipSuccessfulRequests: true,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 signup requests per hour
  message: {
    success: false,
    message: 'Too many signup attempts. Please try again later.'
  },
});

// Public routes
router.post(
  '/signup',
  signupLimiter,
  validationMiddleware.validateSignup,
  authController.signup
);

router.post(
  '/login',
  authLimiter,
  validationMiddleware.validateLogin,
  authController.login
);

router.get('/verify-email', authController.verifyEmail);

// Social Login Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.socialLoginSuccess
);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  authController.socialLoginSuccess
);

router.post(
  '/refresh-token',
  authMiddleware.verifyRefreshToken,
  authController.refreshToken
);

// Protected routes
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);

module.exports = router;