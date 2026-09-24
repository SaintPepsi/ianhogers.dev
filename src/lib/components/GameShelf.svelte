<script lang="ts">
  import { onMount } from 'svelte';
  import GameTile from '$lib/components/GameTile.svelte';
  import type { Game } from '$lib/data/games';

  let { games }: { games: Game[] } = $props();

  let shelf: HTMLDivElement;
  let atStart = $state(false);
  let atEnd = $state(false);
  let dragging = $state(false);

  const tiles = () => [...shelf.children] as HTMLElement[];
  const behavior = (): ScrollBehavior =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  function leftFor(tile: HTMLElement) {
    return tile.offsetLeft + tile.offsetWidth / 2 - shelf.clientWidth / 2;
  }

  function centredIndex() {
    const dist = tiles().map((t) => Math.abs(leftFor(t) - shelf.scrollLeft));
    return dist.indexOf(Math.min(...dist));
  }

  function goTo(i: number, how: ScrollBehavior = behavior()) {
    const all = tiles();
    const tile = all[Math.max(0, Math.min(all.length - 1, i))];
    shelf.scrollTo({ left: leftFor(tile), behavior: how });
  }

  function updateEnds() {
    atStart = shelf.scrollLeft <= 1;
    atEnd = shelf.scrollLeft >= shelf.scrollWidth - shelf.clientWidth - 1;
  }

  // Mouse drag. Touch and trackpads already scroll natively, so only a mouse gets this.
  let startX = 0;
  let startLeft = 0;
  let startIndex = 0;
  let moved = false;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    startX = e.clientX;
    startLeft = shelf.scrollLeft;
    startIndex = centredIndex();
    moved = false;
    dragging = true;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    // Capture only once it's a real drag, so a plain click still lands on the tile.
    if (!moved && Math.abs(dx) > 5) {
      moved = true;
      shelf.setPointerCapture(e.pointerId);
    }
    if (moved) shelf.scrollLeft = startLeft - dx;
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    if (shelf.hasPointerCapture(e.pointerId)) shelf.releasePointerCapture(e.pointerId);
    // A drag past a fifth of a tile always moves at least one tile that way; a short one settles back.
    const dx = e.clientX - startX;
    const landed = centredIndex();
    const flicked = Math.abs(dx) > tiles()[0].offsetWidth / 5 && landed === startIndex;
    goTo(flicked ? startIndex - Math.sign(dx) : landed);
  }

  // A drag that ends on a tile must not also open the game.
  function onClickCapture(e: MouseEvent) {
    if (!moved) return;
    e.preventDefault();
    e.stopPropagation();
    moved = false;
  }

  onMount(() => {
    goTo(Math.floor((games.length - 1) / 2), 'auto');
    updateEnds();
  });
</script>

<div class="shelf-wrap">
  <!-- A scrollable region must be focusable so keyboard users can scroll it (axe: scrollable-region-focusable) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="game-shelf"
    class:dragging
    bind:this={shelf}
    onscroll={updateEnds}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onclickcapture={onClickCapture}
    ondragstart={(e) => e.preventDefault()}
    id="game-shelf"
    role="region"
    aria-label="Games"
    tabindex="0"
  >
    {#each games as game (game.slug)}
      <GameTile {game} />
    {/each}
  </div>

  {#snippet chevron()}
    <!-- pixel chevron pointing right; the left button mirrors it -->
    <svg viewBox="0 0 7 12" width="14" height="24" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">
      <rect x="0" y="0" width="3" height="2" /><rect x="2" y="2" width="3" height="2" /><rect x="4" y="4" width="3" height="2" />
      <rect x="4" y="6" width="3" height="2" /><rect x="2" y="8" width="3" height="2" /><rect x="0" y="10" width="3" height="2" />
    </svg>
  {/snippet}
  <button type="button" class="shelf-arrow left" disabled={atStart} onclick={() => goTo(centredIndex() - 1)} aria-label="Previous game" aria-controls="game-shelf">
    {@render chevron()}
  </button>
  <button type="button" class="shelf-arrow right" disabled={atEnd} onclick={() => goTo(centredIndex() + 1)} aria-label="Next game" aria-controls="game-shelf">
    {@render chevron()}
  </button>
</div>

<style>
  .shelf-wrap {
    position: relative;
    --tile: min(32rem, 86vw);
  }

  /* Break out of the max-w-3xl column. Side padding lets the first and last tiles reach the centre. */
  .game-shelf {
    position: relative;
    left: 50%;
    width: 100vw;
    margin-left: -50vw;
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem calc((100vw - var(--tile)) / 2) 1.5rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    cursor: grab;
  }
  .game-shelf::-webkit-scrollbar {
    display: none;
  }
  /* Snap fights a drag in progress; goTo() settles the shelf on release. */
  .game-shelf.dragging {
    scroll-snap-type: none;
    cursor: grabbing;
    user-select: none;
  }

  .game-shelf:focus-visible {
    outline: 3px solid #fff;
    outline-offset: -3px;
  }

  .shelf-arrow {
    --size: 3.5rem;
    position: absolute;
    /* Middle of the 16:10 cover, so the arrows never sit on the tile's text. */
    top: calc(0.75rem + var(--tile) * 0.3125);
    transform: translateY(-50%);
    z-index: 30;
    display: grid;
    place-items: center;
    width: var(--size);
    height: var(--size);
    color: #14111c;
    background: #a78bfa;
    border: 3px solid #14111c;
    box-shadow: 4px 4px 0 #000, 0 0 0 2px rgba(167, 139, 250, 0.35);
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease, opacity 0.2s ease;
  }
  .shelf-arrow:hover {
    background: #c4b5fd;
  }
  .shelf-arrow:active {
    transform: translate(2px, calc(-50% + 2px));
    box-shadow: 2px 2px 0 #000;
  }
  .shelf-arrow:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 3px;
  }
  .shelf-arrow:disabled {
    opacity: 0;
    visibility: hidden;
  }
  .shelf-arrow.left svg {
    transform: scaleX(-1);
  }
  /* Pinned to the screen edges. The wrap sits in the centred column, so (100vw - 100%) / 2 is its gutter. */
  .shelf-arrow {
    --inset: 1rem;
  }
  .shelf-arrow.left {
    left: calc(var(--inset) - (100vw - 100%) / 2);
  }
  .shelf-arrow.right {
    right: calc(var(--inset) - (100vw - 100%) / 2);
  }
  @media (max-width: 640px) {
    .shelf-arrow {
      --size: 3rem;
      --inset: 0.5rem;
    }
  }
</style>
