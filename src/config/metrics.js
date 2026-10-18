const client = require('prom-client');

// basic metrics about the node process (cpu, memory, ...)
client.collectDefaultMetrics();

// measures how long each request takes (also gives the request count)
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'How long requests take',
  labelNames: ['method', 'route', 'status_code'],
});

const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer();

  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : 'unknown';
    end({ method: req.method, route, status_code: res.statusCode });
  });

  next();
};

module.exports = { client, metricsMiddleware };
