import { test as setup } from '@playwright/test';

const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@unicore.dev');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect after login (could go to various pages)
  // After login, page redirects to / (dashboard) — just wait for login page to disappear
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
