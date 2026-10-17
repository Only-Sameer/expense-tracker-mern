export function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint not found.' });
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && Object.hasOwn(err, 'body')) {
    return res.status(400).json({ error: 'Request body contains invalid JSON.' });
  }
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'Please check the submitted fields.', details: err.issues });
  if (err?.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
  if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: 'Submitted data is invalid.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('Request error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
