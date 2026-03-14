import { test, expect } from '@playwright/test';

test.describe('Falling Bamboo Leaves', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
  });

  test('no leaves appear on non-bamboo pages before activation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(0);
  });

  test('leaves trickle in when visiting bambooboys page', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    // First leaf spawns immediately, more trickle in over 1-5s intervals
    await page.waitForTimeout(8000);

    const count = await page.locator('.falling-leaf').count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(10);
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

  test('poem card uses parchment scroll frame border-image', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const card = page.locator('.poem-card');
    await expect(card).toBeVisible();

    const borderImage = await card.evaluate(
      el => getComputedStyle(el).borderImageSource
    );
    expect(borderImage).toContain('scroll-frame-02.png');
  });

  test('poem card shows bamboo icon', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const icon = page.locator('.poem-icon');
    await expect(icon).toHaveAttribute('src', '/assets/pixel-art/decorative/bamboo-stem.png');
  });

  test('poem card has wax seal overlapping top border', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const seal = page.locator('.seal-wrapper');
    await expect(seal).toBeVisible();

    const sealImg = seal.locator('.seal-img');
    await expect(sealImg).toHaveAttribute('src', '/assets/pixel-art/ui/btn-seal.png');
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
    await page.waitForTimeout(6000);

    const countBefore = await page.locator('.falling-leaf').count();
    await page.locator('.falling-leaf').first().click({ force: true });

    const countDuringPoem = await page.locator('.falling-leaf').count();
    expect(countDuringPoem).toBe(countBefore - 1);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const countAfter = await page.locator('.falling-leaf').count();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });

  test('leaves persist after navigating to another page', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(4000);

    const leafCount = await page.locator('.falling-leaf').count();
    expect(leafCount).toBeGreaterThan(0);

    await page.locator('a[href="/about"]').first().click();
    await page.waitForTimeout(3000);

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
    await page.goto('/shoutouts');
    await page.waitForTimeout(3000);

    const isActive = await page.evaluate(
      () => sessionStorage.getItem('bamboo-leaves-active')
    );
    expect(isActive).toBeNull();

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(0);
  });

  test('poems do not repeat within a cycle', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(8000);

    const seenPoems: string[] = [];

    for (let i = 0; i < 5; i++) {
      const leaf = page.locator('.falling-leaf').first();
      await leaf.click({ force: true });
      const text = await page.locator('.poem-text').textContent();
      seenPoems.push(text!.trim());
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }

    const uniquePoems = new Set(seenPoems);
    expect(uniquePoems.size).toBe(seenPoems.length);
  });

  test('hover scales leaf using individual scale property', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    const leaf = page.locator('.falling-leaf').first();
    const box = await leaf.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
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
    // On 375px viewport with 240px card, centered would be ~67px
    expect(left).toBeGreaterThanOrEqual(30);
    expect(left).toBeLessThanOrEqual(100);
  });

  test('no more leaves spawn after all poems are read', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    // Pre-set poems-read to 10 (all read)
    await page.evaluate(() => {
      sessionStorage.setItem('bamboo-poems-read', '10');
    });
    // Reload to pick up the state
    await page.reload();
    await page.waitForTimeout(5000);

    const leaves = page.locator('.falling-leaf');
    await expect(leaves).toHaveCount(0);
  });

  test('poem text is dark colored for parchment readability', async ({ page }) => {
    await page.goto('/shoutouts/bambooboys');
    await page.waitForTimeout(3000);

    await page.locator('.falling-leaf').first().click({ force: true });

    const color = await page.locator('.poem-text').evaluate(
      el => getComputedStyle(el).color
    );
    // #3d2b1f = rgb(61, 43, 31) — dark brown
    expect(color).toContain('61');
    expect(color).toContain('43');
    expect(color).toContain('31');
  });
});
