require('dotenv').config();
const app = require('./src/app');
const cache = require('./src/config/redis');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await cache.connect();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
