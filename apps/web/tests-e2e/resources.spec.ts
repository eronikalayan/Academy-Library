import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of the Library Explorer against
 * the real Express API and Postgres (not MSW/the mock repository) — see
 * Task 05C.2. Run against `vite preview` with the API pointed at
 * `academy_library_test` (never the dev database), seeded via
 * `pnpm db:seed` (see `apps/api/prisma/seed.ts`) — these tests read that
 * fixture data but never create/modify/delete anything, so they're safe
 * to run repeatedly against the same seeded database.
 *
 * The seed's three group-restricted resources are what make real
 * authorization-aware assertions possible at all:
 * - "Faculty Hiring Committee Notes" → restricted to "CS Department
 *   Staff" (lecturer + admin are members; student is not).
 * - "Honors Thesis Proposal Template" → restricted to "Honors Cohort"
 *   (admin + student are members; lecturer is not).
 * - "Weekly Algorithms Study Group (Restricted)" → restricted to both
 *   groups (visible to all three seeded accounts).
 */

const SEED_PASSWORD = 'DevPassword123!';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function searchLibrary(page: Page, term: string): Promise<void> {
  const searchBox = page.getByLabel('Search the library');
  await searchBox.fill('');
  await searchBox.fill(term);
}

test.describe('Library Explorer — real Resource API', () => {
  test('an anonymous visitor is redirected to /login, but the public API itself genuinely serves public-only resources', async ({
    page,
  }) => {
    // The Library Explorer sits behind this app's authenticated product
    // shell (`RequireAuth`, `app/router/routes.tsx`) — an anonymous
    // visitor never reaches it through the UI at all, even though the
    // backend's own `GET /resources` is intentionally open
    // (`optionalAuth`, see `resources.routes.ts`). That split is a real,
    // pre-existing architectural choice (Task 05C.1's shell), not
    // something this task changes — so this test verifies both halves
    // honestly instead of assuming the frontend route exposes the
    // backend's full anonymous-access policy.
    await page.goto('/library');
    await expect(page).toHaveURL(/\/login/);

    const response = await page.request.get('/api/v1/resources?pageSize=50');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { items: { title: string }[] };
    const titles = body.items.map((item) => item.title);
    expect(titles).toContain('Introduction to Algorithms');
    expect(titles).not.toContain('Faculty Hiring Committee Notes');
    expect(titles).not.toContain('Honors Thesis Proposal Template');
    expect(titles).not.toContain('Weekly Algorithms Study Group (Restricted)');
  });

  test('opening a public resource shows real detail data; an unknown id shows the not-found state', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library');
    await page.getByRole('heading', { name: 'Introduction to Algorithms' }).click();

    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'Introduction to Algorithms' })).toBeVisible();
    await expect(page.getByText('MIT Press')).toBeVisible();
    await expect(page.getByText('R. Kesari')).toBeVisible();

    await page.goto('/library/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('Resource not found')).toBeVisible();
  });

  test('a restricted resource is indistinguishable from a nonexistent one for a signed-in user without access', async ({
    page,
  }) => {
    // `/library/:resourceId` sits behind the same `RequireAuth` shell as
    // `/library` itself (see the previous test) — a fully logged-out
    // visitor hitting *any* resource URL is redirected to /login before
    // ever reaching `ResourceDetailsPage`'s not-found/restricted
    // handling, existent or not. The "a restricted resource's existence
    // is never confirmed" guarantee (`resources.routes.ts`) is therefore
    // only observable between two *signed-in* identities that differ in
    // access — a student (not a "CS Department Staff" member) viewing a
    // lecturer-only resource, here.
    await login(page, 'lecturer@academy.test');
    await page.goto('/library');
    await searchLibrary(page, 'Faculty Hiring Committee Notes');
    await page.getByRole('heading', { name: 'Faculty Hiring Committee Notes' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
    const restrictedUrl = page.url();

    await logout(page);
    await login(page, 'student@academy.test');

    await page.goto(restrictedUrl);
    await expect(page.getByText('Resource not found')).toBeVisible();
  });

  test('a signed-in student sees only the restricted resources their own groups grant', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library');

    await searchLibrary(page, 'Honors Thesis Proposal Template');
    await expect(
      page.getByRole('heading', { name: 'Honors Thesis Proposal Template' }),
    ).toBeVisible();

    await searchLibrary(page, 'Weekly Algorithms Study Group');
    await expect(
      page.getByRole('heading', { name: 'Weekly Algorithms Study Group (Restricted)' }),
    ).toBeVisible();

    // Student is not a "CS Department Staff" member.
    await searchLibrary(page, 'Faculty Hiring Committee Notes');
    await expect(page.getByText('No resources match your search')).toBeVisible();

    // Search itself is real-backend-driven, not just visibility.
    await searchLibrary(page, 'gradient descent');
    await expect(
      page.getByRole('heading', { name: 'A Gentle Introduction to Gradient Descent' }),
    ).toBeVisible();
    await expect(page.getByText(/Showing 1–1 of 1 resource/)).toBeVisible();
  });

  test('switching from student to lecturer in the same browser session leaves no previous-user restricted content visible', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library');
    await searchLibrary(page, 'Honors Thesis Proposal Template');
    await expect(
      page.getByRole('heading', { name: 'Honors Thesis Proposal Template' }),
    ).toBeVisible();

    await logout(page);
    await login(page, 'lecturer@academy.test');
    await page.goto('/library');

    // The student-only restricted resource must not leak into the new
    // (lecturer) session's cache.
    await searchLibrary(page, 'Honors Thesis Proposal Template');
    await expect(page.getByText('No resources match your search')).toBeVisible();

    // The lecturer's own restricted resource is visible, confirming this
    // is a real per-identity result, not just an empty cache.
    await searchLibrary(page, 'Faculty Hiring Committee Notes');
    await expect(
      page.getByRole('heading', { name: 'Faculty Hiring Committee Notes' }),
    ).toBeVisible();
  });

  test('a filtered and sorted library URL is shareable and reproduces the same real results on direct load', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library?type=BOOK&sort=title_asc');

    await expect(
      page.getByRole('heading', { name: 'Advanced Systems Design Reading List' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'A Gentle Introduction to Gradient Descent' }),
    ).toHaveCount(0);
  });
});
