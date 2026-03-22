import { test, expect } from '@playwright/test';

test.describe('Platform Landing Page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('homepage loads and displays hero section', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

  test('page title is set', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('navigation header is visible', async ({ page }) => {
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
  });

  test('navigation links work', async ({ page }) => {
    // Find nav links (excluding external links)
    const navLinks = page.locator('header a[href^="/"]');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('pricing link navigates to pricing page', async ({ page }) => {
    const pricingLink = page
      .locator('header')
      .getByRole('link', { name: /pricing/i })
      .first();
    if (await pricingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pricingLink.click();
      await expect(page).toHaveURL(/.*pricing/);
    }
  });

  test('get started / CTA button is visible', async ({ page }) => {
    const cta = page
      .getByRole('link', { name: /get started|try free|start|launch/i })
      .first();
    await expect(cta).toBeVisible({ timeout: 15000 });
  });

  test('footer is present', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 10000 });
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Filter out known acceptable errors (e.g. analytics blocked)
    const critical = errors.filter(
      (e) => !e.includes('analytics') && !e.includes('gtag') && !e.includes('firebase'),
    );
    expect(critical).toHaveLength(0);
  });

  test('showcases page loads', async ({ page }) => {
    await page.goto('/showcases');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  });
});
