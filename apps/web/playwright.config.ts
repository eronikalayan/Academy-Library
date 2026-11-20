import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright is configured here but intentionally not wired into CI yet.
 * It targets the Vite preview server for end-to-end coverage of real
 * user flows once there are business screens worth testing.
 */
export default defineConfig({
  testDir: './tests-e2e',
  // Resets + reseeds the E2E database (academy_library_e2e — see
  // tests-e2e/globalSetup.ts and docs/development.md, "Test database
  // lifecycle") to a known baseline before any test runs, so repeated
  // runs don't depend on whatever a previous run left behind.
  globalSetup: './tests-e2e/globalSetup.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
