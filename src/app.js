const express = require('express');
const pinoHttp = require('pino-http');
const leadRoutes = require('./routes/leadRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');

const app = express();

app.use(pinoHttp({ logger })); // logs every request as json
app.use(express.json());

app.get('/v1/health', (req, res) => res.json({ status: 'ok' }));

app.use('/v1/leads', leadRoutes);

app.use(errorHandler);

module.exports = app;
