import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodTypeAny } from 'zod';
import { config } from '../config/env';
import { badRequest, HttpError, notFound, unauthorized } from '../utils/errors';

export interface AuthUser {
  id: number;
  email: string;
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ sub: String(user.id), email: user.email }, config.jwtSecret, { expiresIn: config.accessTokenTtl } as jwt.SignOptions);
}

function parseBearer(req: Request): AuthUser | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    const p = jwt.verify(h.slice(7), config.jwtSecret) as jwt.JwtPayload;
    return { id: Number(p.sub), email: String(p.email) };
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const user = parseBearer(req);
  if (!user) return next(unauthorized('Invalid or expired access token'));
  req.user = user;
  next();
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const user = parseBearer(req);
  if (user) req.user = user;
  next();
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(badRequest('Validation failed', details));
    }
    if (source === 'body') req.body = result.data;
    else (req as any).validatedQuery = result.data;
    next();
  };

export const q = <T = any>(req: Request): T => (req as any).validatedQuery as T;

export const idParam = (req: Request, name = 'id'): number => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
};

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(notFound('Route not found'));
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
  }
  if (err?.code === '23514' || err?.code === '23505' || err?.code === '23503') {
    return res.status(409).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Request conflicts with existing data' } });
  }
  if (!config.isTest) console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
}

export { z };
