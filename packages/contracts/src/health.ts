import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadyResponseSchema = z.object({
  status: z.literal('ok'),
  checks: z.object({
    database: z.literal('ok'),
  }),
  timestamp: z.string().datetime(),
});

export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;

export const NotReadyResponseSchema = z.object({
  status: z.literal('error'),
  checks: z.object({
    database: z.literal('error'),
  }),
  timestamp: z.string().datetime(),
});

export type NotReadyResponse = z.infer<typeof NotReadyResponseSchema>;
