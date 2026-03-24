import { test, expect } from '@playwright/test';

// storageState is already set by the 'dashboard' project config — no need for test.use()

test.describe('Virtual Office @virtual-office', () => {
  test('virtual office page does not crash with 500 error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('virtual office page responds with valid status', async ({ page }) => {
    const response = await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    const status = response?.status() ?? 0;
    // 5xx is never acceptable
    expect(status).toBeLessThan(500);
    // Should be 200 (page exists) or redirect to /agents or 404 (not deployed yet)
    expect([200, 301, 302, 307, 308, 404]).toContain(status);
  });

  test('virtual office shows heading or redirects to agents', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    const url = page.url();

    if (url.includes('/agents')) {
      // Redirected to /agents — verify the agents page loaded
      await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/agent/i).first()).toBeVisible({ timeout: 10000 });
    } else if (url.includes('/login') || url.includes('/sign-in')) {
      // Auth redirect — verify login page
      await expect(page).toHaveURL(/\/(login|sign-in)/);
    } else {
      // Rendered the virtual office page directly — check for meaningful content
      const heading = page
        .getByRole('heading', { name: /virtual office|agents|team/i })
        .or(page.getByText(/virtual office|agent/i).first());
      await expect(heading).toBeVisible({ timeout: 15000 });
    }
  });

  test('virtual office displays agent list or empty state', async ({ page }) => {
    await page.goto('/virtual-office');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login') || page.url().includes('/sign-in')) {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
      return;
    }

    // Should show agent cards/list or a placeholder when no agents exist
    const agentContent = page
      .getByText(/ACTIVE/i)
      .or(page.getByText(/\d+\s*TOTAL/i))
      .or(page.getByText(/no agent|get started|add agent/i))
      .first();
    await expect(agentContent).toBeVisible({ timeout: 15000 });
  });

  test('virtual office navigation entry exists in sidebar', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login') || page.url().includes('/sign-in')) {
      await expect(page).toHaveURL(/\/(login|sign-in)/);
      return;
    }

    // The sidebar should contain a "Virtual Office" link
    const virtualOfficeLink = page
      .locator('nav a[href*="virtual-office"]')
      .or(page.locator('a').filter({ hasText: /virtual office/i }))
      .first();
    await expect(virtualOfficeLink).toBeVisible({ timeout: 10000 });
  });
});
