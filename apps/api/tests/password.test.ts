import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

describe('hashPassword / verifyPassword', () => {
  it('produces an Argon2id PHC-formatted hash', async () => {
    const hashed = await hashPassword('correct-horse-battery-staple');
    expect(hashed).toMatch(/^\$argon2id\$/);
  });

  it('never stores the plaintext password in the hash', async () => {
    const plaintext = 'correct-horse-battery-staple';
    const hashed = await hashPassword(plaintext);
    expect(hashed).not.toContain(plaintext);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('verifies a correct password against its hash', async () => {
    const hashed = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(hashed, 'correct-horse-battery-staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(hashed, 'wrong-password')).resolves.toBe(false);
  });

  it('resolves false (does not throw) for a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
