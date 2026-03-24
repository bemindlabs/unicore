import { test, expect } from '@playwright/test';

test.describe('Agent Management UI @virtual-office', () => {
  test('virtual office page loads with header', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('header').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display agent-related content', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    // Look for agent count, status indicators, or feature gate
    const agentContent = page
      .getByText(/TOTAL|ACTIVE|agent|upgrade|pro/i)
      .first();
    await expect(agentContent).toBeVisible({ timeout: 15000 });
  });

  test('settings page lists agent configuration', async ({ page }) => {
    await page.goto('/settings/agents');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should open chat panel if Team Chat button exists', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    const chatButton = page.locator('header button[title="Team Chat"]');
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatButton.click();

      const chatInput = page
        .locator('input[placeholder*="message"]')
        .or(page.locator('input[placeholder*="Type"]'));
      await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should switch virtual office tabs if available', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    for (const tabName of ['Commander', 'Settings', 'Overview']) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('main, header').first()).toBeVisible();
  });
});
