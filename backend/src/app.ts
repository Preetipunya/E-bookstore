import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/http';
import { router } from './routes';

function loadOpenApi(): object | null {
  const candidates = [process.env.OPENAPI_PATH, path.resolve(__dirname, '../../docs/openapi.yaml'), path.resolve(__dirname, '../docs/openapi.yaml'), path.resolve(process.cwd(), 'docs/openapi.yaml')].filter(Boolean) as string[];
  const f = candidates.find((p) => fs.existsSync(p));
  return f ? YAML.parse(fs.readFileSync(f, 'utf8')) : null;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  if (!config.isTest) {
    app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } } }));
  }

  const spec = loadOpenApi();
  if (spec) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Book Worm API' }));
    app.get('/api/openapi.json', (_req, res) => res.json(spec));
  }

  app.use('/api', router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
