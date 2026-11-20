export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational = true;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static serviceUnavailable(message: string, details?: unknown): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE', details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later'): AppError {
    return new AppError(message, 429, 'RATE_LIMITED');
  }
}
