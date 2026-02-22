import { test, expect } from '@playwright/test';

// Clear in-memory store before this test file runs
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.request.delete('http://localhost:4321/api/guestbook/notes');
  await page.close();
});

/**
 * Guestbook shrink bounds & content scenarios.
 *
 * Shrink tests let POST go through to the real server so shrinkBounds runs.
 * UI tests (re-drag, compact dialog) use the right page to avoid overlaps.
 */

/** Navigate to content spread, return geometry for left page */
async function setupLeftPage(page: import('@playwright/test').Page) {
  await page.goto('/guestbook');
  await page.waitForSelector('.guestbook-container', { timeout: 10_000 });

  const carousel = page.locator('.carousel');
  await carousel.evaluate((el) => {
    el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
  });
  await page.waitForTimeout(500);

  const dragOverlay = page.locator('.drag-overlay').first();
  const box = await dragOverlay.boundingBox();
  if (!box) throw new Error('Drag overlay not found');

  return { page, box, cellWidth: box.width / 9, cellHeight: box.height / 16 };
}

/** Navigate to content spread, return geometry for right page */
async function setupRightPage(page: import('@playwright/test').Page) {
  await page.goto('/guestbook');
  await page.waitForSelector('.guestbook-container', { timeout: 10_000 });

  const carousel = page.locator('.carousel');
  await carousel.evaluate((el) => {
    el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
  });
  await page.waitForTimeout(500);

  // Right page is the second drag overlay in the spread
  const dragOverlay = page.locator('.drag-overlay').nth(1);
  const box = await dragOverlay.boundingBox();
  if (!box) throw new Error('Right page drag overlay not found');

  return { page, box, cellWidth: box.width / 9, cellHeight: box.height / 16 };
}

/** Drag from cell (col1,row1) to (col2,row2) — 1-based */
async function dragSelection(
  page: import('@playwright/test').Page,
  box: { x: number; y: number },
  cellWidth: number,
  cellHeight: number,
  col1: number, row1: number,
  col2: number, row2: number,
) {
  await page.mouse.move(box.x + (col1 - 0.5) * cellWidth, box.y + (row1 - 0.5) * cellHeight);
  await page.mouse.down();
  await page.mouse.move(box.x + (col2 - 0.5) * cellWidth, box.y + (row2 - 0.5) * cellHeight, { steps: 5 });
  await page.mouse.up();
}

/** Submit via real server — response contains shrunk bounds */
async function submitNoteReal(
  page: import('@playwright/test').Page,
  text: string,
  author: string,
): Promise<Record<string, unknown>> {
  await page.waitForSelector('.write-mode', { timeout: 2000 });

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/guestbook/notes') && resp.request().method() === 'POST',
  );

  await page.locator('.author-input').fill(author);
  await page.locator('.note-textarea').fill(text);
  await page.locator('.seal-btn').click();

  // All dialogs now use icon buttons
  await page.locator('.icon-btn[title="Post"]').click();

  const response = await responsePromise;
  const body = await response.json();
  await expect(page.locator('.write-mode')).not.toBeVisible({ timeout: 3000 });
  return body;
}

test.describe('Guestbook shrink bounds', () => {
  // Each test uses a unique grid area on the left page to avoid in-memory overlaps

  test('"Hi" in 4x4 shrinks to smaller area', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 1, 4, 4);
    const note = await submitNoteReal(page, 'Hi', 'T');

    const rowSpan = (note.row_end as number) - (note.row_start as number);
    const colSpan = (note.col_end as number) - (note.col_start as number);

    expect(rowSpan * colSpan).toBeLessThan(16);
    expect(colSpan).toBeGreaterThanOrEqual(2);

    await expect(page).toHaveScreenshot('shrink-hi-4x4.png');
  });

  test('"ABCD" in 4x4 shrinks significantly', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 5, 1, 8, 4);
    const note = await submitNoteReal(page, 'ABCD', 'T');

    const rowSpan = (note.row_end as number) - (note.row_start as number);
    const colSpan = (note.col_end as number) - (note.col_start as number);

    expect(rowSpan * colSpan).toBeLessThan(16);
    expect(colSpan).toBeGreaterThanOrEqual(2);

    await expect(page).toHaveScreenshot('shrink-abcd-4x4.png');
  });

  test('dense text in 3x3 keeps full area', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    // Text that wraps to multiple lines at shrinkBounds estimation, preserving the 3x3
    await dragSelection(page, box, cellWidth, cellHeight, 1, 5, 3, 7);
    const note = await submitNoteReal(page, 'AB CD EF GH IJ KL', 'Tester');

    const rowSpan = (note.row_end as number) - (note.row_start as number);
    const colSpan = (note.col_end as number) - (note.col_start as number);

    expect(rowSpan).toBeGreaterThanOrEqual(2);
    expect(colSpan).toBeGreaterThanOrEqual(2);

    await expect(page).toHaveScreenshot('shrink-dense-3x3.png');
  });

  test('"OK" in 6x6 shrinks drastically', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 8, 6, 13);
    const note = await submitNoteReal(page, 'OK', 'A');

    const rowSpan = (note.row_end as number) - (note.row_start as number);
    const colSpan = (note.col_end as number) - (note.col_start as number);

    expect(rowSpan * colSpan).toBeLessThanOrEqual(8);
    expect(colSpan).toBeGreaterThanOrEqual(2);

    await expect(page).toHaveScreenshot('shrink-ok-6x6.png');
  });

  test('2x2 with "Hi" can shrink to 1x2', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 5, 5, 6, 6);
    const note = await submitNoteReal(page, 'Hi', 'M');

    const rowSpan = (note.row_end as number) - (note.row_start as number);
    const colSpan = (note.col_end as number) - (note.col_start as number);

    expect(rowSpan).toBeGreaterThanOrEqual(1);
    expect(colSpan).toBeGreaterThanOrEqual(2);
    expect(rowSpan * colSpan).toBeLessThanOrEqual(4);

    await expect(page).toHaveScreenshot('shrink-hi-2x2.png');
  });

  test('bounds anchor at top-left', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupLeftPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 7, 10, 9, 13);
    const note = await submitNoteReal(page, 'X', 'Y');

    expect(note.row_start).toBe(10);
    expect(note.col_start).toBe(7);
    expect((note.row_end as number) - 10).toBeLessThanOrEqual(4);

    await expect(page).toHaveScreenshot('shrink-anchor-top-left.png');
  });
});

