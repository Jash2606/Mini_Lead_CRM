const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const leadRoutes = require('./routes/leadRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const db = require('./config/database');
const cache = require('./config/redis');
const shutdownState = require('./config/shutdownState');
const { client, metricsMiddleware } = require('./config/metrics');

const app = express();

app.use(helmet()); // safe default http headers
app.use(pinoHttp({ logger })); // logs every request as json
app.use(metricsMiddleware);
app.use(express.json());

// max 300 requests per minute from one ip
app.use('/v1/leads', rateLimit({ windowMs: 60 * 1000, limit: 300 }));

app.get('/v1/health', (req, res) => res.json({ status: 'ok' }));

// alive = the process is running (no database check, so a db problem does not restart the app)
app.get('/health/live', (req, res) => res.json({ status: 'alive' }));

// ready = can get traffic (postgres is required, redis is only a cache)
app.get('/health/ready', async (req, res) => {
  if (shutdownState.isShuttingDown) {
    return res.status(503).json({ status: 'shutting down' });
  }

  const checks = { postgres: 'ok', redis: 'ok' };

  try {
    await db.checkConnection();
  } catch (err) {
    checks.postgres = 'down';
  }

  try {
    await cache.checkConnection();
  } catch (err) {
    checks.redis = 'down';
  }

  const ready = checks.postgres === 'ok';
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not ready', checks });
});

// metrics for prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.use('/v1/leads', leadRoutes);

app.use(errorHandler);

module.exports = app;
