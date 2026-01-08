const validator = require('validator');

const validationUtils = {
  // Validate email format
  isValidEmail: (email) => {
    return validator.isEmail(email);
  },

  // Validate password strength
  isStrongPassword: (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  },

  // Sanitize input
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    
    return validator.escape(
      validator.trim(input)
    );
  },

  // Generate password hash (alternative to bcrypt)
  generatePasswordHash: async (password) => {
    // Note: In production, use bcrypt as shown in the User model
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  },

  // Verify password hash
  verifyPasswordHash: (password, storedHash) => {
    // Note: In production, use bcrypt as shown in the User model
    const crypto = require('crypto');
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }
};

module.exports = validationUtils;