import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of entropy — well beyond what's practically guessable. */
const TOKEN_BYTES = 32;

/**
 * The raw, cryptographically random session token. This is the only
 * place it exists in plaintext outside the client's cookie — it is never
 * logged, never returned in a response body, and never stored (only its
 * hash is, via `hashSessionToken`). `randomBytes` is Node's CSPRNG
 * (backed by the OS entropy source), not a custom algorithm.
 */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * SHA-256, not Argon2id, on purpose: this hashes a value that is already
 * uniformly random with 256 bits of entropy, not a low-entropy,
 * human-chosen password — there is nothing for a slow, memory-hard hash
 * to defend against here that the token's own entropy doesn't already
 * provide, and session validation happens on every authenticated
 * request, where a deliberately slow hash would add real latency for no
 * security benefit. What this protects against is a stolen database
 * dump: an attacker gets `tokenHash` values, not usable session tokens.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
