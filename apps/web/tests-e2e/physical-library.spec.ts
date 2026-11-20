import { test, expect, type Page } from '@playwright/test';

/**
 * Genuine browser-level verification of the Physical Library (Task 07)
 * — same conventions as `collections.spec.ts`/`bookmarks.spec.ts`.
 *
 * Deliberately reuses the seed's own physical copies rather than
 * registering a brand-new one: once any copy is ever registered for a
 * resource, that resource can never be deleted again (loan history must
 * be preserved — see `resource.service.ts`'s `deleteResource`), so a
 * test that registered its own throwaway BOOK resource here would leak
 * a permanently undeletable row into the database on every run. Reusing
 * a seeded resource's existing copy and round-tripping its status
 * (AVAILABLE -> ON_LOAN -> AVAILABLE, via a real borrow-then-return)
 * leaves no such residue — the one extra artifact is a single
 * already-`RETURNED` loan row, which nothing else in this suite asserts
 * a count against.
 *
 * `lecturer@academy.test` is the actor for the borrow, not
 * `student@academy.test` — the seed already gives the student account
 * an ACTIVE loan on "Introduction to Algorithms" (see
 * `prisma/seed.ts`'s `LOAN_SEEDS`), which would make a second borrow of
 * the same title 409 on "you already have an active loan for this
 * resource." The lecturer account has no active loan on this title.
 */

const SEED_PASSWORD = 'DevPassword123!';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** `page.goto('/login')` while already authenticated redirects straight
 * back to `/dashboard` (`RedirectIfAuthenticated`) — switching actors
 * mid-test needs an explicit sign-out first, same convention
 * `resources.spec.ts`'s "switching from student to lecturer" test
 * already established. */
async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function readStatValue(page: Page, label: string): Promise<number> {
  const card = page.getByText(label, { exact: true }).locator('..');
  const text = await card.innerText();
  const match = /(\d+)/.exec(text);
  if (!match) throw new Error(`Could not find a numeric value near "${label}": "${text}"`);
  return Number(match[1]);
}

test.describe('Physical Library — real Loans/Inventory API', () => {
  test('a LECTURER borrows an available copy, sees it active, the Dashboard count updates, then an ADMIN processes the return', async ({
    page,
  }) => {
    await login(page, 'lecturer@academy.test');

    await page.goto('/dashboard');
    const loansBefore = await readStatValue(page, 'Active loans');

    await page.goto('/library');
    await page.getByLabel('Search the library').fill('Introduction to Algorithms');
    await page.getByRole('heading', { name: 'Introduction to Algorithms' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    await expect(page.getByRole('heading', { name: 'Physical Copies' })).toBeVisible();
    const borrowButton = page.getByRole('button', { name: 'Borrow a copy' });
    await expect(borrowButton).toBeEnabled();
    await borrowButton.click();
    await expect(page.getByText('Copy borrowed')).toBeVisible();

    await page.goto('/loans');
    await expect(page.getByText('Introduction to Algorithms')).toBeVisible();

    await page.goto('/dashboard');
    const loansAfter = await readStatValue(page, 'Active loans');
    expect(loansAfter).toBe(loansBefore + 1);

    // Clean up — an ADMIN processes the return, the same way a real
    // physical return is confirmed by library staff, not self-reported.
    // Scoped to the lecturer's own row throughout: the seed already
    // gives the student account its own, separate active loan for this
    // same title (see the file's own doc comment), so an unscoped
    // "Introduction to Algorithms"/"Mark returned" match would be
    // ambiguous between the two rows.
    await logout(page);
    await login(page, 'admin@academy.test');
    await page.goto('/admin/loans');
    const lecturerLoanRow = page.getByRole('listitem').filter({ hasText: 'Lee Lecturer' });
    await expect(lecturerLoanRow.getByText('Introduction to Algorithms')).toBeVisible();
    await lecturerLoanRow.getByRole('button', { name: 'Mark returned' }).click();
    await expect(page.getByText('Loan marked returned')).toBeVisible();

    await page.getByRole('tab', { name: 'Returned' }).click();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'Lee Lecturer' })
        .getByText('Introduction to Algorithms'),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Active' }).click();
    await expect(page.getByText('Lee Lecturer')).not.toBeVisible();
  });

  test('registered copies for a BOOK show real availability, including an ARCHIVED one', async ({
    page,
  }) => {
    await login(page, 'student@academy.test');
    await page.goto('/library');
    await page.getByLabel('Search the library').fill('Designing Data-Intensive Applications');
    await page.getByRole('heading', { name: 'Designing Data-Intensive Applications' }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);

    await expect(page.getByRole('heading', { name: 'Physical Copies' })).toBeVisible();
    await expect(page.getByText('INV-DDIA-001')).toBeVisible();
    await expect(page.getByText('INV-DDIA-002')).toBeVisible();
    await expect(page.getByText('Archived')).toBeVisible();

    // A STUDENT has no inventory-management capability — no Register
    // copy field should render for this role.
    await expect(page.getByLabel('New inventory code')).not.toBeVisible();
  });

  test('the seeded overdue loan shows an Overdue badge on the admin’s own /loans page', async ({
    page,
  }) => {
    await login(page, 'admin@academy.test');
    await page.goto('/loans');

    await expect(page.getByText('Advanced Systems Design Reading List')).toBeVisible();
    await expect(page.getByText('Overdue')).toBeVisible();
  });
});
