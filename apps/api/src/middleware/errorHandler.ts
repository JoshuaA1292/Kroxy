import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(
    { err: err.message, stack: err.stack, method: req.method, path: req.path },
    'Unhandled error'
  );
  res.status(500).json({ error: err.message ?? 'Internal server error' });
}
