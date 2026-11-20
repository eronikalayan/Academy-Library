import { test, expect } from '@playwright/test';

test('home page renders the Academy Library heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Academy Library' })).toBeVisible();
});
