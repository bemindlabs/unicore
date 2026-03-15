import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

test.describe('ERP CRUD Operations @critical', () => {
  test('Contacts page loads', async ({ page }) => {
    await page.goto('/erp/contacts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 15000 });
  });

  test('Orders page loads', async ({ page }) => {
    await page.goto('/erp/orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 15000 });
  });

  test('Inventory page loads', async ({ page }) => {
    await page.goto('/erp/inventory');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible({ timeout: 15000 });
  });

  test('Invoicing page loads', async ({ page }) => {
    await page.goto('/erp/invoicing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /invoic/i })).toBeVisible({ timeout: 15000 });
  });

  test('Can open new contact dialog', async ({ page }) => {
    await page.goto('/erp/contacts');
    await page.waitForLoadState('domcontentloaded');
    const addButton = page.getByRole('button', { name: /new contact/i });
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();
    // Dialog should appear
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 });
  });
});
