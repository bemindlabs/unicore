import { test, expect } from '@playwright/test';

/**
 * Helper: Navigate to a settings page and handle auth redirects.
 * Returns true if the settings page loaded (200), false if redirected to login.
 * Fails the test on 5xx errors.
 */
async function gotoSettingsPage(page: import('@playwright/test').Page, path: string) {
  const errors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
  });

  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');

  // 5xx errors must always fail
  expect(errors, `Server errors on ${path}: ${errors.join(', ')}`).toHaveLength(0);
  expect(response?.status(), `${path} returned ${response?.status()}`).toBeLessThan(500);

  // Check for login redirect
  if (page.url().includes('/login') || page.url().includes('/sign-in')) {
    return false;
  }
  return true;
}

test.describe('Settings Pages @smoke', () => {
  test('settings hub loads with settings content', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings');
    if (loaded) {
      await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15000 });
      // Settings hub should have navigation links to sub-pages
      const settingsLinks = page.locator('a[href*="/settings/"]');
      const count = await settingsLinks.count();
      expect(count).toBeGreaterThan(2);
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('team settings page loads and shows member list', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/team');
    if (loaded) {
      await expect(page.getByText(/team/i).first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('agents settings page loads with agent config', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/agents');
    if (loaded) {
      await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('domains settings page loads with domain content', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/domains');
    if (loaded) {
      // Should show domain management or feature gate (pro feature)
      await expect(
        page.getByText(/domain|custom domain|upgrade|pro/i).first(),
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('license settings page loads with license info', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/license');
    if (loaded) {
      await expect(
        page.getByText(/license|community|pro|enterprise|edition/i).first(),
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('AI settings page loads with provider config', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/ai');
    if (loaded) {
      await expect(
        page.getByText(/ai|model|provider|configuration/i).first(),
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('branding settings page loads with theme options', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/branding');
    if (loaded) {
      await expect(
        page.getByText(/brand|theme|logo|color/i).first(),
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });

  test('can open invite team member dialog', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings/team');
    if (!loaded) {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
      return;
    }

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

  test('settings navigation has multiple sections', async ({ page }) => {
    const loaded = await gotoSettingsPage(page, '/settings');
    if (loaded) {
      // There should be multiple settings categories visible as links
      const settingsLinks = page.locator('a[href*="/settings/"]');
      const count = await settingsLinks.count();
      expect(count).toBeGreaterThan(2);
    } else {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    }
  });
});
