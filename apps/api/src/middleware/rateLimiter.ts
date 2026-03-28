import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for mutating API endpoints.
 *
 * Limits:
 *  - Write endpoints (POST /api/escrows, etc.): 30 req / 60s per IP
 *  - Read endpoints: 120 req / 60s per IP
 *
 * These numbers are intentionally conservative. Raise them once you add
 * proper authn and per-user quotas.
 */

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});

export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});

/**
 * Very tight limiter for the SSE stream endpoint to prevent connection floods.
 * Each client should only open one stream; 10 per IP per minute is generous.
 */
export const sseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many stream connections from this IP.' },
});
