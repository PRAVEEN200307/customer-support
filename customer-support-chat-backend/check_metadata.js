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

async function checkMetadata() {
  try {
    const functions = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_type = 'FUNCTION';
    `);
    console.log('Functions:');
    functions.rows.forEach(row => console.log(`- ${row.routine_name}`));

    const triggers = await pool.query(`
      SELECT trigger_name 
      FROM information_schema.triggers;
    `);
    console.log('Triggers:');
    triggers.rows.forEach(row => console.log(`- ${row.trigger_name}`));

    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public';
    `);
    console.log('Indexes:');
    indexes.rows.forEach(row => console.log(`- ${row.indexname}`));

  } catch (err) {
    console.error('Error checking metadata:', err);
  } finally {
    await pool.end();
  }
}

checkMetadata();
