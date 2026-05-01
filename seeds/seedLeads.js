require('dotenv').config();
const pool = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

const seeds = [
  { name: 'Aman Gupta',   email: 'aman@example.com',   phone: '+91-9876543210', source: 'website',  status: 'NEW' },
  { name: 'Priya Sharma', email: 'priya@example.com',  phone: '+91-9876543211', source: 'referral', status: 'CONTACTED' },
  { name: 'Rahul Verma',  email: 'rahul@example.com',  phone: '+91-9876543212', source: 'campaign', status: 'QUALIFIED' },
  { name: 'Sneha Patel',  email: 'sneha@example.com',  phone: null,             source: 'website',  status: 'CONVERTED' },
  { name: 'Vikram Singh', email: 'vikram@example.com', phone: null,             source: 'referral', status: 'LOST' },
];

const seed = async () => {
  try {
    for (const s of seeds) {
      await pool.query(
        `INSERT INTO leads (id, name, email, phone, status, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [uuidv4(), s.name, s.email, s.phone, s.status, s.source]
      );
    }
    console.log('Seed completed: 5 sample leads inserted');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
