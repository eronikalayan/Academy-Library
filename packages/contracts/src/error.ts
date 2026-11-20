import { z } from 'zod';

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
