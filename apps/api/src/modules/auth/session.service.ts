import type { User } from '@prisma/client';
import { SESSION_TTL_MS } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { generateSessionToken, hashSessionToken } from '../../lib/sessionToken.js';

export interface CreatedSession {
  /** The raw, random token — goes in the cookie, never anywhere else. */
  token: string;
  expiresAt: Date;
}

/**
 * Mints a brand-new session. Always called fresh on every successful
 * login — never reuses or "upgrades" an existing token — which is what
 * prevents session fixation: there is no code path where a
 * client-supplied identifier becomes a valid, privileged session. If the
 * request already carried a session cookie, the login route revokes it
 * separately (see auth.routes.ts); this function has no awareness of
 * that cookie at all.
 */
export async function createSession(userId: string): Promise<CreatedSession> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

export interface ValidatedSession {
  sessionId: string;
  user: User;
}

/**
 * Resolves a raw cookie token to its session + user, or `null` if it
 * doesn't exist or has expired. An expired session is deleted
 * opportunistically on the read that discovers it, rather than requiring
 * a separate cleanup job for correctness (one is still recommended for
 * housekeeping at scale — see docs/architecture/authentication.md,
 * "Known limitations" — this just means expiry is never silently
 * ignored even without it).
 */
export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch((error: unknown) => {
      logger.warn({ err: error, sessionId: session.id }, 'Failed to clean up expired session');
    });
    return null;
  }

  // Best-effort activity marker — must never fail the request that
  // triggered it.
  prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch((error: unknown) => {
      logger.warn({ err: error, sessionId: session.id }, 'Failed to update session lastUsedAt');
    });

  return { sessionId: session.id, user: session.user };
}

/** Used by both logout (revoke the current session) and login (revoke
 * whatever session the request already had, before issuing a new one). */
export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}
