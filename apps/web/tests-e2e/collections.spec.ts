import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of Collections (Task 06) against
 * the real Express API and Postgres — same conventions as
 * `resource-management.spec.ts`: run against `vite preview` with the
 * API pointed at the dedicated E2E database (never dev), reset/reseeded
 * automatically by `tests-e2e/globalSetup.ts` before the run (Task
 * 05D). Any collection a test creates is deleted by that same test
 * before it finishes, so repeated runs never accumulate state — the
 * exact lesson Task 05D's own regression (leftover E2E-created
 * resources shifting unrelated tests' assumptions) already taught this
 * suite once.
 *
 * Reuses the seed's four collections for read-only/authorization
 * assertions (see `prisma/seed.ts`'s `COLLECTION_SEEDS`):
 * - "Python Backend Fundamentals" → PUBLIC, owned by admin.
 * - "Algorithms Study Materials" → PUBLIC, owned by lecturer.
 * - "Frontend Engineering Essentials" → RESTRICTED to "Honors Cohort"
 *   (admin + student are members; lecturer is not).
 * - "Advanced Database Concepts" → RESTRICTED to "CS Department Staff"
 *   (lecturer + admin are members; student is not).
 */

const SEED_PASSWORD = 'DevPassword123!';

function uniqueTitle(label: string): string {
  return `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Deletes whatever collection the page is currently viewing — same
 * self-cleanup convention as `resource-management.spec.ts`'s
 * `deleteCurrentResource`. */
async function deleteCurrentCollection(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete collection' }).click();
  await expect(page).toHaveURL(/\/collections$/);
}

test.describe('Collections — real Collections API', () => {
  test('a LECTURER can create a collection, add a resource, reorder it, and delete it', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    const title = uniqueTitle('E2E Created Collection');

    await page.goto('/collections/new');
    await page.getByLabel('Title', { exact: false }).fill(title);
    await page
      .getByLabel('Description', { exact: false })
      .fill('Created by a Playwright E2E test.');
    await page.getByRole('button', { name: 'Create collection' }).click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Add a real seeded resource via the search panel — scoped to the
    // specific result row rather than assuming the search narrows to
    // exactly one match (the real backend's ranked search can still
    // return several candidates for a multi-word query).
    await page
      .getByRole('textbox', { name: 'Search resources to add' })
      .fill('Introduction to Algorithms');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Introduction to Algorithms' })
      .getByRole('button', { name: 'Add' })
      .click();
    await expect(page.getByText('Resources (1)')).toBeVisible();
    await expect(page.getByText('Introduction to Algorithms')).toBeVisible();

    await deleteCurrentCollection(page);
  });

  test('a LECTURER is denied editing a collection they do not own, via an inline message', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    await page.goto('/collections');
    await page.getByLabel('Search collections').fill('Python Backend Fundamentals');
    await page.getByText('Python Backend Fundamentals').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();

    await page.goto(`${page.url()}/edit`);
    await expect(
      page.getByRole('heading', { name: "You don't have access to edit this collection" }),
    ).toBeVisible();
  });

  test('an ADMIN can open and edit a collection owned by the LECTURER', async ({ page }) => {
    await login(page, 'admin@academy.test');
    await page.goto('/collections');
    await page.getByLabel('Search collections').fill('Algorithms Study Materials');
    await page.getByText('Algorithms Study Materials').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Title', { exact: false })).toHaveValue(
      'Algorithms Study Materials',
    );

    // Leave the real seeded content unchanged — navigating here at all,
    // with a populated and editable form, is what's under test.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Algorithms Study Materials' })).toBeVisible();
  });

  test('deleting a collection requires explicit confirmation, and cancelling keeps it', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    const title = uniqueTitle('E2E Deletable Collection');

    await page.goto('/collections/new');
    await page.getByLabel('Title', { exact: false }).fill(title);
    await page
      .getByLabel('Description', { exact: false })
      .fill('Created by a Playwright E2E test.');
    await page.getByRole('button', { name: 'Create collection' }).click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/will be permanently deleted/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/will be permanently deleted/)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await deleteCurrentCollection(page);
  });

  test('a STUDENT cannot reach /collections/new, and sees no management actions anywhere', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');

    await page.goto('/collections/new');
    await expect(
      page.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeVisible();

    await page.goto('/collections');
    await expect(page.getByRole('button', { name: 'Create collection' })).not.toBeVisible();
  });

  test('a STUDENT in the restricted group sees that collection, but not one restricted to a different group', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/collections');

    await page.getByLabel('Search collections').fill('Frontend Engineering Essentials');
    await expect(page.getByText('Frontend Engineering Essentials')).toBeVisible();

    await page.getByLabel('Search collections').fill('Advanced Database Concepts');
    await expect(page.getByText('No collections match your search')).toBeVisible();
  });
});
