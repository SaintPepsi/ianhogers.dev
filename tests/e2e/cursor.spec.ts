import { test, expect } from '@playwright/test';

test.describe('Pixel cursor sprite animation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('#pixel-cursor', { state: 'visible', timeout: 5000 });
	});

	test('cursor element uses sprite sheet as background-image', async ({ page }) => {
		const bgImage = await page.locator('#pixel-cursor').evaluate(
			(el: HTMLElement) => el.style.backgroundImage
		);
		expect(bgImage).toContain('interaction_hand.png');
	});

	test('cursor background-size scales sprite sheet to display size', async ({ page }) => {
		const bgSize = await page.locator('#pixel-cursor').evaluate(
			(el: HTMLElement) => el.style.backgroundSize
		);
		// 8 frames at 32px each = 256px wide, 32px tall
		expect(bgSize).toBe('256px 32px');
	});

	test('frame changes use background-position, not background-image', async ({ page }) => {
		// Move mouse over a clickable element to trigger pointer animation
		const link = page.locator('a').first();
		await link.hover();
		await page.waitForTimeout(300);

		// Capture background-image and background-position
		const { bgImage, bgPosition } = await page.locator('#pixel-cursor').evaluate(
			(el: HTMLElement) => ({
				bgImage: el.style.backgroundImage,
				bgPosition: el.style.backgroundPosition,
			})
		);

		// background-image should still be the sprite sheet (not a data URI)
		expect(bgImage).toContain('interaction_hand.png');
		expect(bgImage).not.toContain('data:');

		// background-position should be a negative offset (not 0px 0 for frame 0)
		expect(bgPosition).toMatch(/-?\d+px\s+0/);
	});

	test('cursor follows mouse movement', async ({ page }) => {
		await page.mouse.move(200, 200);
		await page.waitForTimeout(50);

		const transform = await page.locator('#pixel-cursor').evaluate(
			(el: HTMLElement) => el.style.transform
		);
		expect(transform).toContain('translate(200px');
		expect(transform).toContain('200px)');
	});

	test('cursor hides when mouse leaves viewport', async ({ page }) => {
		// Move mouse into viewport first
		await page.mouse.move(100, 100);
		await page.waitForTimeout(50);

		// Dispatch mouseleave
		await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave')));
		await page.waitForTimeout(50);

		const display = await page.locator('#pixel-cursor').evaluate(
			(el: HTMLElement) => el.style.display
		);
		expect(display).toBe('none');
	});
});
