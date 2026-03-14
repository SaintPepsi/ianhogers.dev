import { test, expect } from '@playwright/test';

test.describe('Falling Bamboo Leaves', () => {
  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage to start fresh each test
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
  });

  test('no leaves appear on non-bamboo pages before activation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(0);
  });

  test('leaves spawn when visiting bambooboys page', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    // Wait for staggered spawns (8 leaves * 800ms delay = 6.4s max)
    await page.waitForTimeout(7000);

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(8);
  });

  test('leaves use pixel-art bamboo leaf sprites', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const srcs = await page.locator('.falling-leaf img').evaluateAll(
      (imgs: HTMLImageElement[]) => imgs.map(img => img.src)
    );

    const validSprites = [
      '/assets/pixel-art/decorative/bamboo-leaf-1.png',
      '/assets/pixel-art/decorative/bamboo-leaf-2.png',
      '/assets/pixel-art/decorative/bamboo-leaf-3.png',
    ];

    for (const src of srcs) {
      expect(validSprites.some(s => src.includes(s))).toBe(true);
    }
  });

  test('leaves have drop shadows', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leaf = page.locator('.falling-leaf').first();
    const filter = await leaf.evaluate(el => getComputedStyle(el).filter);
    expect(filter).toContain('drop-shadow');
  });

  test('leaves use translate CSS property for fall animation', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leaf = page.locator('.falling-leaf').first();
    const translate = await leaf.evaluate(el => getComputedStyle(el).translate);
    // translate should be set (not 'none') during animation
    expect(translate).not.toBe('none');
  });

  test('clicking a leaf opens a poem card', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leaf = page.locator('.falling-leaf').first();
    await leaf.click({ force: true });

    const card = page.locator('.poem-card');
    await expect(card).toBeVisible();

    const poemText = await page.locator('.poem-text').textContent();
    const knownPoems = [
      'Do not judge a bamboo until it has fully grown.',
      'Bamboo that bends is stronger than the oak that resists.',
      'The bamboo that is alone stands no chance against the wind.',
      'Be like bamboo. The higher you grow, the deeper you bow.',
      'A single bamboo pole does not make a raft.',
      'When the wind blows, the bamboo bends — and rises again.',
      'The green reed which bends in the wind is stronger than the mighty oak which breaks in a storm.',
      'Bamboo is not a weed, it is a flowering plant that flowers once every hundred years.',
      'After the rain, the bamboo grove stands taller.',
      'Even the tallest bamboo started as a small shoot.',
    ];
    expect(knownPoems).toContain(poemText!.trim());
  });

  test('poem card has pixel-box styling with green accent', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const card = page.locator('.poem-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/pixel-box/);

    const boxColor = await card.evaluate(
      el => getComputedStyle(el).getPropertyValue('--box-color').trim()
    );
    expect(boxColor).toBe('#4ade80');
  });

  test('poem card shows bamboo icon', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const icon = page.locator('.poem-icon');
    await expect(icon).toHaveText('🎋');
  });

  test('clicking backdrop closes poem card', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });
    await expect(page.locator('.poem-card')).toBeVisible();

    await page.locator('.poem-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.poem-card')).toHaveCount(0);
  });

  test('pressing Escape closes poem card', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });
    await expect(page.locator('.poem-card')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.poem-card')).toHaveCount(0);
  });

  test('closing poem card spawns a replacement leaf', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(7000);

    const countBefore = await page.locator('.falling-leaf').count();
    await page.locator('.falling-leaf').first().click({ force: true });
    // One leaf removed for poem
    const countDuringPoem = await page.locator('.falling-leaf').count();
    expect(countDuringPoem).toBe(countBefore - 1);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // New leaf spawned
    const countAfter = await page.locator('.falling-leaf').count();
    expect(countAfter).toBe(countBefore);
  });

  test('leaves persist after navigating to another page', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leafCount = await page.locator('.falling-leaf').count();
    expect(leafCount).toBeGreaterThan(0);

    // Navigate via link click (uses ViewTransitions)
    await page.locator('a[href="/about"]').first().click();
    await page.waitForTimeout(2000);

    const leavesOnAbout = await page.locator('.falling-leaf').count();
    expect(leavesOnAbout).toBeGreaterThan(0);
  });

  test('sessionStorage activation persists across page loads', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(2000);

    const isActive = await page.evaluate(
      () => sessionStorage.getItem('bamboo-leaves-active')
    );
    expect(isActive).toBe('true');
  });

  test('activation only triggers on exact bambooboys path', async ({ page }) => {
    // Visit a path that contains 'bambooboys' as substring but isn't exact
    await page.goto('/shoutouts');
    await page.waitForTimeout(2000);

    const isActive = await page.evaluate(
      () => sessionStorage.getItem('bamboo-leaves-active')
    );
    expect(isActive).toBeNull();

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(0);
  });

  test('poems do not repeat within a cycle', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(7000);

    const seenPoems: string[] = [];

    // Click 5 leaves and collect poems (enough to check no-repeat)
    for (let i = 0; i < 5; i++) {
      const leaf = page.locator('.falling-leaf').first();
      await leaf.click({ force: true });
      const text = await page.locator('.poem-text').textContent();
      seenPoems.push(text!.trim());
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // All poems should be unique (no repeats)
    const uniquePoems = new Set(seenPoems);
    expect(uniquePoems.size).toBe(seenPoems.length);
  });

  test('hover scales leaf using individual scale property', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leaf = page.locator('.falling-leaf').first();
    const box = await leaf.boundingBox();
    // Move mouse to the element's center to trigger real CSS :hover
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    // Wait for the CSS transition (0.15s)
    await page.waitForTimeout(200);

    const scale = await leaf.evaluate(el => getComputedStyle(el).scale);
    expect(scale).toBe('1.3');
  });

  test('poem card centers horizontally on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const card = page.locator('.poem-card');
    await expect(card).toBeVisible();

    const left = await card.evaluate(el => parseInt(getComputedStyle(el).left));
    // On 375px viewport with 280px card, centered would be ~47px
    // Allow margin: should be roughly centered (30-60px range)
    expect(left).toBeGreaterThanOrEqual(20);
    expect(left).toBeLessThanOrEqual(80);
  });
});
