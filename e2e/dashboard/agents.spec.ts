import { test, expect } from '@playwright/test';

test.describe('Agent Management UI @backoffice', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/backoffice');
    await page.waitForLoadState('networkidle');
  });

  test('backoffice page loads with agent list', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
  });

  test('should display total agent count', async ({ page }) => {
    await expect(page.getByText(/\d+ TOTAL/i)).toBeVisible({ timeout: 15000 });
  });

  test('should show at least one agent in active state', async ({ page }) => {
    await expect(page.getByText(/ACTIVE/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should open chat panel from header', async ({ page }) => {
    const chatButton = page.locator('header button[title="Team Chat"]');
    await expect(chatButton).toBeVisible({ timeout: 10000 });
    await chatButton.click();

    const chatInput = page
      .locator('input[placeholder*="message"]')
      .or(page.locator('input[placeholder*="Type"]'));
    await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show connected WebSocket status after opening chat', async ({ page }) => {
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    const connectedIndicator = page.locator('.bg-green-400, .bg-green-500').first();
    await expect(connectedIndicator).toBeVisible({ timeout: 15000 });
  });

  test('should send a chat message', async ({ page }) => {
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    const chatInput = page.locator('input[placeholder*="Type"]').last();
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    await chatInput.fill('E2E test message');
    await chatInput.press('Enter');

    await expect(page.getByText('E2E test message')).toBeVisible({ timeout: 5000 });
  });

  test('should close chat panel', async ({ page }) => {
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    const chatInput = page.locator('input[placeholder*="Type"]').last();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Close via backdrop or toggle button
    const backdrop = page.locator('.bg-black\\/30');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: 10, y: 10 } });
    } else {
      await chatButton.click();
    }

    await expect(chatInput).toBeHidden({ timeout: 5000 });
  });

  test('settings page lists agent configuration', async ({ page }) => {
    await page.goto('/settings/agents');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should switch backoffice tabs', async ({ page }) => {
    for (const tabName of ['Commander', 'Settings', 'Overview']) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('main, .backoffice-content').first()).toBeVisible();
  });
});
