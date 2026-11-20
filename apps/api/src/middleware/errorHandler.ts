import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';

/** `csrf-csrf` throws a plain `http-errors` instance, not an `AppError`
 * — `code: 'EBADCSRFTOKEN'` is the stable identifier it (and the
 * `csurf` library before it) uses, checked structurally rather than by
 * importing its exact error instance/class. */
function isCsrfError(err: unknown): err is { code: 'EBADCSRFTOKEN'; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'EBADCSRFTOKEN';
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId =
    typeof req.id === 'string' ? req.id : typeof req.id === 'number' ? String(req.id) : undefined;

  if (isCsrfError(err)) {
    const body: ApiErrorResponse = {
      error: {
        message: 'Invalid or missing CSRF token',
        code: 'INVALID_CSRF_TOKEN',
        requestId,
      },
    };
    res.status(403).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorResponse = {
      error: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        requestId,
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    }
    const body: ApiErrorResponse = {
      error: {
        message: err.message,
        code: err.code,
        requestId,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  const body: ApiErrorResponse = {
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId,
    },
  };
  res.status(500).json(body);
}
