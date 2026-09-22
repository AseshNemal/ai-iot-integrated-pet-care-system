// Limit failed attempts per source and username. This is an in-process safeguard;
// multi-instance deployments should use a shared rate-limit store.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const keysFor = (req) => [
  `ip:${req.ip}`,
  `account:${String(req.body?.username || '').toLowerCase()}`
];

const employeeLoginLimit = (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key);
  }
  const keys = keysFor(req);
  const blocked = keys.map((key) => attempts.get(key)).find((value) => value?.count >= MAX_ATTEMPTS);
  if (blocked) {
    res.set('Retry-After', String(Math.ceil((blocked.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  req.recordFailedEmployeeLogin = () => {
    for (const key of keys) {
      const previous = attempts.get(key);
      attempts.set(key, {
        count: (previous?.count || 0) + 1,
        resetAt: previous?.resetAt || now + WINDOW_MS
      });
    }
  };
  req.clearFailedEmployeeLogin = () => attempts.delete(keys[1]);
  next();
};

module.exports = employeeLoginLimit;
