import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Guestbook mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/guestbook');
    await page.waitForSelector('.guestbook-container', { timeout: 10_000 });
    // Wait for mobile book sizing to compute
    await page.waitForTimeout(500);
  });

  test('renders mobile layout with nav buttons and centered page', async ({ page }) => {
    // Mobile carousel should be active
    const carousel = page.locator('.mobile-carousel');
    await expect(carousel).toBeVisible();

    // Nav buttons should be present
    const prevBtn = page.locator('button[aria-label="Previous page"]');
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Prev should be disabled on page 1
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    // Page indicator should show "1 / N"
    const indicator = page.locator('.mobile-nav-indicator');
    await expect(indicator).toContainText('1 /');

    // Book should have inline --sprite-th (native sizing)
    const book = page.locator('.book');
    const style = await book.getAttribute('style');
    expect(style).toContain('--sprite-th:');

    // One page should be approximately viewport width minus padding
    const pageWidth = await carousel.evaluate((el) => el.clientWidth / 2);
    expect(pageWidth).toBeGreaterThan(280);
    expect(pageWidth).toBeLessThan(380);

    await expect(page).toHaveScreenshot('mobile-cover-page.png');
  });

  test('navigates between pages and shows correct content', async ({ page }) => {
    // Page 1: cover — click next to go to page 2 (title)
    await page.click('button[aria-label="Next page"]');
    await page.waitForTimeout(400);

    const indicator = page.locator('.mobile-nav-indicator');
    await expect(indicator).toHaveText('2 / 4');

    // Title page content should be visible
    await expect(page.locator('.title-main')).toContainText('Guest Book');

    await expect(page).toHaveScreenshot('mobile-title-page.png');

    // Page 3: content spread — should trigger sprite animation
    await page.click('button[aria-label="Next page"]');
    await page.waitForTimeout(600); // wait for sprite animation

    await expect(indicator).toHaveText('3 / 4');

    // Non-active spreads should be hidden
    const hiddenItems = await page.locator('.carousel-item[style*="display: none"]').count();
    expect(hiddenItems).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('mobile-content-page.png');
  });
});
