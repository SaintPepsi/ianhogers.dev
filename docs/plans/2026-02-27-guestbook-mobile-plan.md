# Guestbook Mobile Single-Page View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show 1 page per carousel item on viewports under 800px wide, keeping the sprite animation and all interactive features working.

**Architecture:** Add a reactive `isMobile` boolean via `matchMedia`. Refactor the carousel template from duplicated left/right branches into a clean inner loop over page indices. On mobile the loop runs once (1 page), on desktop twice (2 pages). This both adds mobile support and reduces template duplication.

**Tech Stack:** Svelte 4 (Astro integration), CSS scroll-timeline, matchMedia API

**Design doc:** `docs/plans/2026-02-27-guestbook-mobile-design.md`

---

### Task 1: Add isMobile reactive state and slideCount

**Files:**
- Modify: `src/components/guestbook/GuestBook.svelte:1-53` (script section)

**Step 1: Add onDestroy import**

Change line 2 from:
```svelte
import { onMount } from 'svelte';
```
to:
```svelte
import { onMount, onDestroy } from 'svelte';
```

**Step 2: Add isMobile state and matchMedia listener variables**

After line 20 (`let carouselEl: HTMLDivElement;`), add:
```typescript
let isMobile: boolean = false;
let mobileQuery: MediaQueryList | undefined;
let handleMobileChange: ((e: MediaQueryListEvent) => void) | undefined;
```

**Step 3: Add reactive slideCount**

After line 49 (`$: spreadCount = Math.ceil(totalPages / 2);`), add:
```typescript
$: slideCount = isMobile ? totalPages : spreadCount;
```

**Step 4: Add matchMedia setup to onMount**

At the start of the `onMount` callback (line 111, after the opening `async () => {`), add:
```typescript
// Mobile detection
mobileQuery = window.matchMedia('(max-width: 800px)');
isMobile = mobileQuery.matches;
handleMobileChange = (e) => { isMobile = e.matches; };
mobileQuery.addEventListener('change', handleMobileChange);
```

**Step 5: Add onDestroy for cleanup**

After the `onMount` block (after line 122), add:
```typescript
onDestroy(() => {
  if (mobileQuery && handleMobileChange) {
    mobileQuery.removeEventListener('change', handleMobileChange);
  }
});
```

**Step 6: Verify build compiles**

Run: `npx astro check 2>&1 | head -20`
Expected: No errors in GuestBook.svelte

**Step 7: Commit**

```bash
git add src/components/guestbook/GuestBook.svelte
git commit -m "feat(guestbook): add isMobile reactive state and slideCount"
```

---

### Task 2: Refactor template to inner page loop with mobile support

**Files:**
- Modify: `src/components/guestbook/GuestBook.svelte:142-294` (template section)

This is the core change. Replace the current duplicated left/right page template with a clean inner loop. The current template has ~130 lines of near-identical markup for left vs right pages. The refactored version uses `{#each pageIndices as pageIdx}` to loop over page indices, rendering 1 page on mobile and 2 on desktop.

**Step 1: Remove getSpreadPages function**

Delete lines 51-53 (the `getSpreadPages` function). It's replaced by inline logic in the new template below.

**Step 2: Replace the carousel section**

Replace everything from the `<!-- Scroll-timeline carousel -->` comment (line 145) through the closing `</div>` of the carousel (line 291) with:

