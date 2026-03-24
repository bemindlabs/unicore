import { test, expect } from '@playwright/test';

test.describe('Agent Management UI @virtual-office', () => {
  test('agents page loads without server error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    const response = await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
    expect(response?.status()).toBeLessThan(500);
  });

  test('should display total agent count', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Page should show a count badge or "TOTAL" label for agents
    const agentCount = page.getByText(/\d+\s*TOTAL/i)
      .or(page.getByText(/\d+\s*agent/i))
      .first();
    await expect(agentCount).toBeVisible({ timeout: 15000 });
  });

  test('should show at least one agent in active state', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // At least one agent should have ACTIVE status (OpenClaw auto-registers 9 agents)
    await expect(page.getByText(/ACTIVE/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should open chat panel from header', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const chatButton = page.locator('header button[title="Team Chat"]');
    await expect(chatButton).toBeVisible({ timeout: 10000 });
    await chatButton.click();

    // Chat input should appear after opening the panel
    const chatInput = page
      .locator('input[placeholder*="message"]')
      .or(page.locator('input[placeholder*="Type"]'));
    await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show connected WebSocket status after opening chat', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    // Green dot indicates connected WebSocket
    const connectedIndicator = page.locator('.bg-green-400, .bg-green-500').first();
    await expect(connectedIndicator).toBeVisible({ timeout: 15000 });
  });

  test('should send a chat message', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    const chatInput = page.locator('input[placeholder*="Type"]').last();
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    await chatInput.fill('E2E test message');
    await chatInput.press('Enter');

    await expect(page.getByText('E2E test message')).toBeVisible({ timeout: 5000 });
  });

  test('should close chat panel', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should switch agent page tabs', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Try switching between available tabs/sections
    for (const tabName of ['Commander', 'Settings', 'Overview']) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    }
    // Page should remain functional after switching tabs
    await expect(page.locator('main').first()).toBeVisible();
  });
});
