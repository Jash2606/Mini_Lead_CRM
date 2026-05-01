/**
 * Integration tests — requires a running PostgreSQL instance.
 *
 * With Docker:
 *   docker-compose up -d postgres redis
 *   npm run test:integration
 *
 * Environment variables are read from .env (or Docker defaults).
 * Tests run in-band (--runInBand) to preserve state across test order.
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/database');

// Unique suffix per test run so seeds don't collide across re-runs
const RUN = Date.now();

afterAll(async () => {
  // Remove test leads created during this run and close the pool
  await pool.query(`DELETE FROM leads WHERE email LIKE '%_test_${RUN}@%'`);
  await pool.end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createLead = (overrides = {}) =>
  request(app)
    .post('/v1/leads')
    .send({ name: 'Test Lead', email: `lead_test_${RUN}_${Math.random().toString(36).slice(2)}@example.com`, ...overrides });

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
describe('GET /v1/health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/leads
// ---------------------------------------------------------------------------
describe('POST /v1/leads', () => {
  test('creates a lead and returns 201 with status NEW', async () => {
    const res = await createLead();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('NEW');
    expect(res.body.id).toBeDefined();
  });

  test('lowercases email before storing', async () => {
    const email = `UPPERCASE_test_${RUN}@EXAMPLE.COM`;
    const res = await createLead({ email });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email.toLowerCase());
  });

  test('returns 422 when name is missing', async () => {
    const res = await request(app).post('/v1/leads').send({ email: `nomname_test_${RUN}@example.com` });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/name/i);
  });

  test('returns 422 when email is missing', async () => {
    const res = await request(app).post('/v1/leads').send({ name: 'No Email' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/email/i);
  });

  test('returns 422 for invalid email format', async () => {
    const res = await request(app).post('/v1/leads').send({ name: 'Bad', email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  test('returns 409 for duplicate email', async () => {
    const email = `dup_test_${RUN}@example.com`;
    await createLead({ email });
    const res = await createLead({ email });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/leads
// ---------------------------------------------------------------------------
describe('GET /v1/leads', () => {
  test('returns an array', async () => {
    const res = await request(app).get('/v1/leads');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('filters by status query param', async () => {
    const res = await request(app).get('/v1/leads?status=NEW');
    expect(res.status).toBe(200);
    res.body.forEach((lead) => expect(lead.status).toBe('NEW'));
  });

  test('query param is case-insensitive (lowercase new)', async () => {
    const res = await request(app).get('/v1/leads?status=new');
    expect(res.status).toBe(200);
    res.body.forEach((lead) => expect(lead.status).toBe('NEW'));
  });

  test('returns 400 for an invalid status filter', async () => {
    const res = await request(app).get('/v1/leads?status=INVALID');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/leads/:id
// ---------------------------------------------------------------------------
describe('GET /v1/leads/:id', () => {
  test('returns 200 with the lead', async () => {
    const created = await createLead();
    const res = await request(app).get(`/v1/leads/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test('returns 404 for a non-existent UUID', async () => {
    const res = await request(app).get('/v1/leads/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  test('returns 400 for a non-UUID id (BUG-2 fix)', async () => {
    const res = await request(app).get('/v1/leads/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid id format/i);
  });

  test('GET /v1/leads/bulk returns 400 not 500 (BUG-1 fix)', async () => {
    const res = await request(app).get('/v1/leads/bulk');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid id format/i);
  });
});

// ---------------------------------------------------------------------------
// PUT /v1/leads/:id
// ---------------------------------------------------------------------------
describe('PUT /v1/leads/:id', () => {
  test('updates fields and returns 200', async () => {
    const created = await createLead();
    const res = await request(app)
      .put(`/v1/leads/${created.body.id}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('returns 400 for empty body (no valid fields)', async () => {
    const created = await createLead();
    const res = await request(app).put(`/v1/leads/${created.body.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent lead', async () => {
    const res = await request(app)
      .put('/v1/leads/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('returns 422 for invalid email on update', async () => {
    const created = await createLead();
    const res = await request(app)
      .put(`/v1/leads/${created.body.id}`)
      .send({ email: 'bad-email' });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/leads/:id/status
// ---------------------------------------------------------------------------
describe('PATCH /v1/leads/:id/status — state machine', () => {
  let leadId;

  beforeEach(async () => {
    const res = await createLead();
    leadId = res.body.id;
  });

  test('NEW → CONTACTED is valid (200)', async () => {
    const res = await request(app)
      .patch(`/v1/leads/${leadId}/status`)
      .send({ status: 'CONTACTED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONTACTED');
  });

  test('NEW → LOST is valid (200)', async () => {
    const res = await request(app)
      .patch(`/v1/leads/${leadId}/status`)
      .send({ status: 'LOST' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('LOST');
  });

  test('full valid path NEW→CONTACTED→QUALIFIED→CONVERTED', async () => {
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONTACTED' });
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'QUALIFIED' });
    const res = await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONVERTED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONVERTED');
  });

  test('CONVERTED is terminal — further transition blocked (400)', async () => {
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONTACTED' });
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'QUALIFIED' });
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONVERTED' });
    const res = await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'LOST' });
    expect(res.status).toBe(400);
  });

  test('CONTACTED → NEW (backward) is blocked (400)', async () => {
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONTACTED' });
    const res = await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'NEW' });
    expect(res.status).toBe(400);
  });

  test('CONTACTED → CONVERTED (skip) is blocked (400)', async () => {
    await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONTACTED' });
    const res = await request(app).patch(`/v1/leads/${leadId}/status`).send({ status: 'CONVERTED' });
    expect(res.status).toBe(400);
  });

  test('case-insensitive status input ("contacted") is accepted', async () => {
    const res = await request(app)
      .patch(`/v1/leads/${leadId}/status`)
      .send({ status: 'contacted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONTACTED');
  });

  test('returns 422 for an invalid status value', async () => {
    const res = await request(app)
      .patch(`/v1/leads/${leadId}/status`)
      .send({ status: 'BOGUS' });
    expect(res.status).toBe(422);
  });

  test('returns 422 when status field is missing', async () => {
    const res = await request(app).patch(`/v1/leads/${leadId}/status`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/status/i);
  });

  test('returns 404 for non-existent lead', async () => {
    const res = await request(app)
      .patch('/v1/leads/00000000-0000-0000-0000-000000000000/status')
      .send({ status: 'CONTACTED' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /v1/leads/:id
// ---------------------------------------------------------------------------
describe('DELETE /v1/leads/:id', () => {
  test('deletes a lead and returns 200', async () => {
    const created = await createLead();
    const res = await request(app).delete(`/v1/leads/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  test('returns 404 on double-delete', async () => {
    const created = await createLead();
    await request(app).delete(`/v1/leads/${created.body.id}`);
    const res = await request(app).delete(`/v1/leads/${created.body.id}`);
    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent lead', async () => {
    const res = await request(app).delete('/v1/leads/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/leads/bulk
// ---------------------------------------------------------------------------
describe('POST /v1/leads/bulk', () => {
  test('creates multiple leads and returns 207', async () => {
    const res = await request(app)
      .post('/v1/leads/bulk')
      .send([
        { name: 'Bulk A', email: `bulka_test_${RUN}@example.com` },
        { name: 'Bulk B', email: `bulkb_test_${RUN}@example.com` },
      ]);
    expect(res.status).toBe(207);
    expect(res.body.total).toBe(2);
    expect(res.body.successful).toBe(2);
    expect(res.body.failed).toBe(0);
  });

  test('handles partial failure — continues after one bad record', async () => {
    const res = await request(app)
      .post('/v1/leads/bulk')
      .send([
        { name: 'Valid', email: `bulkpartial_test_${RUN}@example.com` },
        { name: 'Bad Email', email: 'not-an-email' },
      ]);
    expect(res.status).toBe(207);
    expect(res.body.successful).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.results[1].success).toBe(false);
  });

  test('returns 422 for non-array body', async () => {
    const res = await request(app).post('/v1/leads/bulk').send({ name: 'Not Array' });
    expect(res.status).toBe(422);
  });

  test('returns 422 for empty array', async () => {
    const res = await request(app).post('/v1/leads/bulk').send([]);
    expect(res.status).toBe(422);
  });

  test('reports duplicate email as per-item failure', async () => {
    // Use a seeded email that already exists
    const existing = await createLead();
    const res = await request(app)
      .post('/v1/leads/bulk')
      .send([{ name: 'Dup', email: existing.body.email }]);
    expect(res.status).toBe(207);
    expect(res.body.failed).toBe(1);
    expect(res.body.results[0].error).toMatch(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// PUT /v1/leads/bulk
// ---------------------------------------------------------------------------
describe('PUT /v1/leads/bulk', () => {
  test('updates multiple leads and returns 207', async () => {
    const a = await createLead();
    const b = await createLead();
    const res = await request(app)
      .put('/v1/leads/bulk')
      .send([
        { id: a.body.id, name: 'Bulk Updated A' },
        { id: b.body.id, source: 'referral' },
      ]);
    expect(res.status).toBe(207);
    expect(res.body.successful).toBe(2);
    expect(res.body.failed).toBe(0);
  });

  test('reports missing id as per-item failure', async () => {
    const res = await request(app).put('/v1/leads/bulk').send([{ name: 'No ID' }]);
    expect(res.status).toBe(207);
    expect(res.body.failed).toBe(1);
    expect(res.body.results[0].error).toMatch(/id/i);
  });

  test('reports non-existent id as per-item failure', async () => {
    const res = await request(app)
      .put('/v1/leads/bulk')
      .send([{ id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' }]);
    expect(res.status).toBe(207);
    expect(res.body.failed).toBe(1);
  });

  test('returns 422 for non-array body', async () => {
    const res = await request(app).put('/v1/leads/bulk').send({ id: 'abc' });
    expect(res.status).toBe(422);
  });
});
