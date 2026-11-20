import { describe, expect, it } from 'vitest';
import {
  AuthResponseSchema,
  LoginInputSchema,
  PublicUserSchema,
  RegisterInputSchema,
} from './auth.js';

describe('RegisterInputSchema', () => {
  it('normalizes email to trimmed lowercase', () => {
    const result = RegisterInputSchema.parse({
      email: '  Alice@Example.COM  ',
      password: 'correct-horse-battery',
      displayName: 'Alice',
    });
    expect(result.email).toBe('alice@example.com');
  });

  it('rejects a password shorter than 10 characters', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'alice@example.com',
      password: 'short1',
      displayName: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'not-an-email',
      password: 'correct-horse-battery',
      displayName: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an attempt to smuggle a role field in (privilege escalation attempt)', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'alice@example.com',
      password: 'correct-horse-battery',
      displayName: 'Alice',
      role: 'ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an attempt to smuggle a status field in', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'alice@example.com',
      password: 'correct-horse-battery',
      displayName: 'Alice',
      status: 'ACTIVE',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginInputSchema', () => {
  it('does not enforce a minimum password length', () => {
    const result = LoginInputSchema.safeParse({ email: 'alice@example.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('normalizes email the same way as registration', () => {
    const result = LoginInputSchema.parse({ email: '  Alice@Example.COM  ', password: 'x' });
    expect(result.email).toBe('alice@example.com');
  });
});

describe('PublicUserSchema', () => {
  it('accepts a well-formed public user', () => {
    const result = PublicUserSchema.safeParse({
      id: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'STUDENT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = PublicUserSchema.safeParse({
      id: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'SUPERUSER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('AuthResponseSchema', () => {
  it('wraps a public user', () => {
    const result = AuthResponseSchema.safeParse({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.success).toBe(true);
  });
});
