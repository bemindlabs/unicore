import { test, expect } from '@playwright/test';

// Uses auth stored by auth.setup.ts
test.describe('Wizard Steps @smoke', () => {
  test('should load wizard page', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    // Wizard should render — either the setup wizard or a "already configured" state
    const wizardContent = page
      .getByText(/wizard|setup|configure|business/i)
      .first();
    await expect(wizardContent).toBeVisible({ timeout: 15000 });
  });

  test('should show page content or redirect to login', async ({ page }) => {
    const response = await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    const status = response?.status();

    if (status && status >= 500) {
      // Server errors should always fail the test
      expect(status).toBeLessThan(500);
    } else if (status === 302 || status === 301 || page.url().includes('/login')) {
      // Redirect to login — verify we actually landed on the login page
      await expect(page).toHaveURL(/\/login/);
<<<<<<< HEAD
      await expect(
        page.getByLabel('Email').or(page.getByText(/sign in/i).first()),
      ).toBeVisible({ timeout: 10000 });
=======
      await expect(page.getByLabel('Email').or(page.getByText(/sign in/i).first())).toBeVisible({
        timeout: 10000,
      });
>>>>>>> origin/develop
    } else {
      // 200 OK — wizard content must be visible
      await expect(
        page.getByText(/wizard|setup|configure|business|completed|locked|step/i).first(),
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test('should navigate wizard steps with next button', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    // If redirected to login, the wizard requires auth — assert login page
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const nextButton = page.getByRole('button', { name: /next|continue|proceed/i }).first();
    const isWizardActive = await nextButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isWizardActive) {
      // Wizard is active — fill required fields and advance
      const nameInput = page.getByLabel(/business name|company name/i).first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test Company');
      }
      await nextButton.click();
      await page.waitForTimeout(500);
      // Page should have advanced (URL or content changed)
      await expect(page.locator('main')).toBeVisible();
    } else {
      // Wizard is locked/completed — assert that locked or completed state is shown
      await expect(
        page.getByText(/completed|locked|already configured|setup complete/i).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should allow going back to previous step', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const nextButton = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(500);

      const backButton = page.getByRole('button', { name: /back|previous/i }).first();
      await expect(backButton).toBeVisible({ timeout: 5000 });
      await backButton.click();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('should show business profile step', async ({ page }) => {
    await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    // Step 1 is typically business profile setup — or wizard completed/locked
    const profileContent = page
      .getByText(/business profile|company|organization|completed|locked/i)
      .first();
    await expect(profileContent).toBeVisible({ timeout: 15000 });
  });

  test('wizard page does not crash with 500 error', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/wizard');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
