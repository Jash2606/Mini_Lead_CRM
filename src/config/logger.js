const pino = require('pino');

// stay quiet while running tests
const level = process.env.NODE_ENV === 'test' ? 'silent' : 'info';

module.exports = pino({ level });
