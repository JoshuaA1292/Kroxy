import pino from 'pino';

/**
 * Structured logger for the Kroxy API.
 *
 * In development (non-production) pretty-prints logs with colour.
 * In production emits newline-delimited JSON, suitable for log aggregators
 * (Datadog, Cloudwatch, Loki, etc.).
 *
 * Usage:
 *   import { logger } from './lib/logger';
 *   logger.info({ escrowId }, 'Escrow registered');
 *   logger.error({ err, escrowId }, 'Settlement failed');
 */
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    // Redact sensitive fields from all log output
    redact: {
      paths: ['*.privateKey', '*.VERIFIER_PRIVATE_KEY', '*.apiKey'],
      censor: '[REDACTED]',
    },
    base: {
      service: 'kroxy-api',
      env: process.env.NODE_ENV ?? 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,env',
        },
      })
    : undefined
);

/** Create a child logger with a fixed escrowId field on every line. */
export function escrowLogger(escrowId: string) {
  return logger.child({ escrowId: escrowId.slice(0, 18) + '…' });
}
