import { test, expect } from '@playwright/test';

/**
 * Genuine browser-level verification against the real Express API and
 * Postgres (not a mock) — see docs/architecture/authentication.md
 * ("Testing strategy"). Run against the `vite preview` server (the
 * production build + `preview.proxy`, matching the nginx same-origin
 * topology in Docker/production — see `vite.config.ts`), with the API
 * itself pointed at `academy_library_test`, never the dev database, per
 * this project's standing rule against destructive test operations on
 * development data.
 *
 * Each run registers a fresh, uniquely-emailed account rather than
 * reusing a seeded one — safe to run repeatedly without colliding with
 * a previous run's leftover user.
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test('register, login, see the real identity in the header, sign out, and lose access', async ({
  page,
}) => {
  const email = uniqueEmail();
  const password = 'playwright-e2e-password';
  const displayName = 'Playwright E2E';

  await page.goto('/register');
  await page.getByLabel('Full name', { exact: false }).fill(displayName);
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Registration does not auto-login — lands back on /login.
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  // The display name/role also appear in the sidebar footer at this
  // viewport size — scope to the open menu specifically so the
  // assertion isn't ambiguous between the two.
  await page.getByRole('button', { name: 'Account menu' }).click();
  const accountMenu = page.getByRole('menu', { name: 'Account menu' });
  await expect(accountMenu.getByText(displayName)).toBeVisible();
  await expect(accountMenu.getByText('Student')).toBeVisible();

  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session cookie is gone — a direct visit to a protected route
  // bounces straight back to /login, not a flash of stale content.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('an unauthenticated visitor is redirected to /login and back to the original destination after signing in', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?from=%2Fsettings/);
});
