# Mini Lead CRM API

A RESTful API for a simplified Lead Management CRM built for the Superleap Backend Engineering Intern Assessment.

---

## Tech Stack

**Node.js + Express.js** — Node's non-blocking I/O is well-suited for a CRUD-heavy API. Express is lightweight and gives full control over middleware and routing without the overhead of a heavier framework.

**PostgreSQL** — Relational database chosen for its strong data integrity, support for UUIDs natively, and ACID guarantees important for status transitions. The structured lead schema maps cleanly to a relational table.

**Redis** — Used as an optional caching layer for `GET /leads/:id`. If Redis is unavailable the app falls back gracefully and serves all requests from PostgreSQL.

**Docker + Docker Compose** — Containerises the app, PostgreSQL, and Redis for a reproducible one-command setup.

---

## Project Structure (MVC)

```
.
├── src/
│   ├── config/
│   │   ├── database.js       # PostgreSQL pool
│   │   └── redis.js          # Redis client with graceful fallback
│   ├── controllers/
│   │   └── leadController.js # Request handling & response shaping
│   ├── models/
│   │   └── Lead.js           # All SQL queries
│   ├── routes/
│   │   └── leadRoutes.js     # Route → controller wiring
│   ├── middleware/
│   │   └── errorHandler.js   # Global error handler
│   ├── utils/
│   │   └── statusMachine.js  # Transition rules
│   ├── validators/
│   │   └── leadSchema.js     # Zod schemas for all endpoints
│   └── app.js                # Express app
├── tests/
│   ├── unit/
│   │   ├── statusMachine.test.js  # 28 unit tests (no DB)
│   │   └── validators.test.js     # 28 unit tests (no DB)
│   └── integration/
│       └── api.test.js            # 41 integration tests (supertest)
├── migrations/
│   └── migrate.js            # Creates leads table
├── seeds/
│   └── seedLeads.js          # 5 sample leads
├── Mini_Lead_CRM.postman_collection.json  # Postman collection
├── server.js                 # Entry point
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── .env.test                 # Test env template
```

---

## Running Locally

### With Docker (recommended)

```bash
# Clone and enter the project
git clone https://github.com/Jash2606/Mini_Lead_CRM.git
cd Mini_Lead_CRM

# Start everything (app + postgres + redis)
docker-compose up --build
```

The API will be available at `http://localhost:3000`. All endpoints are prefixed with `/v1`.

To seed sample data:

```bash
docker-compose exec app node seeds/seedLeads.js
```

### Without Docker

**Prerequisites:** Node.js 18+, PostgreSQL, Redis (optional)

```bash
# Install dependencies
npm install

# Copy env and fill in your values
cp .env.example .env

# Run migration
npm run migrate

# (Optional) seed sample data
npm run seed

# Start server
npm start
# or for dev with auto-reload:
npm run dev
```

---

## API Documentation

A **Postman collection** is included in the repository: [`Mini_Lead_CRM.postman_collection.json`](./Mini_Lead_CRM.postman_collection.json)

**To import into Postman:**
1. Open Postman → **Import**
2. Select `Mini_Lead_CRM.postman_collection.json` from the project root
3. The collection includes a `baseUrl` variable pre-set to `http://localhost:3000` (all paths already include `/v1`)
4. The **Create Lead** request auto-saves the returned `leadId` to a collection variable so subsequent requests (Get, Update, Delete, Status) use it automatically

The collection covers all endpoints with example request bodies, all expected response shapes (success + error), and built-in test scripts for status code and shape validation.

---

## API Endpoints

### Level 1 — Core CRUD + State Machine

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/leads` | Create a new lead |
| `GET` | `/v1/leads` | List all leads (filter: `?status=NEW`) |
| `GET` | `/v1/leads/:id` | Get a single lead |
| `PUT` | `/v1/leads/:id` | Update lead fields |
| `DELETE` | `/v1/leads/:id` | Delete a lead |
| `PATCH` | `/v1/leads/:id/status` | Transition to a new status |
| `GET` | `/v1/health` | Health check |

### Level 2 — Bulk Operations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/leads/bulk` | Create multiple leads at once |
| `PUT` | `/v1/leads/bulk` | Update multiple leads at once |

Bulk endpoints always return `207 Multi-Status` with per-record results. A single failing record does not abort the rest.

### Status Transitions

```
NEW → CONTACTED → QUALIFIED → CONVERTED
        ↘ LOST     ↘ LOST     ↘ LOST
NEW ↘ LOST
```

`CONVERTED` and `LOST` are terminal — no further transitions allowed.

### Example Requests

**Create a lead**
```http
POST /v1/leads
Content-Type: application/json

{
  "name": "Aman Gupta",
  "email": "aman@example.com",
  "phone": "+91-9876543210",
  "source": "website"
}
```

**Filter by status**
```http
GET /v1/leads?status=NEW
```

