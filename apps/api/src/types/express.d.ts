import type { PublicUser } from '@academy-library/contracts';

// Namespaced as `authUser`/`authSessionId` rather than the more generic
// `user`/`sessionId` so it's unambiguous at every call site which
// middleware populated them and that they came through this app's own
// session auth (not, say, some other middleware's unrelated `req.user`).
declare global {
  namespace Express {
    interface Request {
      /** Set by `optionalAuth`/`requireAuth` once the session cookie has
       * been resolved against the database. Absent on anonymous requests
       * — always a presence check, never assume it's set. */
      authUser?: PublicUser;
      /** The resolved session row's id, set alongside `authUser`. Used by
       * `POST /auth/logout` to revoke exactly this session. */
      authSessionId?: string;
      /** Set by `ensureCsrfScope` on every request — the identifier the
       * CSRF double-submit token is bound to before a session exists
       * (see src/middleware/csrf.ts). */
      csrfScopeId?: string;
    }
  }
}

export {};
