const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    field: 'password_hash',
    allowNull: false
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    field: 'is_verified',
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    field: 'login_attempts',
    defaultValue: 0
  },
  lockedUntil: {
    type: DataTypes.DATE,
    field: 'locked_until',
    allowNull: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login',
    allowNull: true
  },
  userType: {
    type: DataTypes.STRING,
    field: 'user_type',
    defaultValue: 'customer',
    validate: {
      isIn: [['customer', 'admin']]
    }
  },
  // Add snake_case getters for compatibility with existing code
  is_verified: {
    type: DataTypes.VIRTUAL,
    get() { return this.isVerified; },
    set(val) { this.isVerified = val; }
  },
  is_active: {
    type: DataTypes.VIRTUAL,
    get() { return this.isActive; },
    set(val) { this.isActive = val; }
  },
  login_attempts: {
    type: DataTypes.VIRTUAL,
    get() { return this.loginAttempts; },
    set(val) { this.loginAttempts = val; }
  },
  locked_until: {
    type: DataTypes.VIRTUAL,
    get() { return this.lockedUntil; },
    set(val) { this.lockedUntil = val; }
  },
  last_login: {
    type: DataTypes.VIRTUAL,
    get() { return this.lastLogin; },
    set(val) { this.lastLogin = val; }
  },
  password_hash: {
    type: DataTypes.VIRTUAL,
    get() { return this.passwordHash; },
    set(val) { this.passwordHash = val; }
  },
  user_type: {
    type: DataTypes.VIRTUAL,
    get() { return this.userType; },
    set(val) { this.userType = val; }
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance Methods
User.prototype.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Static Methods for compatibility with existing code
User.findByEmail = async function(email) {
  return await User.findOne({ where: { email } });
};

User.findById = async function(id) {
  return await User.findByPk(id);
};

User.create_new = async function(email, password, userType = 'customer') {
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS || 10));
  const passwordHash = await bcrypt.hash(password, salt);
  return await User.create({ email, passwordHash, userType });
};

// Override original create for compatibility if needed, but Sequelize has its own create.
// AuthController calls User.create(email, password)
// Sequelize create takes an object.
// Let's check AuthController again.
// line 59: const newUser = await User.create(email, password);
// Wait, I should probably keep the custom static methods with same names if possible,
// but Sequelize already defines User.create.

User.create_custom = async function(email, password, userType = 'customer') {
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS || 10));
  const passwordHash = await bcrypt.hash(password, salt);
  return await User.create({ email, passwordHash, userType });
};

User.verifyPassword = async function(password, passwordHash) {
  return await bcrypt.compare(password, passwordHash);
};

User.updateLoginAttempts = async function(email, attempts, lockUntil = null) {
  return await User.update(
    { loginAttempts: attempts, lockedUntil: lockUntil },
    { where: { email } }
  );
};

User.resetLoginAttempts = async function(email) {
  return await User.update(
    { loginAttempts: 0, lockedUntil: null, lastLogin: new Date() },
    { where: { email } }
  );
};

User.isAccountLocked = function(user) {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil) > new Date();
};

User.logAudit = async function(userId, action, ip, userAgent, status, details = {}) {
  try {
    const { pool } = require('../config/database');
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, status, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, ip, userAgent, status, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};

User.createVerificationToken = async function(userId, tokenType = 'email_verification') {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  const { pool } = require('../config/database');
  await pool.query(
    `INSERT INTO verification_tokens (user_id, token, token_type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, token, tokenType, expiresAt]
  );
  
  return token;
};

User.verifyToken = async function(token, tokenType) {
  const { pool } = require('../config/database');
  const result = await pool.query(
    `SELECT vt.*, u.email, u.is_verified
     FROM verification_tokens vt
     JOIN users u ON vt.user_id = u.id
     WHERE vt.token = $1 
       AND vt.token_type = $2 
       AND vt.is_used = false 
       AND vt.expires_at > CURRENT_TIMESTAMP`,
    [token, tokenType]
  );
  
  if (result.rows.length === 0) return null;
  
  await pool.query(
    `UPDATE verification_tokens SET is_used = true WHERE id = $1`,
    [result.rows[0].id]
  );
  
  return result.rows[0];
};

User.markAsVerified = async function(userId) {
  const user = await User.findByPk(userId);
  if (user) {
    user.isVerified = true;
    await user.save();
  }
  return user;
};

User.storeRefreshToken = async function(userId, token, expiresAt) {
  const { pool } = require('../config/database');
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
};

User.revokeRefreshToken = async function(token) {
  const { pool } = require('../config/database');
  await pool.query(
    `UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
     WHERE token = $1`,
    [token]
  );
};

User.isValidRefreshToken = async function(token) {
  const { pool } = require('../config/database');
  const result = await pool.query(
    `SELECT rt.*, u.id as user_id, u.email, u.is_active, u.is_verified
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1 
       AND rt.is_revoked = false 
       AND rt.expires_at > CURRENT_TIMESTAMP
       AND u.is_active = true`,
    [token]
  );
  
  return result.rows[0] || null;
};

module.exports = User;