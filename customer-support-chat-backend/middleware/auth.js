const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = {
  // Verify JWT token
  verifyToken: (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
        
        req.user = decoded;
        next();
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Verify refresh token
  verifyRefreshToken: async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      const tokenData = await User.isValidRefreshToken(refreshToken);
      
      if (!tokenData) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      req.refreshTokenData = tokenData;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Check if user is verified
  requireVerified: (req, res, next) => {
    if (!req.user || !req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before accessing this resource'
      });
    }
    next();
  },

  // Check if user is admin
  requireAdmin: (req, res, next) => {
    if (!req.user || req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    next();
  },

  // Rate limiting for authentication endpoints (would be configured separately)
};

module.exports = authMiddleware;