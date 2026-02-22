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
    background: transparent;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .page.writable {
    cursor: crosshair;
  }

  .page-number {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: 0.5rem;
    color: hsl(45.71deg 69.23% 30%);
    padding-bottom: 4px;
    pointer-events: none;
    z-index: 1;
    font-family: 'Grand9KPixel', monospace;
    image-rendering: pixelated;
  }
</style>
