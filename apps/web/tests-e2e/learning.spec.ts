import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of My Learning (Task 07) — entirely
 * read-only, so unlike `physical-library.spec.ts` there is nothing to
 * clean up afterward. Relies on the seed's own course/tag associations
 * (see `prisma/seed.ts`'s `RESOURCE_SEEDS`/`BOOKMARK_SEEDS`): the
 * student account has saved "Introduction to Algorithms" and "Big-O
 * Notation Explained," both tagged `algorithms` and both in the
 * "Algorithms & Data Structures" course — "Binary Search Practice Set"
 * shares both and is not itself saved, so it is the one concrete,
 * predictable recommendation this suite can assert on without
 * depending on exact ordering or scoring internals.
 */

const SEED_PASSWORD = 'DevPassword123!';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('My Learning — real Learning API', () => {
  test('groups resources by course and shows accessible collections', async ({ page }) => {
    await login(page, 'lecturer@academy.test');
    await page.goto('/learning');

    await expect(page.getByRole('heading', { name: 'Algorithms & Data Structures' })).toBeVisible();
    // `.first()` — the same resource can legitimately appear in more
    // than one section (e.g. also under "Recently added"), which is
    // correct behavior, not something this existence check needs to
    // disambiguate.
    await expect(page.getByText('Big-O Notation Explained').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Collections you can explore' })).toBeVisible();
    await expect(page.getByText('Algorithms Study Materials').first()).toBeVisible();
  });

  test('recommends a resource sharing a course and tag with something the viewer saved, with a transparent reason', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/learning');

    await expect(page.getByRole('heading', { name: 'Recommended for you' })).toBeVisible();
    await expect(page.getByText('Binary Search Practice Set').first()).toBeVisible();
    await expect(page.getByText(/Algorithms & Data Structures|algorithms/).first()).toBeVisible();
  });
});