```svelte
        <!-- Scroll-timeline carousel -->
        <div class="carousel" class:no-scroll={$isDragging || isWriteMode} style="--slides: {slideCount}; --sprite-slides: {spreadCount};" bind:this={carouselEl} on:scroll={handleCarouselScroll}>
          <!-- Sprite sheet for page-flip animation -->
          <div class="sprite"></div>

          <!-- Carousel items -->
          {#each Array(slideCount) as _, si}
            {@const pageIndices = isMobile ? [si] : [si * 2, si * 2 + 1]}
            <div class="carousel-item">
              <div class="page-container" style="{si !== activeSpread ? 'pointer-events: none;' : ''}">
                {#each pageIndices as pageIdx, pi}
                  {@const pageClass = isMobile ? 'single-page' : (pi === 0 ? 'left-page' : 'right-page')}
                  <div class={pageClass} class:cover-page={pageIdx === 0} class:title-page={pageIdx === 1}>
                    <Page
                      pageIndex={pageIdx}
                      notes={notesByPage[pageIdx] || []}
                      isWritable={!isWriteMode}
                      gridConfig={pageIdx === 1 ? { cols: 9, rows: 16 } : undefined}
                    >
                      {#if pageIdx === 0}
                        <!-- Cover page content -->
                        <div class="cover-inner" style="grid-column: 1 / -1; grid-row: 1 / -1; pointer-events: none;">
                          <img
                            src="/assets/pixel-art/decorative/sample-bunny.png"
                            alt="Pixel bunny"
                            class="cover-bunny pixel-sprite"
                          />
                          <h1 class="cover-title">Guest Book</h1>
                        </div>
                      {/if}
                      {#if pageIdx === 1}
                        <!-- Title page content -->
                        <div class="title-header" style="grid-row: 1 / 7; grid-column: 1 / -1; pointer-events: none;">
                          <h1 class="title-main">Guest Book</h1>
                          <p class="title-subtitle">by Ian Hogers</p>
                          <p class="title-credit">
                            Thank you for visiting my corner of the web, I would love for you to leave your mark in this book! thank you
                          </p>
                        </div>
                      {/if}
                      <NoteRenderer
                        notes={notesByPage[pageIdx] || []}
                        pageIndex={pageIdx}
                      />
                      {#if si === activeSpread}
                        <DragSelector
                          occupancyMap={pageIdx === 1
                            ? (() => { const m = new OccupancyMap(notesByPage[pageIdx] || []); m.addNote({ row_start: 1, row_end: 4, col_start: 4, col_end: 7 }); m.addNote({ row_start: 4, row_end: 5, col_start: 1, col_end: 10 }); return m; })()
                            : new OccupancyMap(notesByPage[pageIdx] || [])}
                          on:select={(e) => handleSelect(e, pageIdx)}
                        />
                      {/if}
                      {#if isWriteMode && activePageIndex === pageIdx && selection}
                        <WriteMode
                          {selection}
                          pageIndex={pageIdx}
                          bind:text={writeText}
                          onsubmit={handleSubmit}
                          oncancel={handleCancel}
                        />
                      {/if}
                    </Page>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
```

Key changes from the old template:
- `spreadCount` → `slideCount` in the outer each loop and `--slides` CSS variable
- New `--sprite-slides: {spreadCount}` keeps sprite animation frame count correct regardless of mobile/desktop
- Inner `{#each pageIndices as pageIdx, pi}` replaces the duplicated left/right blocks
- Cover detection: `pageIdx === 0` instead of `si === 0` on left page
- Title detection: `pageIdx === 1` instead of `si === 0` on right page
- Page class: `single-page` on mobile, `left-page`/`right-page` on desktop

**Step 3: Verify build compiles**

Run: `npx astro check 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/guestbook/GuestBook.svelte
git commit -m "refactor(guestbook): inner page loop with mobile single-page support"
```

---

### Task 3: Add CSS for single-page mobile layout and fix sprite animation

**Files:**
- Modify: `src/components/guestbook/GuestBook.svelte:548-553` (scoped styles)

**Step 1: Add single-page class to existing page styles**

Change:
```css
.left-page, .right-page {
  flex: 1;
  overflow: visible;
  position: relative;
  padding: 15px;
}
```
to:
```css
.left-page, .right-page, .single-page {
  flex: 1;
  overflow: visible;
  position: relative;
  padding: 15px;
}
```

**Step 2: Update sprite animation to use --sprite-slides**

In the `.sprite` CSS block, change:
```css
    --sprite-fe: calc(var(--sprite-f) * (var(--slides) - 1));
```
to:
```css
    --sprite-fe: calc(var(--sprite-f) * (var(--sprite-slides) - 1));
```

This decouples the sprite frame calculation from the carousel slide count. On mobile, `--slides` doubles (one per page) but `--sprite-slides` stays at `spreadCount`, keeping the sprite animation showing the correct book-flip frames.

**Step 3: Verify build**

Run: `npx astro check 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/guestbook/GuestBook.svelte
git commit -m "style(guestbook): add single-page class and fix sprite animation for mobile"
```

---

### Task 4: Visual verification

**Step 1: Start dev server**

Run: `npx astro dev` (background)

**Step 2: Verify desktop view**

Open browser at full width (>800px). Navigate to `/guestbook`.
Expected: Two-page spreads, identical to current behavior. Cover + title on first spread.

**Step 3: Verify mobile view**

Resize browser below 800px (or use DevTools responsive mode).
Expected:
- Each swipe shows 1 page
- First swipe: cover page with bunny + "Guest Book" title
- Second swipe: title page with "by Ian Hogers" and welcome text
- Subsequent swipes: content pages with notes
- Sprite book animation still visible and animates on scroll
- Progress bar updates correctly
- Scroll buttons work

**Step 4: Verify interactive features on mobile**

On mobile view:
- Drag to select cells on a page → selection box appears
- Type a note → write mode works
- Sticker overlays render correctly

**Step 5: Verify breakpoint transition**

Slowly resize browser across the 800px boundary.
Expected: Layout switches between single-page and spread without page jump or broken state.

**Step 6: Commit if all checks pass**

```bash
git add -A
git commit -m "feat(guestbook): mobile single-page view for viewports under 800px"
```
