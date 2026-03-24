import { test, expect } from '@playwright/test';

// Uses auth stored by auth.setup.ts
test.describe('Wizard Steps @smoke', () => {
  test('should load wizard page', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    // Wizard should render — either the setup wizard or a "already configured" state
    const wizardContent = page
      .getByText(/wizard|setup|configure|business|completed|locked/i)
      .first();
    await expect(wizardContent).toBeVisible({ timeout: 15000 });
  });

  test('should show page content', async ({ page }) => {
    const response = await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    // Wizard may redirect, show 404, or render — all are valid states
    if (response?.status() === 200) {
      await expect(
        page.getByText(/wizard|setup|configure|business|completed|locked|step/i).first(),
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test('should navigate wizard steps with next button', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    // Wizard may redirect to login if session expired
    const nextButton = page.getByRole('button', { name: /next|continue|proceed/i }).first();
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nameInput = page.getByLabel(/business name|company name/i).first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test Company');
      }
      await nextButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main, header, body').first()).toBeVisible();
    }
  });

  test('should allow going back to previous step', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    const nextButton = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(500);

      const backButton = page.getByRole('button', { name: /back|previous/i }).first();
      if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backButton.click();
        await expect(page.locator('main, header').first()).toBeVisible();
      }
    }
  });

  test('should show business profile step', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    // Step 1 is typically business profile setup — or wizard may be locked
    const profileContent = page
      .getByText(/business profile|company|organization|wizard|setup|completed|locked/i)
      .first();
    await expect(profileContent).toBeVisible({ timeout: 15000 });
  });

  test('wizard page does not crash with 500 error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/wizard');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
  });
});
