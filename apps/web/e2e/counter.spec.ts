import { test, expect } from '@playwright/test';

/**
 * M2·WS5·T5.4 — load → scrub date → move threshold → toggle category → open a
 * source. Validates the flow + URL/state wiring. Exact-number cross-checks
 * against the engine require a seeded fixture DB (CI); with an empty DB the
 * counter still renders and the controls still drive URL/label state.
 */

test('counter flow: load, scrub, threshold, category, source', async ({ page }) => {
  await page.goto('/');

  // Loads with the headline present (SSR).
  await expect(page.getByRole('heading', { name: 'PeaceClock' })).toBeVisible();
  await expect(page.locator('.matrix__table').first()).toBeVisible();

  // Scrub date → URL reflects /c/:theater/:date.
  await page.locator('#asOf').fill('2023-06-01');
  await expect(page).toHaveURL(/\/c\/ukraine\/2023-06-01/);

  // Move threshold slider → output label updates, no navigation/reload.
  const slider = page.locator('#threshold');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(page.locator('.control__value')).toContainText('OSINT');

  // Toggle category → wounded selected.
  await page.getByRole('radio', { name: 'Wounded' }).click();
  await expect(page.getByRole('radio', { name: 'Wounded' })).toHaveAttribute('aria-checked', 'true');

  // Open a source if any non-zero cell exists.
  const link = page.locator('.cell--link').first();
  if (await link.count()) {
    await link.click();
    await expect(page.locator('.cell__sources')).toBeVisible();
  }
});

test('legacy deep link redirects to theater-prefixed URL', async ({ page }) => {
  await page.goto('/c/2023-06-01?threshold=osint&category=wounded');
  await expect(page).toHaveURL(/\/c\/ukraine\/2023-06-01\?threshold=osint&category=wounded/);
});

test('deep link restores state on refresh', async ({ page }) => {
  await page.goto('/c/ukraine/2023-06-01?threshold=osint&category=wounded');
  await expect(page.locator('#asOf')).toHaveValue('2023-06-01');
  await expect(page.locator('.control__value')).toContainText('OSINT');
  await expect(page.getByRole('radio', { name: 'Wounded' })).toHaveAttribute('aria-checked', 'true');
});
