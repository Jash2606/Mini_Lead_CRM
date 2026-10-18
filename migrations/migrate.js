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

    // only allow valid statuses in the database too (not just in the app code)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_check'
        ) THEN
          ALTER TABLE leads ADD CONSTRAINT leads_status_check
            CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'));
        END IF;
      END $$;
    `);

    // makes filtering leads by status faster
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`);

    console.log('Migration completed: leads table ready (table, status CHECK constraint, status index)');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
