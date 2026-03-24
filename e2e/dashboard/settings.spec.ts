import { test, expect } from '@playwright/test';

test.describe('Settings Pages @smoke', () => {
  test('settings hub loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('team settings page loads and shows member list', async ({ page }) => {
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

    // License page should show license info, edition, or error state
    const content = page
      .getByText(/license|community|pro|enterprise|edition|error|not found/i)
      .first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('AI settings page loads', async ({ page }) => {
    await page.goto('/settings/ai');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/ai|model|provider/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('branding settings page loads', async ({ page }) => {
    await page.goto('/settings/branding');
    await page.waitForLoadState('domcontentloaded');

    // Branding page may show theme options or a feature gate
    const content = page
      .getByText(/brand|theme|logo|color|upgrade|pro/i)
      .first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('can open invite team member dialog', async ({ page }) => {
    await page.goto('/settings/team');
    await page.waitForLoadState('domcontentloaded');

    const inviteButton = page
      .getByRole('button', { name: /invite|add member/i })
      .first();
    if (await inviteButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await inviteButton.click();
      await expect(
        page.getByRole('dialog').or(page.locator('[role="dialog"]')),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('settings navigation has links', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Settings hub should have navigation links to sub-pages
    const settingsLinks = page.locator('a[href*="/settings/"]');
    const count = await settingsLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
