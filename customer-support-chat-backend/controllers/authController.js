const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EmailService = require('../utils/emailService');

class AuthController {
  constructor() {
    this.signup = this.signup.bind(this);
    this.login = this.login.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.getCurrentUser = this.getCurrentUser.bind(this);
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        isVerified: user.is_verified,
        userType: user.user_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  }

  // Generate refresh token
  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );
  }

  // Signup
  async signup(req, res) {
    try {
      const { email, password, usertype } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        await User.logAudit(null, 'signup_attempt', ipAddress, userAgent, 'failed', {
          email,
          reason: 'User already exists'
        });
        
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const newUser = await User.create_custom(email, password, usertype || 'customer');
      
      // Generate verification token
      const verificationToken = await User.createVerificationToken(newUser.id);
      
      // Send verification email
      await EmailService.sendVerificationEmail(email, verificationToken);
      
      // Log successful signup
      await User.logAudit(newUser.id, 'signup', ipAddress, userAgent, 'success', {
        email
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully. Please check your email for verification link.',
        data: {
          id: newUser.id,
          email: newUser.email,
          isVerified: newUser.is_verified,
          userType: newUser.userType
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      
      await User.logAudit(null, 'signup', req.ip, req.get('User-Agent'), 'error', {
        email: req.body.email,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Find user
      const user = await User.findByEmail(email);
      
      if (!user) {
        await User.logAudit(null, 'login_attempt', ipAddress, userAgent, 'failed', {
          email,
          reason: 'User not found'
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is active
      if (!user.is_active) {
        await User.logAudit(user.id, 'login_attempt', ipAddress, userAgent, 'failed', {
          reason: 'Account deactivated'
        });
        
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      // Check if account is locked
      if (User.isAccountLocked(user)) {
        await User.logAudit(user.id, 'login_attempt', ipAddress, userAgent, 'failed', {
          reason: 'Account locked',
          lockedUntil: user.locked_until
        });
        
        return res.status(423).json({
          success: false,
          message: 'Account is locked. Please try again later or reset your password.'
        });
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        // Increment login attempts
        const newAttempts = user.login_attempts + 1;
        let lockUntil = null;
        
        if (newAttempts >= process.env.MAX_LOGIN_ATTEMPTS) {
          lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + process.env.LOCKOUT_TIME_MINUTES);
        }
        
        await User.updateLoginAttempts(email, newAttempts, lockUntil);
        
        await User.logAudit(user.id, 'login_attempt', ipAddress, userAgent, 'failed', {
          reason: 'Invalid password',
          attempts: newAttempts,
          locked: lockUntil !== null
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          attempts: newAttempts,
          locked: lockUntil !== null
        });
      }

      // Reset login attempts on successful login
      await User.resetLoginAttempts(email);
      
      // Generate tokens
      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      
      // Store refresh token
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days
      
      await User.storeRefreshToken(user.id, refreshToken, refreshTokenExpiry);
      
      // Log successful login
      await User.logAudit(user.id, 'login', ipAddress, userAgent, 'success', {
        tokenIssued: true
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRES_IN,
          user: {
            id: user.id,
            email: user.email,
            isVerified: user.is_verified,
            lastLogin: user.last_login
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      
      await User.logAudit(null, 'login', req.ip, req.get('User-Agent'), 'error', {
        email: req.body.email,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const tokenData = await User.verifyToken(token, 'email_verification');
      
      if (!tokenData) {
        await User.logAudit(null, 'email_verification', ipAddress, userAgent, 'failed', {
          reason: 'Invalid or expired token'
        });
        
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Mark user as verified
      const updatedUser = await User.markAsVerified(tokenData.user_id);
      
      // Send welcome email
      await EmailService.sendWelcomeEmail(tokenData.email);
      
      // Log successful verification
      await User.logAudit(tokenData.user_id, 'email_verification', ipAddress, userAgent, 'success');

      res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
        data: {
          email: updatedUser.email,
          isVerified: updatedUser.is_verified
        }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      
      await User.logAudit(null, 'email_verification', req.ip, req.get('User-Agent'), 'error', {
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshTokenData } = req;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Generate new access token
      const accessToken = this.generateToken(refreshTokenData);
      
      // Log token refresh
      await User.logAudit(refreshTokenData.user_id, 'token_refresh', ipAddress, userAgent, 'success');

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRES_IN
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      
      await User.logAudit(null, 'token_refresh', req.ip, req.get('User-Agent'), 'error', {
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      if (refreshToken) {
        // Revoke refresh token
        await User.revokeRefreshToken(refreshToken);
      }

      // Log logout
      if (req.user?.id) {
        await User.logAudit(req.user.id, 'logout', ipAddress, userAgent, 'success');
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      if (req.user?.id) {
        await User.logAudit(req.user.id, 'logout', req.ip, req.get('User-Agent'), 'error', {
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new AuthController();