import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('Dashboard @smoke', () => {
  test('should load dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.url()).not.toContain('/login');
  });

  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should navigate to ERP contacts', async ({ page }) => {
    await page.goto('/erp/contacts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to ERP orders', async ({ page }) => {
    await page.goto('/erp/orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to ERP inventory', async ({ page }) => {
    await page.goto('/erp/inventory');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to ERP invoicing', async ({ page }) => {
    await page.goto('/erp/invoicing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /invoic/i })).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to workflows', async ({ page }) => {
    await page.goto('/workflows');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/workflow/i).first()).toBeVisible({ timeout: 15000 });
  });
});
