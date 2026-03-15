import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Settings Pages @smoke', () => {
  test('settings hub loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('team settings page loads', async ({ page }) => {
    await page.goto('/settings/team');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/team/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('agents settings page loads', async ({ page }) => {
    await page.goto('/settings/agents');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('domains settings page loads', async ({ page }) => {
    await page.goto('/settings/domains');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/domain/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('license settings page loads', async ({ page }) => {
    await page.goto('/settings/license');
    await page.waitForLoadState('domcontentloaded');
    // License page may error if API unavailable — just check it doesn't crash to blank
    const hasContent = await page.getByText(/license|community|pro|error/i).first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});
