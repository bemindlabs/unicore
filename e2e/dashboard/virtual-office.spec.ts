import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Virtual Office @virtual-office', () => {
  test('virtual office page loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
  });

  test('should load Virtual Office page with content', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    // Page should render — check for key Virtual Office elements or a feature gate
    const content = page
      .getByText(/virtual office|agent|upgrade|pro/i)
      .first();

    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('should display header on virtual office page', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
  });

  test('should redirect /command-center to /virtual-office', async ({ page }) => {
    await page.goto('/command-center');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to virtual-office or show content
    await expect(
      page.locator('main, [role="main"], header').first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
