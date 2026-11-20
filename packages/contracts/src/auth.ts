import { z } from 'zod';

/**
 * Authentication contracts, shared between `apps/web` and `apps/api`.
 * These describe request/response shapes only — never a Prisma entity
 * directly (there is no `passwordHash`, `tokenHash`, or raw session token
 * anywhere here; see docs/architecture/authentication.md).
 *
 * `Role` values match `apps/web/src/shared/config/roles.ts`'s `UserRole`
 * exactly (`USER_ROLES`) and the Prisma `Role` enum — one source of truth
 * for the string values, even though each side declares its own type.
 */

export const RoleSchema = z.enum(['STUDENT', 'LECTURER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;
export const ROLES = RoleSchema.options;

export const UserStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

const EmailSchema = z.string().trim().toLowerCase().email().max(255);

/**
 * `.strict()` on purpose: registration only ever creates a `STUDENT`
 * account with `status: ACTIVE` (enforced server-side, not from this
 * input — see the register route). A client sending `role` or `status`
 * fields here must get a 400 validation error, not have them silently
 * stripped — the difference between "rejected" and "ignored" matters for
 * an attempted-privilege-escalation attempt to be visible as an error
 * rather than a quiet no-op.
 */
export const RegisterInputSchema = z
  .object({
    email: EmailSchema,
    // Minimum stronger than the common "8" baseline; maximum guards
    // against pathologically long input being pushed through Argon2id
    // hashing (a cheap way to burn server CPU) rather than reflecting any
    // real strength ceiling.
    password: z.string().min(10, 'Password must be at least 10 characters').max(128),
    displayName: z.string().trim().min(1).max(160),
  })
  .strict();
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z
  .object({
    email: EmailSchema,
    // No minimum-strength check here — a user whose password predates a
    // policy change must still be able to log in. Just bounded so an
    // absurdly long string isn't hashed/compared.
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * The only user shape ever sent to a client. Deliberately excludes
 * `passwordHash` and anything session-related — there is no server code
 * path that constructs this from a raw Prisma `User` without picking
 * these fields explicitly (see `toPublicUser` in `apps/api`).
 */
export const PublicUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  status: UserStatusSchema,
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/** Response from `GET /api/v1/auth/csrf-token` — see
 * docs/architecture/authentication.md ("CSRF strategy"). The token here
 * is intentionally plaintext/readable; the secret half of the pair lives
 * only in an HttpOnly cookie. */
export const CsrfTokenResponseSchema = z.object({
  csrfToken: z.string().min(1),
});
export type CsrfTokenResponse = z.infer<typeof CsrfTokenResponseSchema>;
