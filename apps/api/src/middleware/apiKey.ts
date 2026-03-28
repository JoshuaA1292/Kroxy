import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { logger } from '../lib/logger';

/**
 * API key authentication middleware.
 *
 * Set API_KEY_HASH in your environment to enable auth:
 *   API_KEY_HASH=$(echo -n "your-secret-key" | sha256sum | awk '{print $1}')
 *
 * Clients send the raw key in the X-Kroxy-API-Key header.
 * We compare SHA-256(received_key) against API_KEY_HASH using a
 * timing-safe comparison to prevent timing-based enumeration attacks.
 *
 * If API_KEY_HASH is not set, auth is skipped (development mode).
 */

const EXPECTED_HASH = process.env.API_KEY_HASH;

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  // Auth disabled in development
  if (!EXPECTED_HASH) {
    next();
    return;
  }

  const rawKey = req.headers['x-kroxy-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    logger.warn({ ip: req.ip, path: req.path }, 'Missing API key');
    res.status(401).json({ error: 'Missing X-Kroxy-API-Key header' });
    return;
  }

  const receivedHash = createHash('sha256').update(rawKey).digest('hex');

  // Timing-safe comparison — prevents enumeration via response time
  const expected = Buffer.from(EXPECTED_HASH, 'utf8');
  const received = Buffer.from(receivedHash, 'utf8');

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    logger.warn({ ip: req.ip, path: req.path }, 'Invalid API key');
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
