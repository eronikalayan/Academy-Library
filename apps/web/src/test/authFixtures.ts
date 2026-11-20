import type { PublicUser } from '@academy-library/contracts';

/**
 * Shared `PublicUser` fixtures for any test that needs to seed
 * `['auth', 'me']` directly (via `queryClient.setQueryData`) rather than
 * going through a mocked network call — the right choice for a
 * component test that only cares "given this user, what renders",
 * not "does the fetch happen correctly" (that's what
 * `features/auth/api/*.test.ts`, using MSW, cover instead).
 */
export const MOCK_STUDENT_USER: PublicUser = {
  id: 'user-student-1',
  email: 'sam.student@example.com',
  displayName: 'Sam Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const MOCK_LECTURER_USER: PublicUser = {
  id: 'user-lecturer-1',
  email: 'lee.lecturer@example.com',
  displayName: 'Lee Lecturer',
  role: 'LECTURER',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const MOCK_ADMIN_USER: PublicUser = {
  id: 'user-admin-1',
  email: 'alex.admin@example.com',
  displayName: 'Alex Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00.000Z',
};
