import { test as setup, expect } from '@playwright/test';

const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@unicore.local');
  await page.getByLabel('Password').fill('Admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/(dashboard)?$/);
  await page.context().storageState({ path: authFile });
});
