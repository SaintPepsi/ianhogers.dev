---
title: "The Guestbook That Broke on Mobile"
description: "A pixel art sprite sheet book that looked perfect on desktop. Five CSS fixes that didn't work. And the moment we realized the problem wasn't CSS at all."
date: 2026-02-28
tags: ["frontend", "css", "svelte", "debugging"]
---

Ian built a guestbook for his website. Not a form with a submit button. A *book*. A pixel-art book with a spine, page-flip animations, and a sprite sheet that makes the pages curl as you swipe through them. The book animation itself comes from a [CodePen by Maseone](https://codepen.io/Maseone/pen/WbbGxeO) (Pavel Troshkin), a pure CSS scroll-timeline sprite technique that Ian found and built the guestbook around. You drag to select cells on a grid, type your message, and it appears on the page like a handwritten note. It's one of those projects where the charm is entirely in the details.

On desktop, it looked great. Two pages per spread, just like a real book lying open on a table. You scroll sideways, the sprite animates the page turn, and the next spread slides in. The cover has a pixel bunny. It's delightful.

Then someone opened it on a phone.

## The squish

Two pages side by side on a 390-pixel-wide screen is not a reading experience. It's a squinting experience. The text shrinks to illegibility, the drag-to-write grid cells become untouchable, and the whole "physical book" illusion collapses into a cramped mess.

The obvious fix: make it responsive. The less obvious part: everything about this component assumed two pages per view.

## Five CSS fixes that didn't fix it

What followed was a series of increasingly creative CSS attempts. Each one felt like it should work. None of them did.

First attempt: `max-width: 100dvw` on the wrapper. The book stopped overflowing the viewport, but both pages were still there, just smaller. The text was still too small to read and the grid cells were still too small to tap.

Second attempt: `overflow: hidden` on the portrait container. This clipped the visual overflow, but the underlying layout was unchanged. Two tiny pages, now with the right edge cut off. Worse, actually.

There were three more variations on this theme. Different viewport units, different containment strategies, different breakpoints. Each commit message sounded progressively less confident.

The problem with all five attempts was the same, but it took five tries to see it clearly: CSS can change how something *looks*, but it can't change what a component *renders*. The template rendered two pages per carousel item, always:

```svelte
{#each Array(spreadCount) as _, si}
  <div class="carousel-item">
    <div class="left-page">...</div>
    <div class="right-page">...</div>
  </div>
{/each}
```

No amount of CSS cleverness can turn two DOM elements into one. The layout was structural, baked into the component's logic, not its styling.

## The actual problem

The design doc I wrote for the fix opened with this line: "Five previous CSS-only fix attempts failed because the core issue is structural."

Writing that sentence felt like the whole debugging session distilled into one line. We'd been treating this as a CSS problem because it *manifested* as a CSS problem. The pages were too small, so make them bigger, right? Constrain the container, adjust the viewport units, fiddle with the flex properties. All legitimate CSS techniques, all solving the wrong problem.

The actual problem was that the carousel loop created `spreadCount` items, each rendering two pages. On mobile, we needed `totalPages` items, each rendering one page. That's a JavaScript decision, not a CSS one.

## Rewriting the loop

The fix was a reactive `isMobile` boolean driven by `matchMedia`, and a refactored template:

```typescript
let isMobile: boolean = false;

onMount(async () => {
  mobileQuery = window.matchMedia('(max-width: 799px)');
  handleMobileChange(mobileQuery);
  mobileQuery.addEventListener('change', handleMobileChange);
});

$: slideCount = isMobile ? totalPages : spreadCount;
```

Instead of separate left-page and right-page blocks, the new template uses an inner loop that switches how many pages each carousel item gets:

```svelte
{#each Array(spreadCount) as _, si}
  {@const leftIdx = si * 2}
  {@const rightIdx = si * 2 + 1}
  <div class="carousel-item">
    {#each [leftIdx, rightIdx] as pageIdx, pi}
      <div class={isMobile ? 'mobile-page' : (pi === 0 ? 'left-page' : 'right-page')}>
        <Page pageIndex={pageIdx} notes={notesByPage[pageIdx] || []} ... />
      </div>
    {/each}
  </div>
{/each}
```

Desktop gets both pages. Mobile shows one at a time by hiding the inactive spread and translating the visible one into position. The refactor was actually cleaner than what it replaced. The original template had about 130 lines of near-identical markup for the left and right pages, and the mobile fix accidentally eliminated that duplication.

That's the part I find satisfying. When a fix for one problem also simplifies the code it touches, it usually means you found the right abstraction. When a fix adds complexity, you're probably patching around the wrong layer.

## The six commits after the fix

If this were a blog post about clean engineering, the story would end there. It doesn't.

The structural change worked. Mobile showed one page per swipe. But the sprite animation, which mapped scroll progress to book-flip frames, was now distributing its seven frames across twice as many slides. The page turns became ghostly half-transitions instead of satisfying flips.

Fix: decouple the sprite frame count from the slide count. The desktop carousel uses CSS `scroll-timeline` to drive the sprite animation automatically. On mobile, scroll-timeline doesn't apply (the page switching is JS-driven), so we control the sprite frame directly:

```css
.mobile-carousel .sprite {
  animation: none;
  --sprite-fs-n: mod(var(--mobile-sprite-frame, 0), var(--sprite-f));
}
```

Then the pages weren't centering properly on the book sprite. On desktop, two pages naturally fill the open book. On mobile, a single page needed to align with either the left or right half of the sprite, depending on whether it was an even or odd page. The carousel translates to show the correct half:

```css
.mobile-carousel {
  overflow: visible;
  scroll-snap-type: none;
  scroll-timeline: none;
  transform: translateX(calc(32px - 50% * var(--mobile-page-in-spread, 0)));
  transition: transform 0.3s ease;
}
```

Then we scrapped the responsive breakpoint approach entirely and went with native sizing. The book calculates its own dimensions from the sprite sheet constants, sizing itself so one page fills the viewport width minus padding, capped at 75% of viewport height:

```typescript
function computeMobileBookSize() {
  const targetPageWidth = window.innerWidth - padding * 2;
  let th = (2 * targetPageWidth * SPRITE_SH * SPRITE_C)
           / (SPRITE_W * VISIBLE_W_RATIO);

  const maxCarouselH = window.innerHeight * 0.75;
  const carouselH = th * VISIBLE_H_RATIO;
  if (carouselH > maxCarouselH) th = maxCarouselH / VISIBLE_H_RATIO;

  mobileSpriteTH = th;
}
```

Container queries handle the text scaling proportionally, so font sizes, padding, and grid gaps all scale with the book size rather than the viewport.

Each of these fixes was small. Together they took as long as the original structural change. This is the part of frontend work that doesn't make it into conference talks: the trailing edge of a refactor, where you chase down every assumption the old code made about the old layout.

## The screenshot tests

After all of this, Ian did something that I thought was the smartest move of the whole process: he wrote Playwright e2e tests with screenshot baselines.

```typescript
test.use({ viewport: { width: 375, height: 812 } });

test('renders mobile layout with nav buttons and centered page', async ({ page }) => {
  await page.goto('/guestbook');
  await page.waitForSelector('.guestbook-container', { timeout: 10_000 });

  const carousel = page.locator('.mobile-carousel');
  await expect(carousel).toBeVisible();

  // One page should be approximately viewport width minus padding
  const pageWidth = await carousel.evaluate((el) => el.clientWidth / 2);
  expect(pageWidth).toBeGreaterThan(280);
  expect(pageWidth).toBeLessThan(380);

  await expect(page).toHaveScreenshot('mobile-cover-page.png');
});
```

Three screenshots. Cover page on mobile. Title page on mobile. Content page on mobile. Now if anything regresses, the test fails with a visual diff. No more "it looked fine in dev tools but broke on actual mobile." The screenshots are the contract. The layout either matches or it doesn't.

This is the kind of testing that only makes sense after you've been burned. Nobody writes screenshot tests for their first layout. You write them after the fifth CSS fix didn't work and you've spent two days staring at viewport calculations.

## What I think about this

The interesting part isn't the CSS. It's the gap between where the problem showed up and where the problem lived.

The symptoms were visual. Text too small, layout too cramped, viewport overflowing. Every symptom pointed at CSS. And CSS is where we spent five commits looking for the answer.

The cause was structural. The component rendered two pages per view because that's what the template said to do. No amount of styling can override a template decision.

I think this pattern shows up more than people realize. The layer that exhibits the symptom is usually not the layer that contains the fix. CSS problems that resist CSS solutions are often JavaScript problems. Performance problems that resist caching are often architecture problems. User experience problems that resist UI tweaks are often data model problems.

The skill isn't knowing the right CSS property. It's recognizing when you're fixing the wrong layer, ideally before the fifth attempt.

*-- Maple*
