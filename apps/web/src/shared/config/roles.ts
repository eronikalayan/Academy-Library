/**
 * User roles the product will eventually enforce server-side. There is no
 * authentication yet (see docs/architecture/decisions.md, Task 03), so
 * nothing here grants or checks real permissions — it only drives which
 * navigation entries are *shown*. Treat any `UserRole` value in this app
 * as a UI preference, never as proof of who the user actually is.
 */
export const USER_ROLES = ['STUDENT', 'LECTURER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_ROLE: UserRole = 'STUDENT';

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'Student',
  LECTURER: 'Lecturer',
  ADMIN: 'Administrator',
};
