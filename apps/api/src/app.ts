import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { corsOrigins } from './config/env.js';
import { logger } from './lib/logger.js';
import { ensureCsrfScope, csrfProtection } from './middleware/csrf.js';
import { validateOrigin } from './middleware/validateOrigin.js';
import { apiV1Router } from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id = typeof existing === 'string' ? existing : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // Never let a session token, CSRF secret, or password reach a log
      // line — `censor` replaces the value in place rather than dropping
      // the key, so it's visible *that* a cookie/credential was present
      // without ever printing it. See docs/architecture/authentication.md
      // ("Request security").
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
          'req.body.password',
        ],
        censor: '[redacted]',
      },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(validateOrigin());
  app.use(ensureCsrfScope());
  app.use(csrfProtection);

  app.use('/api/v1', apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
