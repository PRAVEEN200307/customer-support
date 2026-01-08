const jwt = require('jsonwebtoken');
const User = require('../models/User');

const chatAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists and is active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: User not found or inactive'));
    }

    socket.user = {
      id: user.id,
      email: user.email,
      isAdmin: user.userType === 'admin'
    };
    
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = { chatAuth };