**Transition status**
```http
PATCH /v1/leads/:id/status
Content-Type: application/json

{ "status": "CONTACTED" }
```

**Bulk create**
```http
POST /v1/leads/bulk
Content-Type: application/json

[
  { "name": "Lead A", "email": "a@example.com", "source": "website" },
  { "name": "Lead B", "email": "b@example.com" },
  { "email": "missing-name@example.com" }
]
```

Response `207`:
```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    { "index": 0, "success": true, "lead": { "id": "...", "name": "Lead A", "..." : "..." } },
    { "index": 1, "success": true, "lead": { "id": "...", "name": "Lead B", "..." : "..." } },
    { "index": 2, "success": false, "error": "name is required" }
  ]
}
```

**Bulk update**
```http
PUT /v1/leads/bulk
Content-Type: application/json

[
  { "id": "<uuid>", "source": "referral" },
  { "id": "<uuid>", "email": "new@example.com" }
]
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `201` | Lead created |
| `200` | Success |
| `207` | Bulk operation (partial or full success — check per-record `success` fields) |
| `400` | Invalid transition / bad request |
| `404` | Lead not found |
| `409` | Duplicate email |
| `422` | Validation error (missing/invalid field) |
| `500` | Internal server error |

---

## Caching Strategy

- **What is cached:** `GET /v1/leads/:id` responses are cached in Redis under the key `lead:<id>` with a 1-hour TTL.
- **Why only single-lead lookups:** Individual lead fetches are the most repeated read in a CRM (detail views, status checks). The list endpoint (`GET /v1/leads`) has dynamic filters and changes frequently, making cache invalidation complex for marginal gain.
- **Invalidation:** The cache entry for a lead is deleted immediately on `PUT /v1/leads/:id` (field update), `PATCH /v1/leads/:id/status` (status transition), and `DELETE /v1/leads/:id`.
- **Graceful fallback:** If Redis is unreachable at startup, the app logs a warning and continues operating without caching. All cache operations are wrapped in try/catch with silent failure so a Redis outage never breaks the API.

---

## Testing

### Unit tests (no Docker needed)

Tests for the status machine and all Zod validators. Pure function tests — no database required.

```bash
npm run test:unit
```

### Integration tests (requires Docker)

Full API tests using [supertest](https://github.com/ladjs/supertest) covering all endpoints, error cases, state machine transitions, and bulk operations. Runs inside the Docker container so it connects to the same PostgreSQL instance.

```bash
# Ensure Docker containers are running first
docker-compose up -d

# Then run integration tests inside the container
npm run test:docker
```

**Test coverage:** 56 unit tests + 41 integration tests = **97 tests total**.

---

## Design Decisions

**No ORM** — Raw `pg` queries keep the code easy to read, avoids ORM magic, and makes the SQL explicit (important when enforcing transition logic at the DB layer is considered).

**Zod for validation** — All request bodies are validated with Zod schemas defined in `src/validators/leadSchema.js`. This gives a single source of truth for input shapes, consistent error messages, and automatic type coercion (e.g. status is uppercased in the schema before the transition check runs).

**Status machine in application layer** — Transition rules live in `src/utils/statusMachine.js` rather than DB constraints. This gives clear, testable error messages and makes the rules easy to extend without a migration.

**Bulk partial success** — Bulk endpoints validate and attempt each record independently. A validation or DB error on one item is captured per-record; the rest continue. Response is always `207 Multi-Status` with a `results` array showing per-record `success`/`error`.

**UUID primary keys** — UUIDs avoid leaking record counts and are safe to expose in URLs, unlike sequential integers.

**Email uniqueness** — Enforced at the DB level (UNIQUE constraint) as a data-integrity guarantee, not just in application code. The error handler maps Postgres error code `23505` to a human-readable 409 response (or per-record error in bulk operations).

**Invalid UUID handling** — The error handler maps Postgres error code `22P02` (invalid UUID syntax) to a clean `400 Bad Request` instead of leaking a raw database error. This covers routes like `GET /leads/bulk` (which fall through to the `/:id` handler) and any non-UUID value passed in URL params.

**Request logging** — `morgan('dev')` logs every request with method, URL, status code, and response time. Applied as the first middleware so all requests — including those that short-circuit — are logged.

### What I'd do differently at scale

- Add pagination to `GET /leads` (cursor-based for large datasets).
- Add a DB index on `status` for filtered list queries under high volume.
- Use a connection pool tuned to concurrent load and consider read replicas.
- For concurrent status transitions, wrap the `findById + updateStatus` in a `SELECT ... FOR UPDATE` transaction to prevent race conditions.
- Move to a job queue (e.g. BullMQ) for bulk operations to avoid HTTP timeouts and allow retries.
- Add structured logging (e.g. Winston/Pino) and a request-ID header for traceability.
