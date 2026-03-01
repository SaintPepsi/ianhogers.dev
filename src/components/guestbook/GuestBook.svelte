<script lang="ts">
  import type { GuestbookNote } from './lib/types';
  import { OccupancyMap } from './lib/occupancy';
  import { isDragging } from './lib/dragState';
  import Page from './Page.svelte';
  import NoteRenderer from './NoteRenderer.svelte';
  import DragSelector from './DragSelector.svelte';
  import WriteMode from './WriteMode.svelte';

  // State
  let notes = $state<GuestbookNote[]>([]);
  let isWriteMode = $state(false);
  let selection = $state<{ rowStart: number; rowEnd: number; colStart: number; colEnd: number } | null>(null);
  let activePageIndex = $state(-1);
  let writeText = $state('');
  let isLoading = $state(true);
  let error = $state('');
  let activeSpread = $state(0);
  let carouselEl = $state<HTMLDivElement | undefined>(undefined);
  let isMobile = $state(false);
  let mobileQuery: MediaQueryList | null = null;
  let mobileActivePage = $state(0);
  let mobileSpriteTH = $state(0);
  let mobileSpriteFrame = $state(0);
  let isAnimatingSpread = $state(false);

  function handleMobileChange(e: MediaQueryListEvent | MediaQueryList) {
    isMobile = e.matches;
    if (!isMobile) {
      mobileActivePage = 0;
      mobileSpriteTH = 0;
      mobileSpriteFrame = 0;
      isAnimatingSpread = false;
    } else {
      mobileActivePage = activeSpread * 2;
      mobileSpriteFrame = activeSpread * 7;
      computeMobileBookSize();
    }
  }

  function computeMobileBookSize() {
    if (!isMobile) { mobileSpriteTH = 0; return; }
    const SPRITE_W = 9600;
    const SPRITE_H = 3000;
    const SPRITE_C = 5;
    const SPRITE_F = 7;
    const SPRITE_R = Math.ceil(SPRITE_F / SPRITE_C);
    const SPRITE_SH = SPRITE_H / SPRITE_R;
    const VISIBLE_W_RATIO = 0.7042;
    const VISIBLE_H_RATIO = 0.6107;

    // One page = half the carousel width. Size so one page fills viewport minus padding.
    const padding = 32;
    const targetPageWidth = window.innerWidth - padding * 2;
    let th = (2 * targetPageWidth * SPRITE_SH * SPRITE_C) / (SPRITE_W * VISIBLE_W_RATIO);

    // Cap at 75vh
    const maxCarouselH = window.innerHeight * 0.75;
    const carouselH = th * VISIBLE_H_RATIO;
    if (carouselH > maxCarouselH) {
      th = maxCarouselH / VISIBLE_H_RATIO;
    }

    mobileSpriteTH = th;
  }

  // Animate sprite frames between spreads (page-flip effect)
  function animateSprite(fromFrame: number, toFrame: number, onComplete: () => void) {
    const duration = 400;
    const startTime = performance.now();

    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      mobileSpriteFrame = Math.round(fromFrame + (toFrame - fromFrame) * progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  // Mobile: navigate to specific page
  function mobileGoToPage(page: number) {
    if (page < 0 || page >= totalPages || isAnimatingSpread) return;
    const prevSpread = Math.floor(mobileActivePage / 2);
    const newSpread = Math.floor(page / 2);

    mobileActivePage = page;
    activeSpread = newSpread;

    if (prevSpread !== newSpread) {
      isAnimatingSpread = true;
      animateSprite(prevSpread * 7, newSpread * 7, () => {
        isAnimatingSpread = false;
      });
    }
  }

  function mobileNext() {
    mobileGoToPage(mobileActivePage + 1);
  }

  function mobilePrev() {
    mobileGoToPage(mobileActivePage - 1);
  }

  // Desktop scroll handler (unchanged)
  function handleCarouselScroll() {
    if (!carouselEl || isMobile) return;
    const itemWidth = carouselEl.clientWidth;
    if (itemWidth === 0) return;
    activeSpread = Math.round(carouselEl.scrollLeft / itemWidth);
  }

  // Derived: organize notes by page_index
  let notesByPage = $derived(notes.reduce<Record<number, GuestbookNote[]>>((acc, note) => {
    if (!acc[note.page_index]) acc[note.page_index] = [];
    acc[note.page_index].push(note);
    return acc;
  }, {}));

  // Determine total spread count (minimum 2: cover+title, first content spread)
  let totalPages = $derived.by(() => {
    const maxPageIndex = notes.reduce((max, n) => Math.max(max, n.page_index), 1);
    let neededPages = Math.max(4, maxPageIndex + 2);
    const lastPageNotes = notesByPage[neededPages - 1] || [];
    const lastPageOccupancy = new OccupancyMap(lastPageNotes);
    if (lastPageOccupancy.getOccupancy() > 0.7) {
      neededPages += 2;
    }
    return neededPages;
  });

  let spreadCount = $derived(Math.ceil(totalPages / 2));
  // On mobile, each page is a slide; on desktop, each spread is a slide
  let slideCount = $derived(isMobile ? totalPages : spreadCount);

  // Write mode
  function handleSelect(detail: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }, pageIndex: number) {
    // If write mode is active with content, ignore new selections
    if (isWriteMode && writeText.trim()) return;

    selection = detail;
    activePageIndex = pageIndex;
    isWriteMode = true;
    writeText = '';
  }

  function exitWriteMode() {
    isWriteMode = false;
    selection = null;
    activePageIndex = -1;
    writeText = '';
  }

  async function handleSubmit(detail: { text: string; author: string }) {
    const { text, author } = detail;
    if (!selection || activePageIndex < 0) return;

    try {
      const response = await fetch('/api/guestbook/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_index: activePageIndex,
          row_start: selection.rowStart,
          row_end: selection.rowEnd,
          col_start: selection.colStart,
          col_end: selection.colEnd,
          text,
          author,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save note');
      }

      const newNote: GuestbookNote = await response.json();
      notes = [...notes, newNote];
      exitWriteMode();
    } catch (err) {
      console.error('Failed to submit note:', err);
    }
  }

  function handleCancel() {
    exitWriteMode();
  }

  function handleResize() {
    computeMobileBookSize();
  }

  // Fetch notes on mount + mobile detection
  $effect(() => {
    mobileQuery = window.matchMedia('(max-width: 799px)');
    handleMobileChange(mobileQuery);
    mobileQuery.addEventListener('change', handleMobileChange);
    window.addEventListener('resize', handleResize);
    // Compute after layout settles
    requestAnimationFrame(() => requestAnimationFrame(() => computeMobileBookSize()));

    (async () => {
      try {
        const response = await fetch('/api/guestbook/notes');
        if (!response.ok) throw new Error('Failed to fetch notes');
        notes = await response.json();
      } catch (err) {
        console.error('Failed to load guestbook:', err);
        error = 'Could not open the guest book. Please try again later.';
      } finally {
        isLoading = false;
      }
    })();

    return () => {
      if (mobileQuery) {
        mobileQuery.removeEventListener('change', handleMobileChange);
      }
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<div class="guestbook-container">
  {#if isLoading}
    <div class="loading-state">
      <img
        src="/assets/pixel-art/decorative/sample-bunny.png"
        alt=""
        class="loading-bunny pixel-sprite"
      />
      <p class="loading-text">Opening the guest book...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-text">{error}</p>
      <button class="retry-btn" onclick={() => location.reload()}>
        Try again
      </button>
    </div>
  {:else}
    <div class="sprite-wrapper">
      <div class="book" style="{isMobile && mobileSpriteTH ? `--sprite-th: ${mobileSpriteTH};` : ''}">
        <!-- Scroll-timeline carousel -->
        <div
          class="carousel"
          class:mobile-carousel={isMobile}
          style="--slides: {slideCount};{isMobile ? ` --mobile-page-in-spread: ${mobileActivePage % 2}; --mobile-sprite-frame: ${mobileSpriteFrame};` : ''}"
          bind:this={carouselEl}
          onscroll={handleCarouselScroll}
        >
          <!-- Sprite sheet for page-flip animation -->
          <div class="sprite"></div>

          <!-- Carousel items (one per spread) -->
          {#each Array(spreadCount) as _, si}
            {@const leftIdx = si * 2}
            {@const rightIdx = si * 2 + 1}
            <div class="carousel-item" style="{isMobile && si !== activeSpread ? 'display: none;' : ''}">
              <div class="page-container" style="{si !== activeSpread ? 'pointer-events: none;' : ''}">
                {#each [leftIdx, rightIdx] as pageIdx, pi}
                  <div
                    class={isMobile ? 'mobile-page' : (pi === 0 ? 'left-page' : 'right-page')}
                    class:cover-page={pageIdx === 0}
                    class:title-page={pageIdx === 1}
                  >
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
                          onselect={(detail) => handleSelect(detail, pageIdx)}
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
        {#if isMobile}
          <div class="mobile-nav">
            <button class="mobile-nav-btn" disabled={mobileActivePage === 0} onclick={mobilePrev} aria-label="Previous page">&#9664;</button>
            <span class="mobile-nav-indicator">{mobileActivePage + 1} / {totalPages}</span>
            <button class="mobile-nav-btn" disabled={mobileActivePage >= totalPages - 1} onclick={mobileNext} aria-label="Next page">&#9654;</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Grand9KPixel loaded via global.css @font-face */

  .guestbook-container {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    overflow-x: clip;
  }

  @media (max-width: 799px) {
    .guestbook-container {
      padding: 0;
    }
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
  }

  .loading-bunny {
    width: 48px;
    height: 48px;
    animation: bounce 1s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }

  .loading-text {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.9rem;
    color: #b0a898;
    image-rendering: pixelated;
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 1rem;
  }

  .error-text {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.8rem;
    color: #ef5350;
    image-rendering: pixelated;
  }

  .retry-btn {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.7rem;
    background: #1e1a28;
    color: #f5f0e8;
    border: 1px solid #4a4458;
    border-radius: 2px;
    padding: 4px 16px;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: #2a2438;
  }

  /* ═══════════════════════════════════════
     SPRITE-BASED BOOK (Maseone architecture)
     ═══════════════════════════════════════ */

  .sprite-wrapper {
    position: relative;
    width: 100%;
    margin: 0 auto;
  }

  .book {
    --sprite-image: url('/assets/guestbook/book-sprite.webp');

    /* Sprite sheet dimensions and frame config */
    --sprite-c: 5;       /* sprite columns */
    --sprite-h: 3000;    /* sprite image height (px) */
    --sprite-w: 9600;    /* sprite image width (px) */
    --sprite-f: 7;       /* total sprite frames */
    --sprite-fr: 12;     /* frame rate */
    --sprite-as: calc(var(--sprite-f) / var(--sprite-fr) * 1s);

    /* Derived calculations */
    --sprite-r: round(up, calc(var(--sprite-f) / var(--sprite-c)), 1);
    --sprite-sh: calc(var(--sprite-h) / var(--sprite-r));
    --sprite-th: calc(var(--sprite-sh) / 2);
    --sprite-ar: calc(var(--sprite-th) / var(--sprite-sh));
    --sprite-uh: calc(var(--sprite-h) * var(--sprite-ar));
    --sprite-uw: calc(var(--sprite-w) * var(--sprite-ar));
    --sprite-tw: calc(var(--sprite-uw) / var(--sprite-c));

    position: relative;
    display: grid;
    grid-template-areas:
      "scroll scroll scroll"
      "left markers right";
    gap: 1rem;
  }

  /* Sprite animation element */
  .sprite {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(1px * var(--sprite-th));
    width: calc(1px * var(--sprite-tw));
    margin: calc(-1px * calc((var(--sprite-th) - (var(--sprite-th) * 0.6107)) / 2))
            calc(-1px * calc((var(--sprite-tw) - (var(--sprite-tw) * 0.7042)) / 2));
    background-image: var(--sprite-image);
    transform-origin: center center;
    background-repeat: no-repeat;
    background-size: calc(1px * var(--sprite-uw)) calc(1px * var(--sprite-uh));
    z-index: -1;
    pointer-events: none;
    image-rendering: pixelated;

    --sprite-fe: calc(var(--sprite-f) * (var(--slides) - 1));
    --sprite-fs-n: mod(var(--sprite-fs), var(--sprite-f));
    --row: calc(round(down, calc(calc(var(--sprite-tw) * var(--sprite-fs-n)) / var(--sprite-uw)), 1) * var(--sprite-th));
    --col: mod(calc(var(--sprite-tw) * var(--sprite-fs-n)), var(--sprite-uw));

    background-position: calc(-1px * var(--col)) calc(-1px * var(--row));
    animation: frame var(--sprite-as) linear 0s normal none running;
    animation-timeline: --carousel-timeline;
  }

  /* Carousel: scroll-snap + scroll-timeline */
  .carousel {
    grid-area: scroll;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;

    display: grid;
    margin: 0 auto;
    width: calc(1px * (var(--sprite-tw) * 0.7042));
    height: calc(1px * (var(--sprite-th) * 0.6107));
    grid: 1fr / auto-flow 100%;
    scroll-timeline: --carousel-timeline x;
    scroll-behavior: smooth;
    scrollbar-width: none;
    scroll-marker-group: after;
  }

  /* Hide scrollbar */
  .carousel::-webkit-scrollbar {
    display: none;
  }

  /* Native scroll buttons (Chrome 134+) */
  .carousel::scroll-button(*) {
    inline-size: 48px;
    aspect-ratio: 1;
    border-radius: 0;
    border: 0;
    background-color: transparent;
    cursor: none;
  }

  .carousel::scroll-button(*):disabled {
    filter: invert(1);
    opacity: 0.5;
  }

  .carousel::scroll-button(*):not(:disabled):is(:hover, :active) {
    filter: drop-shadow(2px 4px 6px black);
  }

  .carousel::scroll-button(*):not(:disabled):active {
    scale: 90%;
  }

  .carousel::scroll-button(left) {
    content: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMjMyLjAwMDAwMCAyNTYuMDAwMDAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBtZWV0IiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdHJhbnNmb3JtPSJtYXRyaXgoLTEsMCwwLDEsMCwwKSI+Cgo8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwyNTYuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSIjZmZmIiBzdHJva2U9Im5vbmUiPgo8cGF0aCBkPSJNMTE4MCAyMTEwIGwwIC0xODAgLTU0MCAwIC01NDAgMCAwIC03MjUgMCAtNzI1IDU0MCAwIDU0MCAwIDAgLTE4MCAwIC0xODAgMTIwIDAgMTIwIDAgMCA2MCAwIDYwIDYwIDAgNjAgMCAwIDYwIDAgNjAgNjAgMCA2MCAwIDAgNjAgMCA2MCA2MCAwIDYwIDAgMCA2MCAwIDYwIDYwIDAgNjAgMCAwIDYwIDAgNjAgNjAgMCA2MCAwIDAgNjAgMCA2MCA2MCAwIDYwIDAgMCA1MyBjMCAyOSA1IDU4IDEyIDY1IDcgNyAzNCAxMiA2MCAxMiBsNDggMCAwIDIzNSAwIDIzNSAtNjAgMCAtNjAgMCAwIDY1IDAgNjUgLTQ3IDAgYy02OCAwIC03NSAtNyAtNzEgLTcxIGwzIC01NCA1OCAtMyA1NyAtMyAwIC0xMTkgMCAtMTIwIC01NSAwIC01NCAwIC0zIC01NyAtMyAtNTggLTYwIC01IC02MCAtNSAtMyAtNTcgLTMgLTU3IC01NyAtMyAtNTcgLTMgLTMgLTU3IC0zIC01NyAtNTcgLTMgLTU3IC0zIC0zIC01NyAtMyAtNTcgLTU3IC0zIC01NyAtMyAtMyAtNTcgLTMgLTU3IC01NyAtMyAtNTcgLTMgLTMgLTU4IC0zIC01OCAtNTcgMyAtNTcgMyAtMyAxNzggLTIgMTc3IC01NDAgMCAtNTQwIDAgMiA0ODMgMyA0ODIgNTM3IDMgNTM2IDIgNyAzMiBjNCAxNyA2IDk3IDQgMTc3IGwtNCAxNDYgNTggMyA1NyAzIDAgLTYxIDAgLTYwIDYwIDAgNjAgMCAwIC02MCAwIC02MCA2MCAwIDYwIDAgMCAtNjAgMCAtNjAgNjAgMCA2MCAwIDAgLTYwIDAgLTYwIDYwIDAgNjAgMCAwIC02MCAwIC02MCA2MCAwIDYwIDAgMCA2MCAwIDYwIC02MCAwIC02MCAwIDAgNjAgMCA2MCAtNjAgMCAtNjAgMCAwIDYwIDAgNjAgLTYwIDAgLTYwIDAgMCA2MCAwIDYwIC02MCAwIC02MCAwIDAgNjAgMCA2MCAtNjAgMCAtNjAgMCAwIDYwIDAgNjAgLTEyMCAwIC0xMjAgMCAwIC0xODB6Ij48L3BhdGg+CjwvZz4KPC9zdmc+") / "Scroll Left";
    grid-area: left;
  }

  .carousel::scroll-button(right) {
    content: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMjMyLjAwMDAwMCAyNTYuMDAwMDAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBtZWV0Ij4KCjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAuMDAwMDAwLDI1Ni4wMDAwMDApIHNjYWxlKDAuMTAwMDAwLC0wLjEwMDAwMCkiIGZpbGw9IiNmZmYiIHN0cm9rZT0ibm9uZSI+CjxwYXRoIGQ9Ik0xMTgwIDIxMTAgbDAgLTE4MCAtNTQwIDAgLTU0MCAwIDAgLTcyNSAwIC03MjUgNTQwIDAgNTQwIDAgMCAtMTgwIDAgLTE4MCAxMjAgMCAxMjAgMCAwIDYwIDAgNjAgNjAgMCA2MCAwIDAgNjAgMCA2MCA2MCAwIDYwIDAgMCA2MCAwIDYwIDYwIDAgNjAgMCAwIDYwIDAgNjAgNjAgMCA2MCAwIDAgNjAgMCA2MCA2MCAwIDYwIDAgMCA2MCAwIDYwIDYwIDAgNjAgMCAwIDUzIGMwIDI5IDUgNTggMTIgNjUgNyA3IDM0IDEyIDYwIDEyIGw0OCAwIDAgMjM1IDAgMjM1IC02MCAwIC02MCAwIDAgNjUgMCA2NSAtNDcgMCBjLTY4IDAgLTc1IC03IC03MSAtNzEgbDMgLTU0IDU4IC0zIDU3IC0zIDAgLTExOSAwIC0xMjAgLTU1IDAgLTU0IDAgLTMgLTU3IC0zIC01OCAtNjAgLTUgLTYwIC01IC0zIC01NyAtMyAtNTcgLTU3IC0zIC01NyAtMyAtMyAtNTcgLTMgLTU3IC01NyAtMyAtNTcgLTMgLTMgLTU3IC0zIC01NyAtNTcgLTMgLTU3IC0zIC0zIC01NyAtMyAtNTcgLTU3IC0zIC01NyAtMyAtMyAtNTggLTMgLTU4IC01NyAzIC01NyAzIC0zIDE3OCAtMiAxNzcgLTU0MCAwIC01NDAgMCAyIDQ4MyAzIDQ4MiA1MzcgMyA1MzYgMiA3IDMyIGM0IDE3IDYgOTcgNCAxNzcgbC00IDE0NiA1OCAzIDU3IDMgMCAtNjEgMCAtNjAgNjAgMCA2MCAwIDAgLTYwIDAgLTYwIDYwIDAgNjAgMCAwIC02MCAwIC02MCA2MCAwIDYwIDAgMCAtNjAgMCAtNjAgNjAgMCA2MCAwIDAgLTYwIDAgLTYwIDYwIDAgNjAgMCAwIDYwIDAgNjAgLTYwIDAgLTYwIDAgMCA2MCAwIDYwIC02MCAwIC02MCAwIDAgNjAgMCA2MCAtNjAgMCAtNjAgMCAwIDYwIDAgNjAgLTYwIDAgLTYwIDAgMCA2MCAwIDYwIC02MCAwIC02MCAwIDAgNjAgMCA2MCAtMTIwIDAgLTEyMCAwIDAgLTE4MHoiLz4KPC9nPgo8L3N2Zz4=") / "Scroll Right";
    grid-area: right;
    justify-self: flex-end;
  }

  /* Scroll marker progress bar */
  .carousel::scroll-marker-group {
    content: "";
    width: 100%;
    height: 8px;
    padding: 2px 0;
    display: grid;
    position: absolute;
    grid-area: markers;
    grid-auto-flow: column;
    place-self: center;
    overflow: hidden;
    border: 1px solid #4a4458;
    cursor: none;
    background: linear-gradient(90deg, #f1e2b2 0%) no-repeat left center;
    --_progress: calc(calc(100 / var(--slides)) * 1%);
    background-size: var(--_progress, 20%) 100%;
    animation: progress linear both;
    animation-timeline: --carousel-timeline;
  }

  /* Carousel items */
  .carousel-item {
    scroll-snap-stop: always;
    scroll-snap-align: start;
    position: relative;
    box-sizing: border-box;
  }

  .carousel-item::scroll-marker {
    content: '';
    position: relative;
    left: -1px;
    width: 100%;
    height: 100%;
    display: block;
    box-sizing: border-box;
    box-shadow: 2px 0 0 #4a4458;
    cursor: none;
  }

  .carousel-item:last-of-type::scroll-marker {
    box-shadow: none;
  }

  /* Page container inside each carousel item */
  .page-container {
    display: flex;
    gap: 0;
    height: 100%;
    animation: stay-centered linear both;
    animation-timeline: view(x);
  }

  .left-page, .right-page {
    flex: 1;
    overflow: visible;
    position: relative;
    padding: 15px;
    container-type: inline-size;
  }

  /* Keyframes matching reference */
  @keyframes stay-centered {
    entry 0% {
      opacity: 0;
      translate: -100%;
    }
    entry 75% {
      opacity: 0;
      translate: -25%;
    }
    entry 100% {
      opacity: 1;
      translate: 0%;
    }
    exit 0% {
      opacity: 1;
      translate: 0%;
    }
    exit 50% {
      opacity: 0;
      translate: 50%;
    }
    exit 100% {
      opacity: 0;
      translate: 100%;
    }
  }

  @keyframes progress {
    100% {
      --_progress: 100%;
    }
  }

  @keyframes frame {
    to {
      --sprite-fs: var(--sprite-fe);
    }
  }

  /* Responsive sizing */
  @media (width < 748px) {
    .book {
      --sprite-th: calc(var(--sprite-sh) / 2.5);
    }
  }

  @media (width < 560px) {
    .book {
      --sprite-th: calc(var(--sprite-sh) / 4);
    }
  }

  /* ═══════════════════════════════════════
     MOBILE: translate-based page navigation
     ═══════════════════════════════════════ */

  /* Mobile carousel: natively sized, one page fills viewport */
  .mobile-carousel {
    overflow: visible;
    scroll-snap-type: none;
    scroll-timeline: none;
    transform: translateX(calc(32px - 50% * var(--mobile-page-in-spread, 0)));
    transition: transform 0.3s ease;
  }

  /* Mobile: all carousel items laid out in a row */
  .mobile-carousel .carousel-item {
    scroll-snap-align: unset;
    scroll-snap-stop: unset;
  }

  /* Mobile: fade-in when carousel item goes from display:none to visible */
  .mobile-carousel .carousel-item {
    transition: opacity 0.25s ease;

    @starting-style {
      opacity: 0;
    }
  }

  /* Mobile: disable scroll-driven page animation */
  .mobile-carousel .page-container {
    animation: none;
  }

  /* Mobile: disable CSS scroll-timeline sprite, use JS-controlled frames */
  .mobile-carousel .sprite {
    animation: none;
    --sprite-fs-n: mod(var(--mobile-sprite-frame, 0), var(--sprite-f));
  }

  /* Mobile: each page takes half the spread (= half the carousel width) */
  .mobile-page {
    flex: 0 0 50%;
    overflow: visible;
    position: relative;
    padding: 15px;
    container-type: inline-size;
  }

  /* Mobile: hide CSS scroll-buttons (we use JS buttons) */
  .mobile-carousel::scroll-button(*) {
    display: none;
  }

  /* Mobile: hide scroll markers and progress bar */
  .mobile-carousel::scroll-marker-group {
    display: none;
  }

  .mobile-carousel .carousel-item::scroll-marker {
    display: none;
  }

  /* Mobile navigation buttons — centered on viewport */
  .mobile-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.5rem;
    position: relative;
    z-index: 10;
    width: 100vw;
    left: 50%;
    transform: translateX(-50%);
  }

  .mobile-nav-btn {
    font-family: 'Grand9KPixel', monospace;
    font-size: 1.2rem;
    background: transparent;
    color: #f5f0e8;
    border: none;
    padding: 8px 12px;
    cursor: pointer;
    image-rendering: pixelated;
  }

  .mobile-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .mobile-nav-indicator {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.6rem;
    color: #b0a898;
    image-rendering: pixelated;
  }

  /* Cover page */
  .cover-page {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    height: 100%;
  }

  .cover-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .cover-bunny {
    width: 18cqi;
    height: 18cqi;
  }

  .cover-title {
    font-family: 'Grand9KPixel', monospace;
    font-size: 5cqi;
    color: #333;
    text-align: center;
    letter-spacing: 0.05em;
    margin: 0;
    image-rendering: pixelated;
  }

  /* Title page */
  .title-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    z-index: 1;
  }

  .title-main {
    font-family: 'Grand9KPixel', monospace;
    font-size: 5cqi;
    color: #333;
    text-align: center;
    margin: 0 0 0.15rem 0;
    image-rendering: pixelated;
  }

  .title-subtitle {
    font-family: 'Grand9KPixel', monospace;
    font-size: 3cqi;
    color: hsl(45.71deg 69.23% 30%);
    text-align: center;
    margin: 0 0 0.5rem 0;
    image-rendering: pixelated;
  }

  .title-credit {
    font-size: 2.2cqi;
    color: hsl(45.71deg 69.23% 40%);
    text-align: center;
    font-family: 'Grand9KPixel', monospace;
    max-width: 80%;
    line-height: 1.3;
    margin: 0;
    image-rendering: pixelated;
  }

  .title-notes-area {
    position: relative;
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    grid-template-rows: repeat(4, 1fr);
    z-index: 1;
  }
</style>
