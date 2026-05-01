const express = require('express');
const morgan = require('morgan');
const leadRoutes = require('./routes/leadRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.get('/v1/health', (req, res) => res.json({ status: 'ok' }));

app.use('/v1/leads', leadRoutes);

app.use(errorHandler);

module.exports = app;
