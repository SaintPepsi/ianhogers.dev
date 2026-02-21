<script lang="ts">
  import { onMount } from 'svelte';
  import type { GuestbookNote } from './lib/types';
  import { OccupancyMap } from './lib/occupancy';
  import Page from './Page.svelte';
  import NoteRenderer from './NoteRenderer.svelte';
  import DragSelector from './DragSelector.svelte';
  import WriteMode from './WriteMode.svelte';

  // State
  let notes: GuestbookNote[] = [];
  let currentSpread: number = 0;
  let isWriteMode: boolean = false;
  let selection: { rowStart: number; rowEnd: number; colStart: number; colEnd: number } | null = null;
  let activePageIndex: number = -1;
  let isLoading: boolean = true;
  let error: string = '';

  // Derived: organize notes by page_index
  $: notesByPage = notes.reduce<Record<number, GuestbookNote[]>>((acc, note) => {
    if (!acc[note.page_index]) acc[note.page_index] = [];
    acc[note.page_index].push(note);
    return acc;
  }, {});

  // Determine total page count (at minimum 4 pages: cover, title, page 2, page 3)
  $: {
    const maxPageIndex = notes.reduce((max, n) => Math.max(max, n.page_index), 1);
    // Ensure we always have at least enough pages, and check occupancy for expansion
    let neededPages = Math.max(4, maxPageIndex + 2);
    // Check if the last content page is >70% full
    const lastPageNotes = notesByPage[neededPages - 1] || [];
    const lastPageOccupancy = new OccupancyMap(lastPageNotes);
    if (lastPageOccupancy.getOccupancy() > 0.7) {
      neededPages += 2; // Add another spread
    }
    totalPages = neededPages;
  }

  let totalPages = 4;

  // Spreads: pairs of pages [left, right]
  // Spread 0: [0 (cover), 1 (title)]
  // Spread 1: [2, 3]
  // Spread 2: [4, 5] ...
  $: spreadCount = Math.ceil(totalPages / 2);

  function getSpreadPages(spreadIndex: number): [number, number] {
    return [spreadIndex * 2, spreadIndex * 2 + 1];
  }

  function getPageNotes(pageIndex: number): GuestbookNote[] {
    return notesByPage[pageIndex] || [];
  }

  function getOccupancyMap(pageIndex: number): OccupancyMap {
    return new OccupancyMap(getPageNotes(pageIndex));
  }

  // Navigation
  function prevSpread() {
    if (currentSpread > 0) {
      currentSpread--;
      exitWriteMode();
    }
  }

  function nextSpread() {
    if (currentSpread < spreadCount - 1) {
      currentSpread++;
      exitWriteMode();
    }
  }

  // Write mode
  function handleSelect(e: CustomEvent, pageIndex: number) {
    selection = e.detail;
    activePageIndex = pageIndex;
    isWriteMode = true;
  }

  function exitWriteMode() {
    isWriteMode = false;
    selection = null;
    activePageIndex = -1;
  }

  async function handleSubmit(e: CustomEvent) {
    const { text, author } = e.detail;
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
      // Could show a toast here; for now log it
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
    <div class="book-wrapper">
      <!-- Navigation: left arrow -->
      <button
        class="nav-btn nav-left"
        on:click={prevSpread}
        disabled={currentSpread === 0}
        aria-label="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="8" y="2" width="2" height="2"/>
          <rect x="6" y="4" width="2" height="2"/>
          <rect x="4" y="6" width="2" height="2"/>
          <rect x="6" y="8" width="2" height="2"/>
          <rect x="8" y="10" width="2" height="2"/>
          <rect x="4" y="6" width="8" height="2"/>
        </svg>
      </button>

      <!-- Book spread -->
      <div class="spread" style="transform: translateX({-currentSpread * 100}%);">
        {#each Array(spreadCount) as _, si}
          {@const [leftIdx, rightIdx] = getSpreadPages(si)}
          <div class="spread-pair" style="left: {si * 100}%;">
            <!-- LEFT PAGE -->
            {#if si === 0}
              <!-- Cover page -->
              <div class="page-slot cover-page">
                <div class="cover-inner pixel-box">
                  <img
                    src="/assets/pixel-art/decorative/sample-bunny.png"
                    alt="Pixel bunny"
                    class="cover-bunny pixel-sprite"
                  />
                  <h1 class="cover-title">Guest Book</h1>
                </div>
              </div>
            {:else}
              <div class="page-slot">
                <Page
                  pageIndex={leftIdx}
                  notes={getPageNotes(leftIdx)}
                  isWritable={!isWriteMode}
                >
                  <NoteRenderer
                    notes={getPageNotes(leftIdx)}
                    pageIndex={leftIdx}
                  />
                  {#if !isWriteMode}
                    <DragSelector
                      occupancyMap={getOccupancyMap(leftIdx)}
                      on:select={(e) => handleSelect(e, leftIdx)}
                    />
                  {/if}
                  {#if isWriteMode && activePageIndex === leftIdx && selection}
                    <WriteMode
                      {selection}
                      pageIndex={leftIdx}
                      on:submit={handleSubmit}
                      on:cancel={handleCancel}
                    />
                  {/if}
                </Page>
              </div>
            {/if}

            <!-- RIGHT PAGE -->
            {#if si === 0}
              <!-- Title page -->
              <div class="page-slot title-page-slot">
                <Page
                  pageIndex={rightIdx}
                  notes={getPageNotes(rightIdx)}
                  isWritable={!isWriteMode}
                  gridConfig={{ cols: 9, rows: 16 }}
                >
                  <!-- Title content (rows 1-12) -->
                  <div class="title-header" style="grid-row: 1 / 7; grid-column: 1 / -1;">
                    <h1 class="title-main">Guest Book</h1>
                    <p class="title-subtitle">by Ian Hogers</p>
                    <p class="title-credit">
                      Book animation inspired by Maseone (@troshkin_pavel)
                    </p>
                  </div>

                  <!-- Inaugural note area (rows 13-16) -->
                  <div class="title-notes-area" style="grid-row: 13 / 17; grid-column: 1 / -1;">
                    <NoteRenderer
                      notes={getPageNotes(rightIdx)}
                      pageIndex={rightIdx}
                    />
                  </div>
                </Page>
              </div>
            {:else}
              <div class="page-slot">
                <Page
                  pageIndex={rightIdx}
                  notes={getPageNotes(rightIdx)}
                  isWritable={!isWriteMode}
                >
                  <NoteRenderer
                    notes={getPageNotes(rightIdx)}
                    pageIndex={rightIdx}
                  />
                  {#if !isWriteMode}
                    <DragSelector
                      occupancyMap={getOccupancyMap(rightIdx)}
                      on:select={(e) => handleSelect(e, rightIdx)}
                    />
                  {/if}
                  {#if isWriteMode && activePageIndex === rightIdx && selection}
                    <WriteMode
                      {selection}
                      pageIndex={rightIdx}
                      on:submit={handleSubmit}
                      on:cancel={handleCancel}
                    />
                  {/if}
                </Page>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Navigation: right arrow -->
      <button
        class="nav-btn nav-right"
        on:click={nextSpread}
        disabled={currentSpread >= spreadCount - 1}
        aria-label="Next page"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="6" y="2" width="2" height="2"/>
          <rect x="8" y="4" width="2" height="2"/>
          <rect x="10" y="6" width="2" height="2"/>
          <rect x="8" y="8" width="2" height="2"/>
          <rect x="6" y="10" width="2" height="2"/>
          <rect x="4" y="6" width="8" height="2"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap');

  .guestbook-container {
    width: 100%;
    max-width: 800px;
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
    font-family: 'Caveat', cursive;
    font-size: 1.2rem;
    color: #b0a898;
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
    font-family: 'Caveat', cursive;
    font-size: 1.1rem;
    color: #ef5350;
  }

  .retry-btn {
    font-family: 'Caveat', cursive;
    font-size: 0.9rem;
    background: #1e1a28;
    color: #f5f0e8;
    border: 1px solid #4a4458;
    border-radius: 2px;
    padding: 4px 16px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: #2a2438;
  }

  /* Book wrapper */
  .book-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Navigation buttons */
  .nav-btn {
    flex-shrink: 0;
    width: 32px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1a28;
    border: 1px solid #4a4458;
    border-radius: 2px;
    color: #b0a898;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    image-rendering: pixelated;
    z-index: 30;
  }

  .nav-btn:hover:not(:disabled) {
    color: #f5f0e8;
    border-color: #b388ff;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Spread carousel */
  .spread {
    position: relative;
    flex: 1;
    overflow: hidden;
    aspect-ratio: 18 / 16;
    transition: transform 0.4s ease;
  }

  .spread-pair {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    gap: 2px;
  }

  .page-slot {
    flex: 1;
    position: relative;
  }

  /* Cover page */
  .cover-page {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cover-inner {
    width: 100%;
    height: 100%;
    aspect-ratio: 9 / 16;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background-color: #1e1a28;
    padding: 1rem;
  }

  .cover-bunny {
    width: 64px;
    height: 64px;
  }

  .cover-title {
    font-family: 'Weiholmir', cursive;
    font-size: 1.6rem;
    color: #f5f0e8;
    text-align: center;
    letter-spacing: 0.05em;
  }

  /* Title page */
  .title-page-slot :global(.page) {
    /* No special override needed - page already has cream background */
  }

  .title-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.5rem;
    z-index: 1;
  }

  .title-main {
    font-family: 'Weiholmir', cursive;
    font-size: 1.4rem;
    color: #2c2420;
    text-align: center;
    margin-bottom: 0.25rem;
  }

  .title-subtitle {
    font-family: 'Caveat', cursive;
    font-size: 0.9rem;
    color: #6b5e50;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .title-credit {
    font-size: 0.55rem;
    color: #b0a898;
    text-align: center;
    font-family: 'Inter', system-ui, sans-serif;
    max-width: 80%;
    line-height: 1.4;
  }

  .title-notes-area {
    position: relative;
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    grid-template-rows: repeat(4, 1fr);
    z-index: 1;
  }
</style>