test.describe('Guestbook re-drag behavior', () => {
  // Uses right page to avoid overlap with shrink tests

  test('re-drag on empty WriteMode replaces selection', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupRightPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 1, 3, 3);
    await page.waitForSelector('.write-mode', { timeout: 2000 });

    await expect(page).toHaveScreenshot('redrag-initial-position.png');

    // Don't type — drag elsewhere
    await dragSelection(page, box, cellWidth, cellHeight, 5, 5, 7, 7);

    const writeMode = page.locator('.write-mode');
    await expect(writeMode).toBeVisible({ timeout: 2000 });

    // Verify the WriteMode moved to the new position
    const style = await writeMode.getAttribute('style');
    expect(style).toContain('5');
    expect(style).toContain('8'); // col/row end = 7+1 = 8 (grid line)

    await expect(page).toHaveScreenshot('redrag-new-position.png');
  });

  test('re-drag with typed content keeps original WriteMode', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupRightPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 1, 3, 3);
    await page.waitForSelector('.write-mode', { timeout: 2000 });

    await page.locator('.note-textarea').fill('Keep this');
    await page.waitForTimeout(100);

    // Try to drag elsewhere
    await dragSelection(page, box, cellWidth, cellHeight, 5, 5, 7, 7);

    const writeMode = page.locator('.write-mode');
    await expect(writeMode).toBeVisible();

    // Should still have the original text
    const textarea = page.locator('.note-textarea');
    await expect(textarea).toHaveValue('Keep this');

    await expect(page).toHaveScreenshot('redrag-content-kept.png');
  });
});

test.describe('Guestbook compact confirm dialog', () => {
  // Uses right page to avoid overlaps

  test('narrow 2-wide note shows compact "Post?" dialog', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupRightPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 6, 2, 9);
    await page.waitForSelector('.write-mode', { timeout: 2000 });

    await page.locator('.author-input').fill('N');
    await page.locator('.note-textarea').fill('Hi');
    await page.locator('.seal-btn').click();

    await expect(page.locator('.confirm-text')).toHaveText('Post?');
    expect(await page.locator('.icon-btn').count()).toBe(2);

    await expect(page).toHaveScreenshot('compact-post-dialog.png');
  });

  test('narrow 2-wide note shows compact "Discard?" dialog', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupRightPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 4, 6, 5, 9);
    await page.waitForSelector('.write-mode', { timeout: 2000 });

    await page.locator('.note-textarea').fill('Some text');
    await page.locator('.discard-btn').click();

    await expect(page.locator('.confirm-text')).toHaveText('Discard?');
    expect(await page.locator('.icon-btn').count()).toBe(2);

    await expect(page).toHaveScreenshot('compact-discard-dialog.png');
  });

  test('wide 4+ column note shows icon "Post?" dialog', async ({ page }) => {
    const { box, cellWidth, cellHeight } = await setupRightPage(page);

    await dragSelection(page, box, cellWidth, cellHeight, 1, 10, 5, 13);
    await page.waitForSelector('.write-mode', { timeout: 2000 });

    await page.locator('.author-input').fill('W');
    await page.locator('.note-textarea').fill('Hello');
    await page.locator('.seal-btn').click();

    await expect(page.locator('.confirm-text')).toHaveText('Post?');
    expect(await page.locator('.icon-btn').count()).toBe(2);

    await expect(page).toHaveScreenshot('wide-post-dialog.png');
  });
});
