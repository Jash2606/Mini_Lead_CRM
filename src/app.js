const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const leadRoutes = require('./routes/leadRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');

const app = express();

app.use(helmet()); // safe default http headers
app.use(pinoHttp({ logger })); // logs every request as json
app.use(express.json());

// max 300 requests per minute from one ip
app.use('/v1/leads', rateLimit({ windowMs: 60 * 1000, limit: 300 }));

app.get('/v1/health', (req, res) => res.json({ status: 'ok' }));

app.use('/v1/leads', leadRoutes);

app.use(errorHandler);

module.exports = app;
