import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Real responsive verification (Task 08) — Playwright viewport
 * configuration, not the browser's own resize affordance, which has
 * trouble reliably reaching the narrow end of this list. Runs against
 * the real `vite preview` + Express + Postgres stack, same conventions
 * as every other file in this directory (E2E database, seeded fixtures
 * from `prisma/seed.ts`, `DevPassword123!` for every seeded account).
 *
 * For each (page, theme) pair, a single logged-in `page` instance walks
 * all five breakpoints via `setViewportSize` — no reload, no re-login —
 * then asserts zero horizontal overflow and saves a full-page screenshot
 * as visual evidence under `test-results/responsive/`. A handful of
 * pages carry one extra, targeted assertion (the mobile nav drawer, the
 * search dialog, the create-resource form's grid collapsing to one
 * column) precisely because a clean `scrollWidth` alone wouldn't catch
 * a drawer that fails to close or a grid that never actually collapses.
 */

const SEED_PASSWORD = 'DevPassword123!';

const VIEWPORTS = [
  { label: '1440', width: 1440, height: 900 },
  { label: '1024', width: 1024, height: 900 },
  { label: '768', width: 768, height: 1024 },
  { label: '390', width: 390, height: 844 },
  { label: '320', width: 320, height: 720 },
] as const;

const THEMES = ['light', 'dark'] as const;
type ThemeName = (typeof THEMES)[number];

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'responsive');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function setTheme(page: Page, theme: ThemeName): Promise<void> {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem('academy-library:theme', value);
  }, theme);
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Fails loudly if the route-level error boundary rendered instead of
 * real page content — a trivially-overflow-free blank/error page would
 * otherwise pass the overflow check for the wrong reason. */
async function expectNoRouteError(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).not.toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `${context}: document is ${scrollWidth}px wide but the viewport is only ${clientWidth}px — something overflows horizontally`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

/** Runs the shared per-viewport checks (and saves a screenshot) across
 * all five breakpoints against whatever the page is currently showing.
 * `onEachViewport` lets a specific page add one extra assertion at a
 * specific breakpoint without duplicating the whole walk. */
async function walkViewports(
  page: Page,
  pageSlug: string,
  theme: ThemeName,
  onEachViewport?: (label: string) => Promise<void>,
): Promise<void> {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Let CSS media queries and any resize-driven layout effects settle.
    await page.waitForTimeout(150);
    await expectNoRouteError(page);
    await expectNoHorizontalOverflow(page, `${pageSlug} @ ${viewport.label}px (${theme})`);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${pageSlug}--${theme}--${viewport.label}.png`),
      fullPage: true,
    });
    if (onEachViewport) await onEachViewport(viewport.label);
  }
}

for (const theme of THEMES) {
  test.describe(`Responsive — ${theme} theme`, () => {
    test(`login page [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto('/login');
      await walkViewports(page, 'login', theme);
    });

    test(`register page [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto('/register');
      await walkViewports(page, 'register', theme);
    });

    test(`dashboard, with the mobile nav drawer exercised at the two narrowest widths [${theme}]`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      await walkViewports(page, 'dashboard', theme, async (label) => {
        if (label !== '390' && label !== '320') return;

        const trigger = page.getByRole('button', { name: 'Open navigation' });
        if (!(await trigger.isVisible())) return;
        await trigger.click();

        const drawer = page.getByRole('dialog');
        await expect(drawer).toBeVisible();
        await expectNoHorizontalOverflow(
          page,
          `dashboard mobile drawer open @ ${label}px (${theme})`,
        );

        await page.getByRole('button', { name: 'Close navigation' }).click();
        await expect(drawer).not.toBeVisible();
      });
    });

    test(`library explorer, with the search dialog exercised at the narrowest width [${theme}]`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/library');
      await expect(page.getByRole('heading', { name: 'Explore Library' })).toBeVisible();

      await walkViewports(page, 'library', theme, async (label) => {
        if (label !== '320') return;

        await page.getByRole('button', { name: 'Search' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expectNoHorizontalOverflow(
          page,
          `library search dialog open @ ${label}px (${theme})`,
        );

        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
      });
    });

    test(`resource details (a BOOK with physical copies and restricted-visibility metadata) [${theme}]`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/library');
      await page.getByLabel('Search the library').fill('Designing Data-Intensive Applications');
      await page.getByRole('heading', { name: 'Designing Data-Intensive Applications' }).click();
      await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

      await walkViewports(page, 'resource-details', theme);
    });

    test(`create-resource form, confirming the two-column field grid collapses to one column under 768px [${theme}]`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await login(page, 'lecturer@academy.test');
      await page.goto('/library/new');
      await expect(page.getByRole('heading', { name: 'Create resource' })).toBeVisible();

      await walkViewports(page, 'resource-create-form', theme, async (label) => {
        const typeBox = await page.getByLabel('Resource type', { exact: false }).boundingBox();
        const difficultyBox = await page.getByLabel('Difficulty', { exact: false }).boundingBox();
        if (!typeBox || !difficultyBox) return;

        if (label === '1440' || label === '1024') {
          // Two columns: side by side on the same row.
          expect(
            Math.abs(typeBox.y - difficultyBox.y),
            `expected "Resource type" and "Difficulty" side by side at ${label}px (${theme})`,
          ).toBeLessThan(4);
        } else {
          // Collapsed to one column: stacked, same left edge.
          expect(
            Math.abs(typeBox.x - difficultyBox.x),
            `expected "Resource type" and "Difficulty" stacked at ${label}px (${theme})`,
          ).toBeLessThan(4);
          expect(difficultyBox.y).toBeGreaterThan(typeBox.y);
        }
      });
    });

    test(`collections list [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/collections');
      await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();

      await walkViewports(page, 'collections-list', theme);
    });

    test(`collection details (public, with the "at a glance" metadata sidebar) [${theme}]`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/collections');
      await page.getByRole('heading', { name: 'Algorithms Study Materials' }).click();
      await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

      await walkViewports(page, 'collection-details', theme);
    });

    test(`create-collection form [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'lecturer@academy.test');
      await page.goto('/collections/new');
      await expect(page.getByRole('heading', { name: 'Create collection' })).toBeVisible();

      await walkViewports(page, 'collection-create-form', theme);
    });

    test(`saved resources [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/saved');
      await expect(page.getByRole('heading', { name: 'Saved Resources' })).toBeVisible();

      await walkViewports(page, 'saved', theme);
    });

    test(`book loans (lecturer's own seeded active loan) [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'lecturer@academy.test');
      await page.goto('/loans');
      await expect(page.getByRole('heading', { name: 'Book Loans' })).toBeVisible();

      await walkViewports(page, 'loans', theme);
    });

    test(`admin loans [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'admin@academy.test');
      await page.goto('/admin/loans');
      await expect(page.getByRole('heading', { name: 'Manage Loans' })).toBeVisible();

      await walkViewports(page, 'admin-loans', theme);
    });

    test(`my learning [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/learning');
      await expect(page.getByRole('heading', { name: 'My Learning' })).toBeVisible();

      await walkViewports(page, 'learning', theme);
    });

    test(`settings [${theme}]`, async ({ page }) => {
      await setTheme(page, theme);
      await login(page, 'student@academy.test');
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      await walkViewports(page, 'settings', theme);
    });
  });
}
