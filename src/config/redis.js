const { createClient } = require('redis');

let client = null;
let isConnected = false;

const connect = async () => {
  try {
    client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    });

    client.on('error', (err) => {
      console.warn('Redis error (caching disabled):', err.message);
      isConnected = false;
    });

    await client.connect();
    isConnected = true;
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis unavailable, caching disabled:', err.message);
    isConnected = false;
  }
};

const get = async (key) => {
  if (!isConnected || !client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
};

const set = async (key, value, ttlSeconds = 3600) => {
  if (!isConnected || !client) return;
  try {
    await client.setEx(key, ttlSeconds, value);
  } catch {
    // silent fail — caching is best-effort
  }
};

const del = async (key) => {
  if (!isConnected || !client) return;
  try {
    await client.del(key);
  } catch {
    // silent fail
  }
};

// used by the readiness check
const checkConnection = async () => {
  if (!isConnected || !client) throw new Error('redis not connected');
  await client.ping();
};

// used when the app shuts down
const shutdown = async () => {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    // redis is already closed, nothing to do
  }
  isConnected = false;
};

module.exports = { connect, get, set, del, checkConnection, shutdown };
