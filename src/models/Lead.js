const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const create = async ({ name, email, phone, source }) => {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO leads (id, name, email, phone, status, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'NEW', $5, NOW(), NOW())
     RETURNING *`,
    [id, name, email, phone || null, source || null]
  );
  return result.rows[0];
};

const findAll = async ({ status } = {}) => {
  let query = 'SELECT * FROM leads';
  const params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const update = async (id, fields) => {
  const allowed = ['name', 'email', 'phone', 'source'];
  const updates = [];
  const params = [];
  let paramIdx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${paramIdx++}`);
      params.push(fields[key]);
    }
  }

  if (updates.length === 0) return null;

  updates.push('updated_at = NOW()');
  params.push(id);

  const result = await pool.query(
    `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

const updateStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
};

const remove = async (id) => {
  const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
};

module.exports = { create, findAll, findById, update, updateStatus, remove };
