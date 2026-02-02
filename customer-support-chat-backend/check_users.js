const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsersTable() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in users table:');
    res.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
  } catch (err) {
    console.error('Error checking users table:', err);
  } finally {
    await pool.end();
  }
}

checkUsersTable();
