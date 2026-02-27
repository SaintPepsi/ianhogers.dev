import { test, expect } from '@playwright/test';

test.describe('Guestbook responsive - portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test.beforeEach(async ({ page }) => {
    await page.request.delete('http://localhost:4321/api/guestbook/notes');
    await page.goto('/guestbook');
    await page.waitForSelector('.guestbook-container', { timeout: 10_000 });
  });

  test('displays single page per slide in portrait', async ({ page }) => {
    // In portrait, each carousel-item should have a .portrait-mode container
    // with a single .single-page child (not left/right spread)
    const firstItem = page.locator('.carousel-item').first();

    const singlePages = firstItem.locator('.single-page');
    await expect(singlePages).toHaveCount(1);

    // Should NOT have left/right page layout
    const leftPages = firstItem.locator('.left-page');
    const rightPages = firstItem.locator('.right-page');
    await expect(leftPages).toHaveCount(0);
    await expect(rightPages).toHaveCount(0);

    await expect(page).toHaveScreenshot('portrait-single-page.png');
  });

  test('sprite element is visible and positioned in portrait', async ({ page }) => {
    const sprite = page.locator('.sprite');
    await expect(sprite).toBeVisible();

    // Sprite should have a background image (the book sprite sheet)
    const bgImage = await sprite.evaluate(
      (el) => getComputedStyle(el).backgroundImage
    );
    expect(bgImage).toContain('book-sprite');
  });

  test('scroll buttons fit within viewport in portrait', async ({ page }) => {
    // The book grid should not overflow the viewport horizontally
    const bookEl = page.locator('.book');
    const bookBox = await bookEl.boundingBox();
    if (!bookBox) throw new Error('Book element not found');

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport');

    // Book right edge should be within viewport
    expect(bookBox.x + bookBox.width).toBeLessThanOrEqual(viewport.width);
    // Book left edge should be at or past 0
    expect(bookBox.x).toBeGreaterThanOrEqual(0);
  });

  test('sprite-shift translates for right page in portrait', async ({ page }) => {
    // Navigate to page 1 (right page of first spread)
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    // The sprite-shift should have a non-zero translate when showing a right page
    const spriteShift = page.locator('.sprite-shift');
    const transform = await spriteShift.evaluate(
      (el) => getComputedStyle(el).translate
    );
    // Should be a negative pixel value (shifted left to show right page)
    expect(transform).not.toBe('none');
    expect(transform).not.toBe('0px 0px');
  });

  test('no horizontal overflow in portrait viewport', async ({ page }) => {
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('can navigate between individual pages in portrait', async ({ page }) => {
    // First slide should be the cover (page 0)
    const coverTitle = page.locator('.cover-title');
    await expect(coverTitle).toBeVisible();

    // Navigate to next slide (title page, page 1)
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    // Should see title page content
    const titleMain = page.locator('.title-main');
    await expect(titleMain).toBeVisible();
    await expect(titleMain).toHaveText('Guest Book');

    // Navigate to next slide (content page, page 2)
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    // Should see a drag overlay (content page)
    const dragOverlay = page.locator('.drag-overlay');
    await expect(dragOverlay.first()).toBeVisible();
  });

  test('drag to select works on single page in portrait', async ({ page }) => {
    // Navigate to content page (page 2) — scroll twice, one page at a time
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    await expect(dragOverlay).toBeVisible();

    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    // Drag a 3x3 area
    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    // Write mode should appear
    const writeMode = page.locator('.write-mode');
    await expect(writeMode).toBeVisible({ timeout: 2000 });

    await expect(page).toHaveScreenshot('portrait-write-mode.png');
  });

  test('grid cells are large enough for interaction in portrait', async ({ page }) => {
    // Navigate to content page — scroll twice, one page at a time
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    // Each cell should be at least 20px wide (minimum tappable)
    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    expect(cellWidth).toBeGreaterThan(20);
    expect(cellHeight).toBeGreaterThan(20);
  });
});

test.describe('Guestbook responsive - landscape', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.request.delete('http://localhost:4321/api/guestbook/notes');
    await page.goto('/guestbook');
    await page.waitForSelector('.guestbook-container', { timeout: 10_000 });
  });

  test('displays two-page spread in landscape', async ({ page }) => {
    const firstItem = page.locator('.carousel-item').first();

    // Should have left and right pages
    const leftPage = firstItem.locator('.left-page');
    const rightPage = firstItem.locator('.right-page');
    await expect(leftPage).toHaveCount(1);
    await expect(rightPage).toHaveCount(1);

    // Should NOT have single-page layout
    const singlePages = firstItem.locator('.single-page');
    await expect(singlePages).toHaveCount(0);
  });
});
