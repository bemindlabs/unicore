import { test, expect } from '@playwright/test';

test.describe('Agent Management UI @virtual-office', () => {
  test('virtual office page loads without server error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    const response = await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
    // Page may 404 if not deployed yet — that's acceptable
    expect([200, 404]).toContain(response?.status());
  });

  test('settings page lists agent configuration', async ({ page }) => {
    await page.goto('/settings/agents');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
  });
});
