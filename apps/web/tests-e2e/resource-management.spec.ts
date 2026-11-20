import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of resource create/edit/delete
 * (Task 05C.3) against the real Express API and Postgres, run the same
 * way as `resources.spec.ts` — `vite preview`, API pointed at
 * `academy_library_test`, never the dev database. Unlike that file,
 * these tests DO create/edit/delete rows — always against the
 * disposable test database, and each test creates its own resource
 * (with a unique title) rather than mutating seeded fixtures, so a
 * failure in one test can't leave another in a bad starting state.
 *
 * The seed only provisions one `LECTURER` account
 * (`lecturer@academy.test`) — "a lecturer denied editing another
 * lecturer's resource" is exercised instead against an `ADMIN`-owned
 * seeded resource ("Dataset: Housing Prices (Cleaned)"), which the
 * identical `canModifyResource` policy (`LECTURER AND owner`) denies
 * for the same reason: a lecturer who isn't the owner, full stop.
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

async function createArticle(page: Page, title: string): Promise<void> {
  await page.goto('/library/new');
  await page.getByLabel('Title', { exact: false }).fill(title);
  await page.getByLabel('Description', { exact: false }).fill('Created by a Playwright E2E test.');
  await page.getByLabel('Creator name', { exact: false }).fill('E2E Author');
  await page.getByRole('button', { name: 'Create resource' }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
}

/** Deletes whatever resource the page is currently viewing — used as
 * teardown by every test that creates one, so repeated runs don't pile
 * up resources that shift the (otherwise fixture-stable) newest-sort
 * ordering `resources.spec.ts` relies on for its own, unrelated
 * assertions. Assumes the Delete button is already visible (true for
 * anything this file itself just created, as its owner). */
async function deleteCurrentResource(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete resource' }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test.describe('Resource create/edit/delete — real Resource API', () => {
  test('a LECTURER can create a resource and immediately see it on its own detail page', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    const title = uniqueTitle('E2E Created Article');

    await createArticle(page, title);

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('E2E Author')).toBeVisible();

    await deleteCurrentResource(page);
  });

  test('a LECTURER can edit a resource they own, and the change persists on reload', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    const originalTitle = uniqueTitle('E2E Editable Article');
    await createArticle(page, originalTitle);
    const detailUrl = page.url();

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/edit$/);

    const updatedTitle = `${originalTitle} (updated)`;
    const titleInput = page.getByLabel('Title', { exact: false });
    await titleInput.fill(updatedTitle);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();

    await deleteCurrentResource(page);
  });

  test('a LECTURER is denied editing a resource they do not own, via an inline message', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    await page.goto('/library');
    const searchBox = page.getByLabel('Search the library');
    await searchBox.fill('Dataset: Housing Prices');
    await page.getByRole('heading', { name: 'Dataset: Housing Prices (Cleaned)' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    // No Edit/Delete actions on the detail page for a resource they
    // don't own — the same `capabilities` flag that gates the button
    // here is what EditResourcePage checks directly on navigation.
    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();

    await page.goto(`${page.url()}/edit`);
    await expect(
      page.getByRole('heading', { name: "You don't have access to edit this resource" }),
    ).toBeVisible();
  });

  test('an ADMIN can edit a resource owned by the LECTURER', async ({ page }) => {
    await login(page, 'admin@academy.test');
    await page.goto('/library');
    const searchBox = page.getByLabel('Search the library');
    await searchBox.fill('Introduction to Algorithms');
    await page.getByRole('heading', { name: 'Introduction to Algorithms' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Title', { exact: false })).toHaveValue(
      'Introduction to Algorithms',
    );

    // Leave the real seeded content unchanged — navigating here at all,
    // with a populated and editable form, is what's under test.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Introduction to Algorithms' })).toBeVisible();
  });

  test('deleting a resource requires explicit confirmation, and cancelling keeps it', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');
    const title = uniqueTitle('E2E Deletable Article');
    await createArticle(page, title);

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/will be permanently deleted/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/will be permanently deleted/)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete resource' }).click();

    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByText('Resource deleted')).toBeVisible();
  });

  test('a STUDENT cannot reach /library/new, and sees no management actions anywhere', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');

    await page.goto('/library/new');
    await expect(
      page.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeVisible();

    await page.goto('/library');
    await expect(page.getByRole('button', { name: 'Create resource' })).not.toBeVisible();

    const searchBox = page.getByLabel('Search the library');
    await searchBox.fill('Introduction to Algorithms');
    await page.getByRole('heading', { name: 'Introduction to Algorithms' }).click();
    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
