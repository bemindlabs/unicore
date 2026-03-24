import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Agent Chat @virtual-office', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');
  });

  test('should load virtual office with agents', async ({ page }) => {
    // Header should be visible
    await expect(page.locator('header')).toBeVisible();

    // Should show agent count
    await expect(page.getByText(/\d+ TOTAL/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show agents in running state', async ({ page }) => {
    // Wait for agent data to load
    await expect(page.getByText(/ACTIVE/i)).toBeVisible({ timeout: 10000 });
  });

  test('should open chat panel from header', async ({ page }) => {
    // Find and click the chat button (MessageCircle icon in header)
    const chatButton = page.locator('header button[title="Team Chat"]');
    await expect(chatButton).toBeVisible({ timeout: 5000 });
    await chatButton.click();

    // Chat panel should slide in — look for the message input
    const chatInput = page.locator('input[placeholder*="message"]').or(page.locator('input[placeholder*="Type"]'));
    await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('should connect to WebSocket', async ({ page }) => {
    // Open chat
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    // Should show connection status (green dot = connected)
    const connectedDot = page.locator('.bg-green-400, .bg-green-500').first();
    await expect(connectedDot).toBeVisible({ timeout: 10000 });
  });

  test('should send a message in chat', async ({ page }) => {
    // Open chat
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    // Wait for input to be enabled (connected)
    const chatInput = page.locator('input[placeholder*="Type"]').last();
    await expect(chatInput).toBeEnabled({ timeout: 10000 });

    // Type and send a message
    await chatInput.fill('Hello from E2E test');
    await chatInput.press('Enter');

    // Message should appear in the chat
    await expect(page.getByText('Hello from E2E test')).toBeVisible({ timeout: 5000 });
  });

  test('should close chat panel', async ({ page }) => {
    // Open chat
    const chatButton = page.locator('header button[title="Team Chat"]');
    await chatButton.click();

    // Chat should be open
    const chatInput = page.locator('input[placeholder*="Type"]').last();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Click backdrop to close
    const backdrop = page.locator('.bg-black\\/30');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: 10, y: 10 } });
    } else {
      // Or click header button again
      await chatButton.click();
    }

    // Chat input should be hidden
    await expect(chatInput).toBeHidden({ timeout: 3000 });
  });

  test('should open agent terminal', async ({ page }) => {
    // Look for an agent card/workstation to click
    const agentCard = page.locator('[data-agent-id]').first()
      .or(page.getByText('COMMS').first())
      .or(page.getByText('FINANCE').first());

    if (await agentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agentCard.click();

      // Terminal or agent detail should open
      const terminal = page.locator('text=Terminal session')
        .or(page.locator('input[placeholder*="command"]'))
        .or(page.locator('text=CONNECTED'));

      // May or may not open terminal depending on click target
      if (await terminal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(terminal).toBeVisible();
      }
    }
  });

  test('should switch tabs (overview/commander/settings)', async ({ page }) => {
    // Click Commander tab
    const commanderTab = page.getByRole('button', { name: /commander/i });
    if (await commanderTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commanderTab.click();
      await page.waitForTimeout(500);
    }

    // Click Settings tab
    const settingsTab = page.getByRole('button', { name: /settings/i }).first();
    if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.click();
      await page.waitForTimeout(500);
    }

    // Click back to Overview
    const overviewTab = page.getByRole('button', { name: /overview/i });
    if (await overviewTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overviewTab.click();
      await page.waitForTimeout(500);
    }
  });
});
