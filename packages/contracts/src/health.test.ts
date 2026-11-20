import { describe, expect, it } from 'vitest';
import { HealthResponseSchema, ReadyResponseSchema } from './health.js';

describe('health contracts', () => {
  it('accepts a valid health response', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      uptimeSeconds: 12.5,
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a ready response missing the database check', () => {
    const result = ReadyResponseSchema.safeParse({
      status: 'ok',
      checks: {},
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});
