import { test, expect } from '@playwright/test';

/**
 * M4·WS4·T4.4 — open map → pan/zoom → filter → open a pin. Full reconciliation
 * of visible cluster counts against map_point needs a seeded DB + tile provider
 * in CI; this spec exercises the flow + shared-state wiring.
 */

test('map loads, controls drive state, deep-link restores', async ({ page }) => {
  await page.goto('/');

  // Map container present (canvas mounts client-side).
  await expect(page.locator('.mapview')).toBeVisible();

  // Shared controls present and wired to URL.
  await page.locator('#asOf').fill('2023-06-01');
  await expect(page).toHaveURL(/\/m\/ukraine\/2023-06-01/);

  const slider = page.locator('#threshold');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(page.locator('.control__value')).toContainText('OSINT');

  // Counter ↔ map navigation preserves date.
  await page.getByRole('link', { name: 'Back to casualty counter' }).click();
  await expect(page).toHaveURL(/\/c\/ukraine\/2023-06-01/);
});

test('deep link restores map state', async ({ page }) => {
  await page.goto('/m/ukraine/2023-06-01?threshold=osint&category=wounded');
  await expect(page.locator('#asOf')).toHaveValue('2023-06-01');
  await expect(page.locator('.control__value')).toContainText('OSINT');
});

test('keyboard list fallback toggles and is navigable', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Show evidence list' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Hide evidence list' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evidence in current map view' })).toBeVisible();

  const listbox = page.getByRole('listbox', { name: 'Evidence pins and clusters' });
  await listbox.focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Show evidence list' })).toBeFocused();
});
