require('dotenv').config();
const app = require('./src/app');
const cache = require('./src/config/redis');
const db = require('./src/config/database');
const logger = require('./src/config/logger');
const shutdownState = require('./src/config/shutdownState');

const PORT = process.env.PORT || 3000;
let server;

const start = async () => {
  await cache.connect();
  server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

// kubernetes sends SIGTERM before it stops a pod
const shutdown = async () => {
  logger.info('Shutting down');

  // readiness check starts failing, so no new requests are sent to this pod
  shutdownState.isShuttingDown = true;

  // wait a few seconds so kubernetes notices
  await new Promise((resolve) => setTimeout(resolve, 5000));

  server.close(async () => {
    await cache.shutdown();
    await db.end();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
