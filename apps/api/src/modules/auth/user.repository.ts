import type { PublicUser } from '@academy-library/contracts';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Trim + lowercase — the one normalization rule applied before every
 * write and every lookup, so the two always agree on what "the same
 * email" means. The database's `users_email_lower_key` functional index
 * (see prisma/schema.prisma) is the safety net if this is ever bypassed,
 * not the primary mechanism. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The only place a Prisma `User` is turned into the DTO a client is
 * allowed to see — `passwordHash` never leaves this function's input. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { email: normalizeEmail(email) } });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export interface CreateStudentInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

/**
 * The only user-creation path in this task — always `STUDENT`/`ACTIVE`.
 * There is deliberately no parameter for `role` or `status`: a caller
 * cannot accidentally (or maliciously, via a typo'd spread) create
 * anything else through this function, regardless of what a request
 * body contains.
 */
export function createStudentUser(input: CreateStudentInput): Promise<User> {
  return prisma.user.create({
    data: {
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  });
}
