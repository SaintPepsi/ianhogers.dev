<script lang="ts">
  import { onMount } from 'svelte';
  import type { GuestbookNote } from './lib/types';
  import { OccupancyMap } from './lib/occupancy';
  import { isDragging } from './lib/dragState';
  import Page from './Page.svelte';
  import NoteRenderer from './NoteRenderer.svelte';
  import DragSelector from './DragSelector.svelte';
  import WriteMode from './WriteMode.svelte';

  // State
  let notes: GuestbookNote[] = [];
  let isWriteMode: boolean = false;
  let selection: { rowStart: number; rowEnd: number; colStart: number; colEnd: number } | null = null;
  let activePageIndex: number = -1;
  let writeText: string = '';
  let isLoading: boolean = true;
  let error: string = '';
  let activeSpread: number = 0;
  let carouselEl: HTMLDivElement;

  // Page turn sounds
  const PAGE_TURN_SOUNDS = [
    '/assets/guestbook/sounds/page-turn-1.m4a',
    '/assets/guestbook/sounds/page-turn-2.m4a',
    '/assets/guestbook/sounds/page-turn-3.m4a',
  ];
  let pageTurnAudios: HTMLAudioElement[] = [];

  onMount(() => {
    pageTurnAudios = PAGE_TURN_SOUNDS.map((src) => {
      const audio = new Audio(src);
      audio.volume = 0.3;
      return audio;
    });
  });

  function playPageTurnSound() {
    if (pageTurnAudios.length === 0) return;
    const audio = pageTurnAudios[Math.floor(Math.random() * pageTurnAudios.length)];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function handleCarouselScroll() {
    if (!carouselEl) return;
    const itemWidth = carouselEl.clientWidth;
    if (itemWidth === 0) return;
    const newSpread = Math.round(carouselEl.scrollLeft / itemWidth);
    if (newSpread !== activeSpread) {
      playPageTurnSound();
    }
    activeSpread = newSpread;
  }

  // Derived: organize notes by page_index
  $: notesByPage = notes.reduce<Record<number, GuestbookNote[]>>((acc, note) => {
    if (!acc[note.page_index]) acc[note.page_index] = [];
    acc[note.page_index].push(note);
    return acc;
  }, {});

  // Determine total spread count (minimum 2: cover+title, first content spread)
  $: {
    const maxPageIndex = notes.reduce((max, n) => Math.max(max, n.page_index), 1);
    let neededPages = Math.max(4, maxPageIndex + 2);
    const lastPageNotes = notesByPage[neededPages - 1] || [];
    const lastPageOccupancy = new OccupancyMap(lastPageNotes);
    if (lastPageOccupancy.getOccupancy() > 0.7) {
      neededPages += 2;
    }
    totalPages = neededPages;
  }

  let totalPages = 4;
  $: spreadCount = Math.ceil(totalPages / 2);

  function getSpreadPages(spreadIndex: number): [number, number] {
    return [spreadIndex * 2, spreadIndex * 2 + 1];
  }


  // Write mode
  function handleSelect(e: CustomEvent, pageIndex: number) {
    // If write mode is active with content, ignore new selections
    if (isWriteMode && writeText.trim()) return;

    selection = e.detail;
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

  // Fetch notes on mount
  onMount(async () => {
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
      <button class="retry-btn" on:click={() => location.reload()}>
        Try again
      </button>
    </div>
  {:else}
    <div class="sprite-wrapper">
      <div class="book">
        <!-- Scroll-timeline carousel -->
        <div class="carousel" class:no-scroll={$isDragging || isWriteMode} style="--slides: {spreadCount};" bind:this={carouselEl} on:scroll={handleCarouselScroll}>
          <!-- Sprite sheet for page-flip animation -->
          <div class="sprite"></div>

          <!-- Carousel items (one per spread) -->
          {#each Array(spreadCount) as _, si}
            {@const [leftIdx, rightIdx] = getSpreadPages(si)}
            <div class="carousel-item">
              <div class="page-container" style="{si !== activeSpread ? 'pointer-events: none;' : ''}">
                <!-- LEFT PAGE -->
                {#if si === 0}
                  <div class="left-page cover-page">
                    <Page
                      pageIndex={leftIdx}
                      notes={notesByPage[leftIdx] || []}
                      isWritable={!isWriteMode}
                    >
                      <div class="cover-inner" style="grid-column: 1 / -1; grid-row: 1 / -1; pointer-events: none;">
                        <img
                          src="/assets/pixel-art/decorative/sample-bunny.png"
                          alt="Pixel bunny"
                          class="cover-bunny pixel-sprite"
                        />
                        <h1 class="cover-title">Guest Book</h1>
                      </div>
                      <NoteRenderer
                        notes={notesByPage[leftIdx] || []}
                        pageIndex={leftIdx}
                      />
                      {#if si === activeSpread}
                        <DragSelector
                          occupancyMap={new OccupancyMap(notesByPage[leftIdx] || [])}
                          on:select={(e) => handleSelect(e, leftIdx)}
                        />
                      {/if}
                      {#if isWriteMode && activePageIndex === leftIdx && selection}
                        <WriteMode
                          {selection}
                          pageIndex={leftIdx}
                          bind:text={writeText}
                          onsubmit={handleSubmit}
                          oncancel={handleCancel}
                        />
                      {/if}
                    </Page>
                  </div>
                {:else}
                  <div class="left-page">
                    <Page
                      pageIndex={leftIdx}
                      notes={notesByPage[leftIdx] || []}
                      isWritable={!isWriteMode}
                    >
                      <NoteRenderer
                        notes={notesByPage[leftIdx] || []}
                        pageIndex={leftIdx}
                      />
                      {#if si === activeSpread}
                        <DragSelector
                          occupancyMap={new OccupancyMap(notesByPage[leftIdx] || [])}
                          on:select={(e) => handleSelect(e, leftIdx)}
                        />
                      {/if}
                      {#if isWriteMode && activePageIndex === leftIdx && selection}
                        <WriteMode
                          {selection}
                          pageIndex={leftIdx}
                          bind:text={writeText}
                          onsubmit={handleSubmit}
                          oncancel={handleCancel}
                        />
                      {/if}
                    </Page>
                  </div>
                {/if}

                <!-- RIGHT PAGE -->
                {#if si === 0}
                  <div class="right-page title-page">
                    <Page
                      pageIndex={rightIdx}
                      notes={notesByPage[rightIdx] || []}
                      isWritable={!isWriteMode}
                      gridConfig={{ cols: 9, rows: 16 }}
                    >
                      <div class="title-header" style="grid-row: 1 / 7; grid-column: 1 / -1; pointer-events: none;">
                        <h1 class="title-main">Guest Book</h1>
                        <p class="title-subtitle">by Ian Hogers</p>
                        <p class="title-credit">
                          Thank you for visiting my corner of the web, I would love for you to leave your mark in this book! thank you
                        </p>
                      </div>
                      <NoteRenderer
                        notes={notesByPage[rightIdx] || []}
                        pageIndex={rightIdx}
                      />
                      {#if si === activeSpread}
                        <DragSelector
                          occupancyMap={(() => { const m = new OccupancyMap(notesByPage[rightIdx] || []); m.addNote({ row_start: 1, row_end: 4, col_start: 4, col_end: 7 }); m.addNote({ row_start: 4, row_end: 5, col_start: 1, col_end: 10 }); return m; })()}
                          on:select={(e) => handleSelect(e, rightIdx)}
                        />
                      {/if}
                      {#if isWriteMode && activePageIndex === rightIdx && selection}
                        <WriteMode
                          {selection}
                          pageIndex={rightIdx}
                          bind:text={writeText}
                          onsubmit={handleSubmit}
                          oncancel={handleCancel}
                        />
                      {/if}
                    </Page>
                  </div>
                {:else}
                  <div class="right-page">
                    <Page
                      pageIndex={rightIdx}
                      notes={notesByPage[rightIdx] || []}
                      isWritable={!isWriteMode}
                    >
                      <NoteRenderer
                        notes={notesByPage[rightIdx] || []}
                        pageIndex={rightIdx}
                      />
                      {#if si === activeSpread}
                        <DragSelector
                          occupancyMap={new OccupancyMap(notesByPage[rightIdx] || [])}
                          on:select={(e) => handleSelect(e, rightIdx)}
                        />
                      {/if}
                      {#if isWriteMode && activePageIndex === rightIdx && selection}
                        <WriteMode
                          {selection}
                          pageIndex={rightIdx}
                          bind:text={writeText}
                          onsubmit={handleSubmit}
                          oncancel={handleCancel}
                        />
                      {/if}
                    </Page>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
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

  /* Lock scroll during drag selection */
  .carousel.no-scroll {
    overflow: hidden;
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
    width: 48px;
    height: 48px;
  }

  .cover-title {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.9rem;
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
    font-size: 0.9rem;
    color: #333;
    text-align: center;
    margin: 0 0 0.15rem 0;
    image-rendering: pixelated;
  }

  .title-subtitle {
    font-family: 'Grand9KPixel', monospace;
    font-size: 0.55rem;
    color: hsl(45.71deg 69.23% 30%);
    text-align: center;
    margin: 0 0 0.5rem 0;
    image-rendering: pixelated;
  }

  .title-credit {
    font-size: 0.4rem;
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
