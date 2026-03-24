import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Virtual Office @virtual-office', () => {
  test('virtual office page does not crash with 500 error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
  });

  test('virtual office page responds with 200 or 404', async ({ page }) => {
    const response = await page.goto('/virtual-office');
    expect([200, 404]).toContain(response?.status());
  });
});
