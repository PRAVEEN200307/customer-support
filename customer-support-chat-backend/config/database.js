const { Pool } = require('pg');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// PostgreSQL Pool for direct queries
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

// Test database connections
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL (Pool):', err);
  } else {
    console.log('Successfully connected to PostgreSQL database (Pool)');
    release();
  }
});

sequelize.authenticate()
  .then(() => {
    console.log('Successfully connected to PostgreSQL database (Sequelize)');
  })
  .catch(err => {
    console.error('Unable to connect to the database (Sequelize):', err);
  });

// Error handling for idle clients
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  sequelize
};