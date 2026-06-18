import { defineConfig, devices } from '@playwright/test';

/**
 * M2·WS5·T5.4 E2E. Requires a seeded DB and `npx playwright install` in CI.
 * The webServer launches `next dev` with the same env the app validates.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? 'fake',
      VOYAGE_API_KEY: process.env.VOYAGE_API_KEY ?? 'fake',
    },
  },
});
