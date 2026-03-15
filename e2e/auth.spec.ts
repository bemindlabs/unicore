import { test, expect } from '@playwright/test';

test.describe('Authentication @smoke', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@email.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error or stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@unicore.local');
    await page.getByLabel('Password').fill('Admin1234');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });
    await expect(page.url()).not.toContain('/login');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForURL(/.*login/, { timeout: 10000 });
  });
});
