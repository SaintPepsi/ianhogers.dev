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
    role="region"
    aria-label="Games"
  >
    {#each games as game (game.slug)}
      <GameTile {game} />
    {/each}
  </div>

  <button type="button" class="shelf-arrow left" disabled={atStart} onclick={() => goTo(centredIndex() - 1)} aria-label="Previous game">
    <img src="/assets/pixel-art/ui/green_up_arrow_tiny.png" alt="" class="pixel-sprite w-4 h-4 -rotate-90" />
  </button>
  <button type="button" class="shelf-arrow right" disabled={atEnd} onclick={() => goTo(centredIndex() + 1)} aria-label="Next game">
    <img src="/assets/pixel-art/ui/green_up_arrow_tiny.png" alt="" class="pixel-sprite w-4 h-4 rotate-90" />
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

  .shelf-arrow {
    position: absolute;
    /* Middle of the 16:10 cover, so the arrows never sit on the tile's text. */
    top: calc(0.75rem + var(--tile) * 0.3125);
    transform: translateY(-50%);
    z-index: 30;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    background: rgba(30, 26, 40, 0.85);
    border: 2px solid #2a2438;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    transition: opacity 0.2s ease, border-color 0.2s ease;
  }
  .shelf-arrow:hover:not(:disabled) {
    border-color: #a78bfa;
  }
  .shelf-arrow:disabled {
    opacity: 0;
    pointer-events: none;
  }
  /* Sit on the edges of the centred tile, clear of the neighbours peeking in. */
  .shelf-arrow.left {
    left: calc(50% - var(--tile) / 2 - 1.375rem);
  }
  .shelf-arrow.right {
    right: calc(50% - var(--tile) / 2 - 1.375rem);
  }
  @media (max-width: 640px) {
    .shelf-arrow.left {
      left: 0.25rem;
    }
    .shelf-arrow.right {
      right: 0.25rem;
    }
  }
</style>
