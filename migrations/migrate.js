require('dotenv').config();
const pool = require('../src/config/database');

const migrate = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id          UUID PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        email       VARCHAR(255) NOT NULL UNIQUE,
        phone       VARCHAR(50),
        status      VARCHAR(20)  NOT NULL DEFAULT 'NEW',
        source      VARCHAR(100),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Migration completed: leads table created');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
