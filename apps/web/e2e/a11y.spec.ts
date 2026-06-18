import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * M7·WS1·T1.1 — automated WCAG 2.1 AA checks on key routes.
 * Map canvas is excluded from the interactive map page; keyboard list fallback
 * covers pin access there (tested in map.spec.ts).
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

async function expectNoViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string {
  if (!violations.length) return '';
  return violations
    .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
    .join('\n\n');
}

test.describe('accessibility (axe)', () => {
  test.setTimeout(60_000);
  test('home page passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PeaceClock' }).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('counter page passes WCAG 2.1 AA', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/c/ukraine/${today}`);
    await expect(page.getByRole('heading', { name: 'PeaceClock' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('methodology page passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible();
    await expectNoViolations(page);
  });
});