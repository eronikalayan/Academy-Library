import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Authentication / sessions -----------------------------------------
  // Signs the CSRF double-submit token (see src/middleware/csrf.ts) — not a
  // password-hashing secret, just needs to be long and unpredictable.
  // Required (no insecure default) since it's security-critical.
  CSRF_SECRET: z
    .string()
    .min(32, 'CSRF_SECRET must be at least 32 characters — generate with `openssl rand -hex 32`'),
  SESSION_COOKIE_NAME: z.string().min(1).default('academy_session'),
  // Fixed absolute session lifetime from creation — see
  // docs/architecture/authentication.md ("Session lifecycle") for the
  // reasoning. Not a sliding/renewing expiry.
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 30),
  // `z.coerce.boolean()` is deliberately NOT used here — it coerces via
  // `Boolean(value)`, so the string `"false"` (non-empty) would coerce
  // to `true`, silently defeating this exact flag. An explicit
  // `"true"`/`"false"` enum is the only safe way to parse a boolean env
  // var. No default on this field itself — the effective default (see
  // `registrationEnabled` below) depends on `NODE_ENV`, which Zod can't
  // see from inside one field's own definition.
  REGISTRATION_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  // --- Cross-origin deployment escape hatch (Task 08) ---------------------
  // The intended topology (Docker/nginx locally, Vercel rewrites in
  // production — see docs/deployment/free-hosting.md) keeps the browser
  // and this API on one perceived origin, where `SameSite=Lax` is
  // correct and sufficient (see src/lib/cookies.ts). This override exists
  // for the deliberately-unproxied alternative — the frontend calling
  // this API's own origin directly, with no same-origin rewrite in
  // front — which genuinely needs `SameSite=None`. Left unset, behavior
  // is byte-for-byte what it was before this flag existed.
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv(process.env);

export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

/**
 * Safe-by-default registration policy (Task 08): there is no email
 * verification or password-reset flow yet (see
 * docs/architecture/authentication.md, "Known limitations"), so letting
 * anyone self-register on a public production deployment is a real
 * abuse/spam surface with no recovery story. Unset `REGISTRATION_ENABLED`
 * falls back to "on" everywhere except `NODE_ENV=production`, so local
 * dev/test/CI behavior is unchanged without any env file edits, while a
 * production deploy that forgets to set the var fails safe (registration
 * off) rather than fails open. Set `REGISTRATION_ENABLED=true` explicitly
 * to allow public self-registration on a given production deployment.
 */
export const registrationEnabled = env.REGISTRATION_ENABLED ?? env.NODE_ENV !== 'production';

/** Default unchanged (`'lax'`) unless `COOKIE_SAME_SITE` is set — see
 * src/lib/cookies.ts for how `'none'` also forces `Secure` regardless of
 * `NODE_ENV`, since browsers reject `SameSite=None` without it. */
export const cookieSameSite = env.COOKIE_SAME_SITE ?? 'lax';
