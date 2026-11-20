import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing via `@node-rs/argon2` (napi-rs bindings to the
 * reference Rust `argon2` crate) — a well-maintained implementation, not
 * a hand-rolled one. Argon2id is used explicitly (it's already the
 * library default; naming it here makes the choice self-documenting
 * rather than implicit). The library's default cost parameters
 * (memoryCost 19 MiB, timeCost 2, parallelism 1) match OWASP's published
 * Argon2id baseline recommendation, so they are not overridden — see
 * docs/architecture/authentication.md ("Password hashing").
 *
 * `2` is `@node-rs/argon2`'s `Algorithm.Argon2id` — that type is declared
 * as an ambient `const enum`, which this project's `isolatedModules`
 * setting can't reference directly (ambient const enums require
 * whole-program type info to inline), so the already-known numeric value
 * is used instead of the enum member.
 */
const ARGON2ID = 2;
const HASH_OPTIONS = { algorithm: ARGON2ID };

export function hashPassword(plainTextPassword: string): Promise<string> {
  return hash(plainTextPassword, HASH_OPTIONS);
}

/** Never throws on a malformed/foreign hash — treats it as "does not
 * match" so a corrupt stored value can't become an unhandled rejection
 * on the login path. */
export async function verifyPassword(
  passwordHash: string,
  plainTextPassword: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plainTextPassword, HASH_OPTIONS);
  } catch {
    return false;
  }
}
