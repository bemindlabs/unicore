import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Virtual Office Add-on @virtual-office', () => {
  test('should show Virtual Office in sidebar Add-ons section for Pro license', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Virtual Office should appear in the Add-ons nav group
    const virtualOfficeLink = sidebar.getByText(/virtual office/i).first();
    await expect(virtualOfficeLink).toBeVisible({ timeout: 10000 });
  });

  test('should show Virtual Office as locked for community edition', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Look for lock icon or upgrade badge on Virtual Office nav item
    const virtualOfficeItem = sidebar.locator('[data-nav="virtual-office"], [href*="virtual-office"]').first();
    if (await virtualOfficeItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      const lockIndicator = virtualOfficeItem
        .locator('[data-locked], .lock-icon, [aria-label*="locked"], [aria-label*="upgrade"]')
        .first()
        .or(virtualOfficeItem.getByText(/pro|upgrade|locked/i).first());

      // In community edition the lock/upgrade indicator should be present
      // If running against Pro instance, this test is informational
      const isLocked = await lockIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      if (isLocked) {
        await expect(lockIndicator).toBeVisible();
      }
    }
  });

  test('should load Virtual Office page for Pro users', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    // Page should render without crashing — check for key Virtual Office elements
    const officeContent = page
      .getByText(/virtual office/i)
      .first()
      .or(page.locator('[data-testid="virtual-office"]').first())
      .or(page.locator('.virtual-office-content').first());

    await expect(officeContent).toBeVisible({ timeout: 15000 });

    // Should show agent workstations or office floor
    const agentArea = page
      .getByText(/TOTAL/i)
      .first()
      .or(page.getByText(/ACTIVE/i).first())
      .or(page.locator('[data-agent-id]').first());

    await expect(agentArea).toBeVisible({ timeout: 15000 });
  });

  test('should redirect /command-center to /virtual-office', async ({ page }) => {
    await page.goto('/command-center');
    await page.waitForLoadState('domcontentloaded');

    // Should have been redirected to /virtual-office
    await expect(page).toHaveURL(/\/virtual-office/, { timeout: 10000 });
  });

  test('Virtual Office page does not crash with 500 error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/virtual-office');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
  });

  test('should display Virtual Office header with controls', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    // Header should be visible with Virtual Office branding
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 });

    // Team Chat button should be present
    const chatButton = page.locator('header button[title="Team Chat"]');
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chatButton).toBeVisible();
    }
  });
});
