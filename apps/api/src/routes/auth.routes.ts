import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { LoginInputSchema, RegisterInputSchema } from '@academy-library/contracts';
import type { AuthResponse } from '@academy-library/contracts';
import { registrationEnabled } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { BASE_COOKIE_OPTIONS, readCookie, SESSION_COOKIE_NAME } from '../lib/cookies.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import { createSession, revokeSessionByToken } from '../modules/auth/session.service.js';
import {
  createStudentUser,
  findUserByEmail,
  toPublicUser,
} from '../modules/auth/user.repository.js';

export const authRouter = Router();

authRouter.get('/auth/csrf-token', issueCsrfToken);

/**
 * Only ever creates a `STUDENT`/`ACTIVE` account — `RegisterInputSchema`
 * is `.strict()` (no `role`/`status` keys accepted at all) and
 * `createStudentUser` has no parameter for either, so there is no code
 * path — not a missed check, a missing capability — by which a request
 * body could create anything else.
 *
 * Express 5 forwards a rejected promise from an async handler to the
 * error middleware automatically (see decisions.md) — no manual
 * try/catch-and-`next` wrapper needed here or in any handler below.
 */
authRouter.post('/auth/register', authRateLimiter, async (req, res) => {
  if (!registrationEnabled) {
    throw AppError.forbidden(
      'Registration is currently disabled on this instance. Please contact an administrator for access.',
    );
  }

  const input = RegisterInputSchema.parse(req.body);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  let created;
  try {
    created = await createStudentUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
  } catch (error) {
    // Lost a race with a concurrent registration for the same email — the
    // `findUserByEmail` check above is TOCTOU-safe only with this
    // fallback; the database's unique index is the actual guarantee.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('An account with this email already exists');
    }
    throw error;
  }

  const body: AuthResponse = { user: toPublicUser(created) };
  res.status(201).json(body);
});

let dummyHashPromise: Promise<string> | undefined;
/** A hash of a fixed, never-real password — verified against on a
 * not-found email so the response takes comparable time whether or not
 * the email exists, instead of returning near-instantly for "no such
 * user" and only hashing when a real user is found (a timing
 * side-channel that would otherwise leak which emails are registered). */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('timing-attack-mitigation-placeholder');
  return dummyHashPromise;
}

authRouter.post('/auth/login', authRateLimiter, async (req, res) => {
  const input = LoginInputSchema.parse(req.body);

  const user = await findUserByEmail(input.email);
  const passwordMatches = await verifyPassword(
    user ? user.passwordHash : await getDummyHash(),
    input.password,
  );

  // Identical error for "no such user" and "wrong password" — see
  // docs/architecture/authentication.md ("Login") for why.
  if (!user || !passwordMatches) {
    throw AppError.unauthorized('Invalid email or password');
  }

  // Only reachable once the password has already been proven correct —
  // revealing "this account is disabled" to someone who does not know
  // the password would itself be an email-enumeration leak.
  if (user.status === 'DISABLED') {
    throw AppError.forbidden('This account has been disabled. Contact support for help.');
  }

  // Session-fixation hygiene: if this request already carried a session
  // cookie, revoke whatever it pointed to before minting a fresh one —
  // never let a pre-existing identifier remain valid across this
  // authentication boundary. `createSession` below always mints a
  // brand-new, unrelated token regardless.
  const existingToken = readCookie(req, SESSION_COOKIE_NAME);
  if (existingToken) {
    await revokeSessionByToken(existingToken);
  }

  const session = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, session.token, {
    ...BASE_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });

  const body: AuthResponse = { user: toPublicUser(user) };
  res.status(200).json(body);
});

/**
 * Deliberately does not require an existing session — "log out" should
 * succeed even if the session already expired or the cookie is missing,
 * rather than 401ing someone who is, functionally, already logged out.
 */
authRouter.post('/auth/logout', async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (token) {
    await revokeSessionByToken(token);
  }
  res.clearCookie(SESSION_COOKIE_NAME, BASE_COOKIE_OPTIONS);
  res.status(204).send();
});

authRouter.get('/auth/me', requireAuth(), (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const body: AuthResponse = { user: req.authUser };
  res.status(200).json(body);
});
