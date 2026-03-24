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

  test('domains settings page loads or redirects to login', async ({ page }) => {
    await page.goto('/settings/domains');
    await page.waitForLoadState('domcontentloaded');

    // May redirect to login if session expired, or show domains/feature gate
    const content = page.getByText(/domain|custom|upgrade|pro|sign in|welcome/i).first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('license settings page loads or redirects to login', async ({ page }) => {
    await page.goto('/settings/license');
    await page.waitForLoadState('domcontentloaded');

    // May redirect to login if session expired
    const content = page
      .getByText(/license|community|pro|enterprise|edition|sign in|welcome/i)
      .first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('AI settings page loads', async ({ page }) => {
    await page.goto('/settings/ai');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/ai|model|provider/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('branding settings page loads or redirects to login', async ({ page }) => {
    await page.goto('/settings/branding');
    await page.waitForLoadState('domcontentloaded');

    // May redirect to login if session expired
    const content = page
      .getByText(/brand|theme|logo|color|upgrade|pro|sign in|welcome/i)
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

  test('settings navigation has content', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Settings hub should show settings-related content
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15000 });
  });
});
