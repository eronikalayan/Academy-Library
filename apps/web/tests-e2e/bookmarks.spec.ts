import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of Bookmarks (Task 06) — same
 * conventions as `collections.spec.ts`. The seed does pre-populate a
 * few bookmarks (see `prisma/seed.ts`'s `BOOKMARK_SEEDS`), but these
 * tests deliberately exercise a resource that is *not* pre-seeded as
 * saved for the account under test, so each test's own save/unsave
 * action is unambiguous and self-cleaning (ends on the same saved
 * state it started from).
 */

const SEED_PASSWORD = 'DevPassword123!';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Bookmarks — real Bookmarks API', () => {
  test('saving a resource shows it on /saved, and unsaving removes it again', async ({ page }) => {
    await login(page, 'admin@academy.test');
    await page.goto('/library');
    await page.getByLabel('Search the library').fill('Binary Search Practice Set');
    await page.getByRole('heading', { name: 'Binary Search Practice Set' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    await page.goto('/saved');
    await expect(page.getByText('Binary Search Practice Set')).toBeVisible();

    // Clean up — leave this account's saved list exactly as the seed
    // left it, not accumulating a saved resource every run.
    await page.getByText('Binary Search Practice Set').click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: 'Saved' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    await page.goto('/saved');
    await expect(page.getByText('Binary Search Practice Set')).not.toBeVisible();
  });

  test('a STUDENT can save and unsave a resource just like any other authenticated role', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library');
    await page.getByLabel('Search the library').fill('Big-O Notation Explained');
    await page.getByRole('heading', { name: 'Big-O Notation Explained' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    // A STUDENT has no Edit/Delete capability on this resource, but the
    // Save toggle is unconditional — confirming that independence live.
    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Saved' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
