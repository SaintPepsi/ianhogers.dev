<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GuestbookNote } from './lib/types';

  export let pageIndex: number;
  export let notes: GuestbookNote[] = [];
  export let isWritable: boolean = true;
  export let gridConfig: { cols: number; rows: number } = { cols: 9, rows: 16 };

  const dispatch = createEventDispatcher();

  let gridEl: HTMLDivElement;
  let isDragging = false;
  let dragStart: { col: number; row: number } | null = null;

  function getCellFromEvent(e: PointerEvent): { col: number; row: number } | null {
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor((x / rect.width) * gridConfig.cols) + 1;
    const row = Math.floor((y / rect.height) * gridConfig.rows) + 1;
    if (col < 1 || col > gridConfig.cols || row < 1 || row > gridConfig.rows) return null;
    return { col, row };
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isWritable) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    isDragging = true;
    dragStart = cell;
    dispatch('selectarea', { action: 'start', ...cell, event: e });
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || !isWritable) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    dispatch('selectarea', { action: 'move', ...cell, event: e });
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging || !isWritable) return;
    isDragging = false;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    dispatch('selectarea', { action: 'end', ...cell, event: e });
    dragStart = null;
  }
</script>

<div
  class="page pixel-sprite"
  class:writable={isWritable}
  style="--grid-cols: {gridConfig.cols}; --grid-rows: {gridConfig.rows};"
  bind:this={gridEl}
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
>
  <!-- Ruled lines -->
  {#each Array(gridConfig.rows - 1) as _, i}
    <div
      class="ruled-line"
      style="grid-column: 1 / -1; grid-row: {i + 2} / {i + 2}; align-self: start;"
    ></div>
  {/each}

  <slot />

  <!-- Page number -->
  <div class="page-number" style="grid-column: 1 / -1; grid-row: {gridConfig.rows} / {gridConfig.rows + 1};">
    {pageIndex + 1}
  </div>
</div>

<style>
  .page {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 9), 1fr);
    grid-template-rows: repeat(var(--grid-rows, 16), 1fr);
    aspect-ratio: 9 / 16;
    background-color: #f5f0e8;
    background-image:
      url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    border-radius: 2px;
    box-shadow:
      inset 0 0 30px rgba(0, 0, 0, 0.05),
      2px 2px 8px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .page.writable {
    cursor: crosshair;
  }

  .ruled-line {
    width: 100%;
    height: 1px;
    background-color: #e0d8cc;
    pointer-events: none;
    z-index: 0;
  }

  .page-number {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: 0.65rem;
    color: #b0a898;
    padding-bottom: 4px;
    pointer-events: none;
    z-index: 1;
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
