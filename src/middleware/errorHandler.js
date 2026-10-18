const errorHandler = (err, req, res, next) => {
  req.log.error({ err }, 'request failed');

  if (err.code === '23505') {
    return res.status(409).json({ error: 'A lead with this email already exists' });
  }

  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid ID format — must be a valid UUID' });
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({ error: message });
};

module.exports = errorHandler;
