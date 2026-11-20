import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { ApiErrorResponseSchema, HealthResponseSchema } from '@academy-library/contracts';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns 200 with an ok status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    const body = HealthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });
});

describe('unknown routes', () => {
  it('returns a structured 404 error', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    const body = ApiErrorResponseSchema.parse(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
