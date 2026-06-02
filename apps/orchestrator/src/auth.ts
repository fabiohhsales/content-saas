import type { NextFunction, Request, Response } from 'express';
import { getEnv } from './env.js';

export function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const env = getEnv();
  const secret = req.header('x-internal-secret');
  if (secret !== env.INTERNAL_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
