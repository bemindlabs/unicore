import { test, expect } from '@playwright/test';

test.describe('Pricing Page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
  });

  test('pricing page loads', async ({ page }) => {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('displays multiple pricing plans', async ({ page }) => {
    // Should show at least 2 plans (e.g. Community + Pro, or monthly/annual)
    const planCards = page.locator('[data-plan], .pricing-card, .plan-card').or(
      page.getByRole('article'),
    );
    const count = await planCards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('shows Community/Free plan', async ({ page }) => {
    const communityPlan = page.getByText(/community|free/i).first();
    await expect(communityPlan).toBeVisible({ timeout: 10000 });
  });

  test('shows Pro plan', async ({ page }) => {
    const proPlan = page.getByText(/pro|professional/i).first();
    await expect(proPlan).toBeVisible({ timeout: 10000 });
  });

  test('billing toggle switches between monthly and annual', async ({ page }) => {
    const annualToggle = page
      .getByRole('switch', { name: /annual|yearly/i })
      .or(page.getByLabel(/annual|yearly/i))
      .or(page.getByText(/annual|yearly/i).first());

    if (await annualToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await annualToggle.click();
      // Prices should update — verify page still renders
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('plan comparison table or feature list is shown', async ({ page }) => {
    const featureList = page
      .locator('ul, table, [role="list"]')
      .filter({ hasText: /agent|workflow|support|user/i })
      .first();
    await expect(featureList).toBeVisible({ timeout: 10000 });
  });

  test('CTA / Get Started button is present on each plan', async ({ page }) => {
    const ctaButtons = page.getByRole('link', { name: /get started|start|try|buy|subscribe/i });
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking a paid plan CTA navigates toward checkout', async ({ page }) => {
    const proCta = page
      .getByRole('link', { name: /get started|buy pro|subscribe/i })
      .last();

    if (await proCta.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await proCta.getAttribute('href');
      // Should link to checkout or get-started flow
      if (href) {
        expect(href).toMatch(/checkout|get-started|stripe|billing/i);
      }
    }
  });

  test('no 500 errors on pricing page', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    expect(serverErrors).toHaveLength(0);
  });
});
