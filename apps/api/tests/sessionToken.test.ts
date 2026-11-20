import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken } from '../src/lib/sessionToken.js';

describe('generateSessionToken', () => {
  it('generates a URL-safe, sufficiently long random token', () => {
    const token = generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never generates the same token twice', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateSessionToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe('hashSessionToken', () => {
  it('is deterministic for the same input', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('produces a 64-character hex SHA-256 digest', () => {
    const digest = hashSessionToken('any-token-value');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never contains the original token value', () => {
    const token = generateSessionToken();
    const digest = hashSessionToken(token);
    expect(digest).not.toContain(token);
  });

  it('produces different hashes for different tokens', () => {
    const digestA = hashSessionToken(generateSessionToken());
    const digestB = hashSessionToken(generateSessionToken());
    expect(digestA).not.toBe(digestB);
  });
});
