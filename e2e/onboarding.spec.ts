import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard @smoke', () => {
  test.use({ baseURL: 'http://localhost:3100' });

  test('should load the onboarding page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/business profile|welcome|unicore/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Step 1: should show business templates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/e-commerce/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/freelance/i)).toBeVisible();
    await expect(page.getByText(/saas/i)).toBeVisible();
  });
});
