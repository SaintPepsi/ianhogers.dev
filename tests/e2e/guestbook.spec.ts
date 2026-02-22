import { test, expect } from '@playwright/test';

test.describe('Guestbook', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/guestbook');
    // Wait for the guestbook to load (loading state to disappear)
    await page.waitForSelector('.guestbook-container', { timeout: 10_000 });
  });

  test('renders the book with cover and title page', async ({ page }) => {
    // Cover page should have "Guest Book" title
    const coverTitle = page.locator('.cover-title');
    await expect(coverTitle).toHaveText('Guest Book');

    // Sprite should be present (book animation)
    const sprite = page.locator('.sprite');
    await expect(sprite).toBeVisible();
  });

  test('carousel has scroll buttons and can navigate', async ({ page }) => {
    const carousel = page.locator('.carousel');
    await expect(carousel).toBeVisible();

    // Should have scroll-snap behavior
    const scrollSnap = await carousel.evaluate(
      (el) => getComputedStyle(el).scrollSnapType
    );
    expect(scrollSnap).toContain('mandatory');
  });

  test('title page shows welcome message', async ({ page }) => {
    const titleCredit = page.locator('.title-credit');
    await expect(titleCredit).toContainText('Thank you for visiting');
  });

  test('drag overlay is present and interactive on content pages', async ({ page }) => {
    // Navigate to second spread (first content spread)
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    // Drag overlay should be present and cover the page
    const dragOverlay = page.locator('.drag-overlay').first();
    await expect(dragOverlay).toBeVisible();

    // Overlay should have touch-action: none (blocks scroll)
    const touchAction = await dragOverlay.evaluate(
      (el) => getComputedStyle(el).touchAction
    );
    expect(touchAction).toBe('none');
  });

  test('drag to select shows selection rectangle', async ({ page }) => {
    // Navigate to content spread
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    // Calculate cell positions (3x3 area starting from top-left)
    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    // Drag from (1,1) to (4,4) — should be at least 2x2 cells
    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });

    // Selection highlight should appear
    const selection = page.locator('.selection-highlight');
    await expect(selection).toBeVisible();

    // Should be valid (green/blue) since area is empty
    await expect(selection).toHaveClass(/valid/);

    await page.mouse.up();
  });

  test('valid drag selection opens write mode', async ({ page }) => {
    // Navigate to content spread
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
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

    // Should have author input and textarea
    const authorInput = page.locator('.author-input');
    await expect(authorInput).toBeVisible();

    const textarea = page.locator('.note-textarea');
    await expect(textarea).toBeVisible();
  });

  test('write mode shows character count and buttons', async ({ page }) => {
    // Navigate to content spread
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    // Drag to create selection
    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForSelector('.write-mode', { timeout: 2000 });

    // Character count visible
    const charCount = page.locator('.char-count');
    await expect(charCount).toBeVisible();

    // Discard button visible
    const discardBtn = page.locator('.discard-btn');
    await expect(discardBtn).toBeVisible();

    // Seal button visible but disabled (no text yet)
    const sealBtn = page.locator('.seal-btn');
    await expect(sealBtn).toBeVisible();
    await expect(sealBtn).toBeDisabled();
  });

  test('typing text enables seal button and updates char count', async ({ page }) => {
    // Navigate and create selection
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForSelector('.write-mode', { timeout: 2000 });

    // Fill author
    const authorInput = page.locator('.author-input');
    await authorInput.fill('TestUser');

    // Fill text
    const textarea = page.locator('.note-textarea');
    await textarea.fill('Hello world!');

    // Seal button should now be enabled
    const sealBtn = page.locator('.seal-btn');
    await expect(sealBtn).toBeEnabled();

    // Character count should have decreased
    const charCount = page.locator('.char-count');
    const countText = await charCount.textContent();
    expect(Number(countText)).toBeLessThan(100); // Should be max - 12
  });

  test('discard button shows confirmation dialog', async ({ page }) => {
    // Navigate and create selection
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForSelector('.write-mode', { timeout: 2000 });

    // Type some text first (discard confirmation only shows when there's text)
    const textarea = page.locator('.note-textarea');
    await textarea.fill('Some text');

    // Click discard
    const discardBtn = page.locator('.discard-btn');
    await discardBtn.click();

    // Confirmation dialog should appear
    const confirmText = page.locator('.confirm-text');
    await expect(confirmText).toHaveText('Discard this note?');

    // Click "No" to go back
    const noBtn = page.locator('.confirm-no');
    await noBtn.click();

    // Should be back in write mode
    await expect(textarea).toBeVisible();
  });

  test('seal button shows post confirmation dialog', async ({ page }) => {
    // Navigate and create selection
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForSelector('.write-mode', { timeout: 2000 });

    // Fill author and text
    const authorInput = page.locator('.author-input');
    await authorInput.fill('TestUser');

    const textarea = page.locator('.note-textarea');
    await textarea.fill('Hello world!');

    // Click seal
    const sealBtn = page.locator('.seal-btn');
    await sealBtn.click();

    // Post confirmation dialog should appear
    const confirmText = page.locator('.confirm-text');
    await expect(confirmText).toHaveText('Post guest note?');
  });

  test('escape key triggers discard flow', async ({ page }) => {
    // Navigate and create selection
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 3.5, box.y + cellHeight * 3.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForSelector('.write-mode', { timeout: 2000 });

    // Click inside write mode to ensure focus
    const textarea = page.locator('.note-textarea');
    await textarea.click();
    await page.waitForTimeout(100);

    // With no text, escape should immediately close
    await page.keyboard.press('Escape');

    // Write mode should be gone, drag overlay back
    await expect(page.locator('.write-mode')).not.toBeVisible({ timeout: 2000 });
    await expect(dragOverlay).toBeVisible();
  });

  test('too-small selection flashes red and does not open write mode', async ({ page }) => {
    // Navigate to content spread
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    // Drag just 1x1 cell — too small (needs 2x2 minimum)
    await page.mouse.move(box.x + cellWidth * 0.5, box.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 0.8, box.y + cellHeight * 0.8, { steps: 3 });
    await page.mouse.up();

    // Write mode should NOT appear
    await expect(page.locator('.write-mode')).not.toBeVisible();
  });

  test('carousel does not scroll during drag selection', async ({ page }) => {
    // Navigate to content spread
    const carousel = page.locator('.carousel');
    await carousel.evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    // Record scroll position before drag
    const scrollBefore = await carousel.evaluate((el) => el.scrollLeft);

    const dragOverlay = page.locator('.drag-overlay').first();
    const box = await dragOverlay.boundingBox();
    if (!box) throw new Error('Drag overlay not found');

    const cellWidth = box.width / 9;
    const cellHeight = box.height / 16;

    // Horizontal drag across the page
    await page.mouse.move(box.x + cellWidth * 1, box.y + cellHeight * 3);
    await page.mouse.down();
    await page.mouse.move(box.x + cellWidth * 7, box.y + cellHeight * 3, { steps: 10 });
    await page.mouse.up();

    // Scroll position should not have changed
    const scrollAfter = await carousel.evaluate((el) => el.scrollLeft);
    expect(scrollAfter).toBe(scrollBefore);
  });
});
