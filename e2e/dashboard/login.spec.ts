import { test, expect } from '@playwright/test';

// These tests run without stored auth — testing the login flow itself
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Flow @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should show login page with required fields', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should reject empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('notauser@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should remain on login (error shown or redirect blocked)
    await expect(page).toHaveURL(/.*login/);
  });

  test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL || 'admin@unicore.dev');
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD || 'admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('should store JWT token after login', async ({ page, context }) => {
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL || 'admin@unicore.dev');
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD || 'admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });

    // Token should be in localStorage or cookies
    const storage = await context.storageState();
    const hasToken =
      storage.origins.some((o) =>
        o.localStorage.some(
          (item) => item.name.toLowerCase().includes('token') || item.name.toLowerCase().includes('auth'),
        ),
      ) || storage.cookies.some((c) => c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('auth'));

    expect(hasToken).toBeTruthy();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/.*login/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*login/);
  });
});
